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
} from "./types";

// Node.js global 객체에 MCP 클라이언트 저장을 위한 타입 확장
declare global {
  // eslint-disable-next-line no-var
  var mcpClients: Map<string, Client> | undefined;
  // eslint-disable-next-line no-var
  var mcpTransports: Map<string, Transport> | undefined;
  // eslint-disable-next-line no-var
  var mcpConnectionStates: Map<string, MCPConnectionState> | undefined;
  // eslint-disable-next-line no-var
  var mcpServerConfigs: Map<string, MCPServerConfig> | undefined;
}

// 전역 Maps 초기화 (Hot Reload 시에도 유지)
function getGlobalClients(): Map<string, Client> {
  if (!global.mcpClients) {
    global.mcpClients = new Map();
  }
  return global.mcpClients;
}

function getGlobalTransports(): Map<string, Transport> {
  if (!global.mcpTransports) {
    global.mcpTransports = new Map();
  }
  return global.mcpTransports;
}

function getGlobalConnectionStates(): Map<string, MCPConnectionState> {
  if (!global.mcpConnectionStates) {
    global.mcpConnectionStates = new Map();
  }
  return global.mcpConnectionStates;
}

function getGlobalServerConfigs(): Map<string, MCPServerConfig> {
  if (!global.mcpServerConfigs) {
    global.mcpServerConfigs = new Map();
  }
  return global.mcpServerConfigs;
}

