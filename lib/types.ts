// 도구 호출 정보
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  serverId?: string;
  serverName?: string;
}

// 도구 결과 컨텐츠 (텍스트, 이미지, 리소스)
export interface ToolResultContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string; // base64 이미지 데이터
  mimeType?: string;
  uri?: string;
  url?: string; // Storage에 저장된 이미지 URL
}

// 도구 호출 결과
export interface ToolCallResult {
  toolCallId: string;
  name: string;
  result: string; // 텍스트 결과
  contents?: ToolResultContent[]; // 전체 컨텐츠 (이미지 포함)
  isError?: boolean;
}

// 메시지 타입 (도구 호출 정보 포함)
export interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolCallResult[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

export const STORAGE_KEY_SESSIONS = "ai-chat-sessions";
export const STORAGE_KEY_MESSAGES_PREFIX = "ai-chat-messages-";
export const STORAGE_KEY_LEGACY = "ai-chat-history";
