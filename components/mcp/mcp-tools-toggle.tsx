"use client";

import { useMCP } from "@/contexts/mcp-context";
import { Button } from "@/components/ui/button";
import { Wrench, X } from "lucide-react";

interface MCPToolsToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function MCPToolsToggle({ enabled, onToggle }: MCPToolsToggleProps) {
  const { connectionStates } = useMCP();

  // 연결된 서버 수 계산
  const connectedCount = Array.from(connectionStates.values()).filter(
    (s) => s.status === "connected"
  ).length;

  // 사용 가능한 도구 수 계산
  const toolCount = Array.from(connectionStates.values())
    .filter((s) => s.status === "connected")
    .reduce((sum, s) => sum + s.tools.length, 0);

  // 연결된 서버가 없으면 비활성화
  const isDisabled = connectedCount === 0;

  return (
    <Button
      variant={enabled && !isDisabled ? "default" : "outline"}
      size="sm"
      className="gap-2"
      onClick={() => onToggle(!enabled)}
      disabled={isDisabled}
      title={
        isDisabled
          ? "MCP 서버에 연결하세요"
          : enabled
            ? "MCP 도구 비활성화"
            : "MCP 도구 활성화"
      }
    >
      {enabled && !isDisabled ? (
        <Wrench className="h-4 w-4" />
      ) : (
        <div className="relative">
          <Wrench className="h-4 w-4 opacity-50" />
          <X className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-destructive" />
        </div>
      )}
      <span className="hidden sm:inline">
        {isDisabled ? "도구 없음" : `도구 ${toolCount}개`}
      </span>
    </Button>
  );
}

