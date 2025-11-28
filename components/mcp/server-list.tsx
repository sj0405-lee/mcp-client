"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Plug,
  Unplug,
  Trash2,
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { MCPServerConfig, ConnectionStatus } from "@/lib/mcp/types";

interface ServerListProps {
  servers: MCPServerConfig[];
  getStatus: (serverId: string) => ConnectionStatus;
  onConnect: (serverId: string) => void;
  onDisconnect: (serverId: string) => void;
  onDelete: (serverId: string) => void;
  onSelect: (serverId: string) => void;
  selectedServerId?: string | null;
  isLoading?: boolean;
}

export function ServerList({
  servers,
  getStatus,
  onConnect,
  onDisconnect,
  onDelete,
  onSelect,
  selectedServerId,
  isLoading,
}: ServerListProps) {
  if (servers.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p>등록된 MCP 서버가 없습니다.</p>
        <p className="text-sm mt-1">위 폼에서 새 서버를 등록하세요.</p>
      </Card>
    );
  }

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "connecting":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />;
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return "연결됨";
      case "connecting":
        return "연결 중...";
      case "error":
        return "오류";
      default:
        return "연결 안됨";
    }
  };

  const getTransportLabel = (transport: string) => {
    switch (transport) {
      case "stdio":
        return "STDIO";
      case "streamable-http":
        return "HTTP";
      case "sse":
        return "SSE";
      default:
        return transport;
    }
  };

  return (
    <div className="space-y-2">
      {servers.map((server) => {
        const status = getStatus(server.id);
        const isSelected = selectedServerId === server.id;
        const isConnected = status === "connected";

        return (
          <Card
            key={server.id}
            className={`p-4 cursor-pointer transition-colors ${
              isSelected ? "ring-2 ring-primary" : "hover:bg-muted/50"
            }`}
            onClick={() => onSelect(server.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(status)}
                <div>
                  <h4 className="font-medium">{server.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-1.5 py-0.5 bg-muted rounded">
                      {getTransportLabel(server.transport)}
                    </span>
                    <span>{getStatusText(status)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isConnected ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDisconnect(server.id);
                    }}
                    disabled={isLoading}
                    title="연결 해제"
                  >
                    <Unplug className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnect(server.id);
                    }}
                    disabled={isLoading || status === "connecting"}
                    title="연결"
                  >
                    <Plug className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(server.id);
                  }}
                  title="상세 보기"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${server.name}" 서버를 삭제하시겠습니까?`)) {
                      onDelete(server.id);
                    }
                  }}
                  disabled={isLoading}
                  title="삭제"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

