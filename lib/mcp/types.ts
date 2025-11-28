// MCP Transport 타입
export type TransportType = "stdio" | "streamable-http" | "sse";

// MCP 서버 설정
export interface MCPServerConfig {
  id: string;
  name: string;
  transport: TransportType;
  // STDIO 전용
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // HTTP/SSE 전용
  url?: string;
}

// MCP 연결 상태
export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error";

// MCP Tool 정보
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// MCP Prompt 정보
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

// MCP Resource 정보
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// MCP 서버 연결 상태
export interface MCPConnectionState {
  serverId: string;
  status: ConnectionStatus;
  error?: string;
  tools: MCPTool[];
  prompts: MCPPrompt[];
  resources: MCPResource[];
}

// Tool 실행 결과
export interface ToolCallResult {
  content: ToolContent[];
  isError?: boolean;
}

export interface ToolContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

// Prompt 실행 결과
export interface PromptResult {
  description?: string;
  messages: PromptMessage[];
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: {
    type: "text" | "image" | "resource";
    text?: string;
  };
}

// Resource 읽기 결과
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// localStorage 저장 키
export const MCP_STORAGE_KEY = "mcp-server-configs";

