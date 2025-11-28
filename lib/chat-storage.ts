import { supabase } from "./supabase";
import {
  Message,
  ChatSession,
  ToolResultContent,
  STORAGE_KEY_SESSIONS,
  STORAGE_KEY_MESSAGES_PREFIX,
  STORAGE_KEY_LEGACY,
} from "./types";
import { uploadImage } from "./storage";

const MIGRATION_FLAG_KEY = "supabase-migration-done";

// 세션 목록 조회
export async function getSessions(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch sessions:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
  }));
}

// 특정 세션의 메시지 조회
export async function getMessages(sessionId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("role, content, tool_calls, tool_results")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch messages:", error);
    return [];
  }

  return data.map((row) => ({
    role: row.role as "user" | "assistant",
    content: row.content,
    toolCalls: row.tool_calls || undefined,
    toolResults: row.tool_results || undefined,
  }));
}

// 새 세션 생성
export async function createSession(session: ChatSession): Promise<boolean> {
  const { error } = await supabase.from("chat_sessions").insert({
    id: session.id,
    title: session.title,
    created_at: session.createdAt,
  });

  if (error) {
    console.error("Failed to create session:", error);
    return false;
  }
  return true;
}

// 세션 제목 업데이트
export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<boolean> {
  const { error } = await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", sessionId);

  if (error) {
    console.error("Failed to update session title:", error);
    return false;
  }
  return true;
}

// 세션 삭제 (cascade로 메시지도 삭제됨)
export async function deleteSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    console.error("Failed to delete session:", error);
    return false;
  }
  return true;
}

// 이미지를 Storage에 업로드하고 URL로 대체
async function processToolResultsForStorage(
  sessionId: string,
  toolResults?: Message["toolResults"]
): Promise<Message["toolResults"]> {
  if (!toolResults) return undefined;

  const processed = await Promise.all(
    toolResults.map(async (result) => {
      if (!result.contents) return result;

      const processedContents = await Promise.all(
        result.contents.map(async (content: ToolResultContent) => {
          // 이미지이고 base64 데이터가 있으면 Storage에 업로드
          if (content.type === "image" && content.data && content.mimeType) {
            const url = await uploadImage(
              content.data,
              content.mimeType,
              sessionId
            );
            if (url) {
              // URL로 대체, base64 데이터는 제거
              return {
                type: content.type,
                mimeType: content.mimeType,
                url,
              } as ToolResultContent;
            }
          }
          return content;
        })
      );

      return { ...result, contents: processedContents };
    })
  );

  return processed;
}

// 메시지 저장 (기존 메시지 삭제 후 새로 저장)
export async function saveMessages(
  sessionId: string,
  messages: Message[]
): Promise<boolean> {
  // 기존 메시지 삭제
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("session_id", sessionId);

  if (deleteError) {
    console.error("Failed to delete old messages:", deleteError);
    return false;
  }

  // 새 메시지가 없으면 여기서 종료
  if (messages.length === 0) return true;

  // 이미지를 Storage에 업로드하고 메시지 처리
  const processedMessages = await Promise.all(
    messages.map(async (msg) => {
      const processedToolResults = await processToolResultsForStorage(
        sessionId,
        msg.toolResults
      );

      return {
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        tool_calls: msg.toolCalls || null,
        tool_results: processedToolResults || null,
      };
    })
  );

  // 새 메시지 삽입
  const { error: insertError } = await supabase
    .from("messages")
    .insert(processedMessages);

  if (insertError) {
    console.error("Failed to save messages:", insertError);
    return false;
  }
  return true;
}

// localStorage에서 Supabase로 데이터 마이그레이션
export async function migrateFromLocalStorage(): Promise<boolean> {
  // 이미 마이그레이션 완료 확인
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
    return true;
  }

  try {
    // 레거시 데이터 마이그레이션 (단일 채팅 히스토리)
    const legacyData = localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacyData) {
      const parsed = JSON.parse(legacyData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sessionId = Date.now().toString();
        const firstMessage = parsed[0];
        const title =
          firstMessage.role === "user"
            ? firstMessage.content.slice(0, 30) || "새로운 채팅"
            : "새로운 채팅";

        const session: ChatSession = {
          id: sessionId,
          title,
          createdAt: Date.now(),
        };

        await createSession(session);
        await saveMessages(sessionId, parsed);
        localStorage.removeItem(STORAGE_KEY_LEGACY);
      }
    }

    // 세션 기반 데이터 마이그레이션
    const savedSessions = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (savedSessions) {
      const sessions: ChatSession[] = JSON.parse(savedSessions);

      for (const session of sessions) {
        // 세션 생성
        await createSession(session);

        // 해당 세션의 메시지 마이그레이션
        const messagesKey = STORAGE_KEY_MESSAGES_PREFIX + session.id;
        const savedMessages = localStorage.getItem(messagesKey);
        if (savedMessages) {
          const messages: Message[] = JSON.parse(savedMessages);
          await saveMessages(session.id, messages);
          localStorage.removeItem(messagesKey);
        }
      }

      localStorage.removeItem(STORAGE_KEY_SESSIONS);
    }

    // 마이그레이션 완료 플래그 설정
    localStorage.setItem(MIGRATION_FLAG_KEY, "true");
    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    return false;
  }
}

// 마이그레이션 상태 확인
export function isMigrationDone(): boolean {
  return localStorage.getItem(MIGRATION_FLAG_KEY) === "true";
}

