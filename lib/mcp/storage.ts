import { MCPServerConfig, MCP_STORAGE_KEY } from "./types";

// 서버 설정 목록 조회
export function getServerConfigs(): MCPServerConfig[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(MCP_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as MCPServerConfig[];
  } catch {
    console.error("Failed to parse MCP server configs");
    return [];
  }
}

// 서버 설정 저장
export function saveServerConfigs(configs: MCPServerConfig[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(configs));
  } catch {
    console.error("Failed to save MCP server configs");
  }
}

// 서버 설정 추가
export function addServerConfig(config: MCPServerConfig): MCPServerConfig[] {
  const configs = getServerConfigs();
  const updated = [...configs, config];
  saveServerConfigs(updated);
  return updated;
}

// 서버 설정 수정
export function updateServerConfig(
  id: string,
  updates: Partial<MCPServerConfig>
): MCPServerConfig[] {
  const configs = getServerConfigs();
  const updated = configs.map((c) => (c.id === id ? { ...c, ...updates } : c));
  saveServerConfigs(updated);
  return updated;
}

// 서버 설정 삭제
export function deleteServerConfig(id: string): MCPServerConfig[] {
  const configs = getServerConfigs();
  const updated = configs.filter((c) => c.id !== id);
  saveServerConfigs(updated);
  return updated;
}

// 서버 설정 ID로 조회
export function getServerConfigById(
  id: string
): MCPServerConfig | undefined {
  const configs = getServerConfigs();
  return configs.find((c) => c.id === id);
}

// 설정 내보내기 (JSON 문자열)
export function exportConfigs(): string {
  const configs = getServerConfigs();
  return JSON.stringify(configs, null, 2);
}

// 설정 가져오기 (JSON 문자열 파싱)
export function importConfigs(jsonString: string): MCPServerConfig[] {
  try {
    const configs = JSON.parse(jsonString) as MCPServerConfig[];
    // 기본 유효성 검사
    if (!Array.isArray(configs)) {
      throw new Error("Invalid config format: expected array");
    }
    for (const config of configs) {
      if (!config.id || !config.name || !config.transport) {
        throw new Error("Invalid config: missing required fields");
      }
    }
    saveServerConfigs(configs);
    return configs;
  } catch (error) {
    console.error("Failed to import configs:", error);
    throw error;
  }
}

// 고유 ID 생성
export function generateServerId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

