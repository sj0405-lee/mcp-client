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
      variant="ghost"
      size="sm"
      className={`gap-2 rounded-xl border transition-all ${
        enabled && !isDisabled
          ? "bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:from-cyan-500/30 hover:to-cyan-500/20"
          : "text-slate-500 border-transparent hover:text-slate-400 hover:bg-white/5 hover:border-white/10"
      }`}
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
          <X className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-red-400" />
        </div>
      )}
      <span className="hidden sm:inline text-sm">
        {isDisabled ? "도구 없음" : `도구 ${toolCount}개`}
      </span>
    </Button>
  );
}
