import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  MCPServerConfig,
  MCPConnectionState,
  MCPTool,
  MCPPrompt,
  MCPResource,
  ToolCallResult,
  PromptResult,
  ResourceContent,
} from "./types";

// 싱글톤 MCP Client Manager
class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, Transport> = new Map();
  private connectionStates: Map<string, MCPConnectionState> = new Map();

  // 서버 연결
  async connect(config: MCPServerConfig): Promise<MCPConnectionState> {
    // 이미 연결된 경우 기존 상태 반환
    if (this.clients.has(config.id)) {
      const state = this.connectionStates.get(config.id);
      if (state?.status === "connected") {
        return state;
      }
    }

    // 연결 중 상태 설정
    this.updateState(config.id, { status: "connecting" });

    try {
      const transport = await this.createTransport(config);
      const client = new Client({
        name: "mcp-client-app",
        version: "1.0.0",
      });

      await client.connect(transport);

      this.clients.set(config.id, client);
      this.transports.set(config.id, transport);

      // 연결 후 capabilities 조회
      const [tools, prompts, resources] = await Promise.all([
        this.fetchTools(client),
        this.fetchPrompts(client),
        this.fetchResources(client),
      ]);

      const state: MCPConnectionState = {
        serverId: config.id,
        status: "connected",
        tools,
        prompts,
        resources,
      };

      this.connectionStates.set(config.id, state);
      return state;
    } catch (error) {
      console.error(`[MCP] Connection failed for ${config.name}:`, error);
      
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        // Connection closed 오류에 대한 더 친절한 메시지
        if (error.message.includes("Connection closed")) {
          errorMessage = `연결이 종료되었습니다. MCP 서버가 올바르게 설정되었는지 확인하세요. (command: ${config.command} ${config.args?.join(" ") || ""})`;
        } else {
          errorMessage = error.message;
        }
      }
      
      const state: MCPConnectionState = {
        serverId: config.id,
        status: "error",
        error: errorMessage,
        tools: [],
        prompts: [],
        resources: [],
      };
      this.connectionStates.set(config.id, state);
      throw error;
    }
  }

  // 서버 연결 해제
  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    const transport = this.transports.get(serverId);

    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error closing client for ${serverId}:`, error);
      }
      this.clients.delete(serverId);
    }

    if (transport) {
      try {
        await transport.close();
      } catch (error) {
        console.error(`Error closing transport for ${serverId}:`, error);
      }
      this.transports.delete(serverId);
    }

    this.updateState(serverId, { status: "disconnected" });
  }

  // 연결 상태 조회
  getConnectionState(serverId: string): MCPConnectionState | undefined {
    return this.connectionStates.get(serverId);
  }

  // 모든 연결 상태 조회
  getAllConnectionStates(): MCPConnectionState[] {
    return Array.from(this.connectionStates.values());
  }

  // Tools 목록 조회
  async listTools(serverId: string): Promise<MCPTool[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return this.fetchTools(client);
  }

  // Tool 실행
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    return {
      content: (result.content || []).map((c) => ({
        type: c.type as "text" | "image" | "resource",
        text: "text" in c ? (c.text as string) : undefined,
        data: "data" in c ? (c.data as string) : undefined,
        mimeType: "mimeType" in c ? (c.mimeType as string) : undefined,
        uri: "uri" in c ? (c.uri as string) : undefined,
      })),
      isError: result.isError,
    };
  }

  // Prompts 목록 조회
  async listPrompts(serverId: string): Promise<MCPPrompt[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return this.fetchPrompts(client);
  }

  // Prompt 실행
  async getPrompt(
    serverId: string,
    promptName: string,
    args: Record<string, string>
  ): Promise<PromptResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.getPrompt({
      name: promptName,
      arguments: args,
    });

    return {
      description: result.description,
      messages: (result.messages || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: {
          type:
            (m.content as { type?: string }).type === "text" ? "text" : "text",
          text:
            (m.content as { text?: string }).text ||
            JSON.stringify(m.content),
        },
      })),
    };
  }

  // Resources 목록 조회
  async listResources(serverId: string): Promise<MCPResource[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return this.fetchResources(client);
  }

  // Resource 읽기
  async readResource(serverId: string, uri: string): Promise<ResourceContent[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.readResource({ uri });

    return (result.contents || []).map((c) => ({
      uri: c.uri,
      mimeType: c.mimeType,
      text: "text" in c ? (c.text as string) : undefined,
      blob: "blob" in c ? (c.blob as string) : undefined,
    }));
  }

  // Transport 생성
  private async createTransport(config: MCPServerConfig): Promise<Transport> {
    switch (config.transport) {
      case "stdio": {
        if (!config.command) {
          throw new Error("STDIO transport requires command");
        }
        
        // Windows에서 npx 등 실행을 위해 shell 옵션 필요
        const isWindows = process.platform === "win32";
        const command = isWindows ? config.command : config.command;
        const args = config.args || [];
        
        // 환경 변수 병합 (현재 프로세스 환경 + 사용자 지정)
        const env = {
          ...process.env,
          ...config.env,
        };

        console.log(`[MCP] Connecting via STDIO: ${command} ${args.join(" ")}`);
        
        return new StdioClientTransport({
          command,
          args,
          env,
        });
      }

      case "streamable-http":
        if (!config.url) {
          throw new Error("Streamable HTTP transport requires URL");
        }
        return new StreamableHTTPClientTransport(new URL(config.url));

      case "sse":
        if (!config.url) {
          throw new Error("SSE transport requires URL");
        }
        return new SSEClientTransport(new URL(config.url));

      default:
        throw new Error(`Unknown transport type: ${config.transport}`);
    }
  }

  // Tools 조회 헬퍼
  private async fetchTools(client: Client): Promise<MCPTool[]> {
    try {
      const result = await client.listTools();
      return (result.tools || []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown>,
      }));
    } catch {
      return [];
    }
  }

  // Prompts 조회 헬퍼
  private async fetchPrompts(client: Client): Promise<MCPPrompt[]> {
    try {
      const result = await client.listPrompts();
      return (result.prompts || []).map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments?.map((a) => ({
          name: a.name,
          description: a.description,
          required: a.required,
        })),
      }));
    } catch {
      return [];
    }
  }

  // Resources 조회 헬퍼
  private async fetchResources(client: Client): Promise<MCPResource[]> {
    try {
      const result = await client.listResources();
      return (result.resources || []).map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));
    } catch {
      return [];
    }
  }

  // 상태 업데이트 헬퍼
  private updateState(
    serverId: string,
    updates: Partial<MCPConnectionState>
  ): void {
    const current = this.connectionStates.get(serverId) || {
      serverId,
      status: "disconnected" as const,
      tools: [],
      prompts: [],
      resources: [],
    };
    this.connectionStates.set(serverId, { ...current, ...updates });
  }
}

// 싱글톤 인스턴스 (서버 사이드에서만 사용)
let instance: MCPClientManager | null = null;

export function getMCPClientManager(): MCPClientManager {
  if (!instance) {
    instance = new MCPClientManager();
  }
  return instance;
}

export { MCPClientManager };