// Transport 생성
async function createTransport(config: MCPServerConfig): Promise<Transport> {
  switch (config.transport) {
    case "stdio": {
      if (!config.command) {
        throw new Error("STDIO transport requires command");
      }

      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }
      if (config.env) {
        Object.assign(env, config.env);
      }

      console.log(
        `[MCP Global] Connecting via STDIO: ${config.command} ${config.args?.join(" ") || ""}`
      );

      return new StdioClientTransport({
        command: config.command,
        args: config.args || [],
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

// Tools 조회
async function fetchTools(client: Client): Promise<MCPTool[]> {
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

// Prompts 조회
async function fetchPrompts(client: Client): Promise<MCPPrompt[]> {
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

// Resources 조회
async function fetchResources(client: Client): Promise<MCPResource[]> {
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

// 전역 MCP 클라이언트 매니저
export const GlobalMCPManager = {
  // 서버 연결
  async connect(config: MCPServerConfig): Promise<MCPConnectionState> {
    const clients = getGlobalClients();
    const transports = getGlobalTransports();
    const states = getGlobalConnectionStates();
    const configs = getGlobalServerConfigs();

    // 이미 연결된 경우 기존 상태 반환
    if (clients.has(config.id)) {
      const existingState = states.get(config.id);
      if (existingState?.status === "connected") {
        console.log(`[MCP Global] Already connected: ${config.name}`);
        return existingState;
      }
    }

    // 연결 중 상태 설정
    states.set(config.id, {
      serverId: config.id,
      status: "connecting",
      tools: [],
      prompts: [],
      resources: [],
    });

    try {
      const transport = await createTransport(config);
      const client = new Client({
        name: "mcp-client-app",
        version: "1.0.0",
      });

      await client.connect(transport);

      clients.set(config.id, client);
      transports.set(config.id, transport);
      configs.set(config.id, config);

      // capabilities 조회
      const [tools, prompts, resources] = await Promise.all([
        fetchTools(client),
        fetchPrompts(client),
        fetchResources(client),
      ]);

      const state: MCPConnectionState = {
        serverId: config.id,
        status: "connected",
        tools,
        prompts,
        resources,
      };

      states.set(config.id, state);
      console.log(
        `[MCP Global] Connected: ${config.name} (${tools.length} tools)`
      );
      return state;
    } catch (error) {
      console.error(`[MCP Global] Connection failed for ${config.name}:`, error);

      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        if (error.message.includes("Connection closed")) {
          errorMessage = `연결이 종료되었습니다. MCP 서버가 올바르게 설정되었는지 확인하세요.`;
        } else {
          errorMessage = error.message;
        }
      }

      const errorState: MCPConnectionState = {
        serverId: config.id,
        status: "error",
        error: errorMessage,
        tools: [],
        prompts: [],
        resources: [],
      };
      states.set(config.id, errorState);
      throw error;
    }
  },

  // 서버 연결 해제
  async disconnect(serverId: string): Promise<void> {
    const clients = getGlobalClients();
    const transports = getGlobalTransports();
    const states = getGlobalConnectionStates();
    const configs = getGlobalServerConfigs();

    const client = clients.get(serverId);
    const transport = transports.get(serverId);

    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error(`[MCP Global] Error closing client ${serverId}:`, error);
      }
      clients.delete(serverId);
    }

    if (transport) {
      try {
        await transport.close();
      } catch (error) {
        console.error(`[MCP Global] Error closing transport ${serverId}:`, error);
      }
      transports.delete(serverId);
    }

    states.set(serverId, {
      serverId,
      status: "disconnected",
      tools: [],
      prompts: [],
      resources: [],
    });

    configs.delete(serverId);
    console.log(`[MCP Global] Disconnected: ${serverId}`);
  },

  // 클라이언트 가져오기
  getClient(serverId: string): Client | undefined {
    return getGlobalClients().get(serverId);
  },

  // 연결된 모든 클라이언트 가져오기
  getAllConnectedClients(): { serverId: string; client: Client }[] {
    const clients = getGlobalClients();
    const states = getGlobalConnectionStates();

    const result: { serverId: string; client: Client }[] = [];
    for (const [serverId, client] of clients.entries()) {
      const state = states.get(serverId);
      if (state?.status === "connected") {
        result.push({ serverId, client });
      }
    }
    return result;
  },

  // 연결 상태 조회
  getConnectionState(serverId: string): MCPConnectionState | undefined {
    return getGlobalConnectionStates().get(serverId);
  },

  // 모든 연결 상태 조회
  getAllConnectionStates(): MCPConnectionState[] {
    return Array.from(getGlobalConnectionStates().values());
  },

  // 서버 설정 조회
  getServerConfig(serverId: string): MCPServerConfig | undefined {
    return getGlobalServerConfigs().get(serverId);
  },

  // 연결된 서버의 모든 Tools 가져오기
  getAllTools(): { serverId: string; serverName: string; tool: MCPTool }[] {
    const states = getGlobalConnectionStates();
    const configs = getGlobalServerConfigs();

    const result: { serverId: string; serverName: string; tool: MCPTool }[] = [];
    for (const [serverId, state] of states.entries()) {
      if (state.status === "connected") {
        const config = configs.get(serverId);
        const serverName = config?.name || serverId;
        for (const tool of state.tools) {
          result.push({ serverId, serverName, tool });
        }
      }
    }
    return result;
  },

  // Tools 목록 조회
  async listTools(serverId: string): Promise<MCPTool[]> {
    const client = getGlobalClients().get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return fetchTools(client);
  },

  // Tool 실행
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{
    content: {
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }[];
    isError?: boolean;
  }> {
    const client = getGlobalClients().get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    const contentArray = Array.isArray(result.content) ? result.content : [];

    return {
      content: contentArray.map((c) => ({
        type: c.type as "text" | "image" | "resource",
        text: "text" in c ? (c.text as string) : undefined,
        data: "data" in c ? (c.data as string) : undefined,
        mimeType: "mimeType" in c ? (c.mimeType as string) : undefined,
        uri: "uri" in c ? (c.uri as string) : undefined,
      })),
      isError: result.isError as boolean | undefined,
    };
  },

  // Prompts 목록 조회
  async listPrompts(serverId: string): Promise<MCPPrompt[]> {
    const client = getGlobalClients().get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return fetchPrompts(client);
  },

  // Prompt 실행
  async getPrompt(
    serverId: string,
    promptName: string,
    args: Record<string, string>
  ): Promise<{
    description?: string;
    messages: {
      role: "user" | "assistant";
      content: { type: string; text?: string };
    }[];
  }> {
    const client = getGlobalClients().get(serverId);
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
          type: (m.content as { type?: string }).type === "text" ? "text" : "text",
          text:
            (m.content as { text?: string }).text || JSON.stringify(m.content),
        },
      })),
    };
  },

  // Resources 목록 조회
  async listResources(serverId: string): Promise<MCPResource[]> {
    const client = getGlobalClients().get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} is not connected`);
    }
    return fetchResources(client);
  },

  // Resource 읽기
  async readResource(
    serverId: string,
    uri: string
  ): Promise<
    {
      uri: string;
      mimeType?: string;
      text?: string;
      blob?: string;
    }[]
  > {
    const client = getGlobalClients().get(serverId);
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
  },
};

