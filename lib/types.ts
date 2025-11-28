export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

export const STORAGE_KEY_SESSIONS = "ai-chat-sessions";
export const STORAGE_KEY_MESSAGES_PREFIX = "ai-chat-messages-";
export const STORAGE_KEY_LEGACY = "ai-chat-history";

