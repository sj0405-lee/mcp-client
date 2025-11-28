"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import {
  MCPServerConfig,
  MCPConnectionState,
  ConnectionStatus,
} from "@/lib/mcp/types";
import {
  getServerConfigs,
  addServerConfig,
  updateServerConfig,
  deleteServerConfig,
  exportConfigs,
  importConfigs,
  generateServerId,
} from "@/lib/mcp/storage";

interface MCPContextValue {
  // 서버 설정
  servers: MCPServerConfig[];
  addServer: (
    config: Omit<MCPServerConfig, "id">
  ) => MCPServerConfig;
  updateServer: (id: string, updates: Partial<MCPServerConfig>) => void;
  removeServer: (id: string) => void;

  // 연결 상태
  connectionStates: Map<string, MCPConnectionState>;
  getConnectionStatus: (serverId: string) => ConnectionStatus;

  // 연결 관리
  connect: (serverId: string) => Promise<MCPConnectionState>;
  disconnect: (serverId: string) => Promise<void>;

  // 설정 가져오기/내보내기
  exportSettings: () => string;
  importSettings: (json: string) => void;

  // 로딩 상태
  isLoading: boolean;
}

const MCPContext = createContext<MCPContextValue | null>(null);

export function MCPProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [connectionStates, setConnectionStates] = useState<
    Map<string, MCPConnectionState>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // 초기 로드
  useEffect(() => {
    const configs = getServerConfigs();
    setServers(configs);
  }, []);

  // 서버 추가
  const addServer = useCallback(
    (config: Omit<MCPServerConfig, "id">): MCPServerConfig => {
      const newConfig: MCPServerConfig = {
        ...config,
        id: generateServerId(),
      };
      const updated = addServerConfig(newConfig);
      setServers(updated);
      return newConfig;
    },
    []
  );

  // 서버 수정
  const updateServer = useCallback(
    (id: string, updates: Partial<MCPServerConfig>) => {
      const updated = updateServerConfig(id, updates);
      setServers(updated);
    },
    []
  );

  // 서버 삭제
  const removeServer = useCallback(
    async (id: string) => {
      // 연결된 경우 먼저 연결 해제
      const state = connectionStates.get(id);
      if (state?.status === "connected") {
        await disconnect(id);
      }
      const updated = deleteServerConfig(id);
      setServers(updated);
      setConnectionStates((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [connectionStates]
  );

  // 연결 상태 조회
  const getConnectionStatus = useCallback(
    (serverId: string): ConnectionStatus => {
      return connectionStates.get(serverId)?.status || "disconnected";
    },
    [connectionStates]
  );

  // 서버 연결
  const connect = useCallback(
    async (serverId: string): Promise<MCPConnectionState> => {
      const config = servers.find((s) => s.id === serverId);
      if (!config) {
        throw new Error(`Server config not found: ${serverId}`);
      }

      setIsLoading(true);
      setConnectionStates((prev) => {
        const next = new Map(prev);
        next.set(serverId, {
          serverId,
          status: "connecting",
          tools: [],
          prompts: [],
          resources: [],
        });
        return next;
      });

      try {
        const response = await fetch("/api/mcp/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to connect");
        }

        const state: MCPConnectionState = data;
        setConnectionStates((prev) => {
          const next = new Map(prev);
          next.set(serverId, state);
          return next;
        });

        return state;
      } catch (error) {
        const errorState: MCPConnectionState = {
          serverId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          tools: [],
          prompts: [],
          resources: [],
        };
        setConnectionStates((prev) => {
          const next = new Map(prev);
          next.set(serverId, errorState);
          return next;
        });
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [servers]
  );

  // 서버 연결 해제
  const disconnect = useCallback(async (serverId: string): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/mcp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      setConnectionStates((prev) => {
        const next = new Map(prev);
        next.set(serverId, {
          serverId,
          status: "disconnected",
          tools: [],
          prompts: [],
          resources: [],
        });
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 설정 내보내기
  const exportSettings = useCallback((): string => {
    return exportConfigs();
  }, []);

  // 설정 가져오기
  const importSettings = useCallback((json: string): void => {
    const configs = importConfigs(json);
    setServers(configs);
  }, []);

  const value: MCPContextValue = {
    servers,
    addServer,
    updateServer,
    removeServer,
    connectionStates,
    getConnectionStatus,
    connect,
    disconnect,
    exportSettings,
    importSettings,
    isLoading,
  };

  return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>;
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error("useMCP must be used within MCPProvider");
  }
  return context;
}

