"use client";

import { useMCP } from "@/contexts/mcp-context";
import { Button } from "@/components/ui/button";
import { Server, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export function MCPStatusIndicator() {
  const { servers, connectionStates } = useMCP();

  const connectedCount = Array.from(connectionStates.values()).filter(
    (s) => s.status === "connected"
  ).length;

  const hasError = Array.from(connectionStates.values()).some(
    (s) => s.status === "error"
  );

  if (servers.length === 0) {
    return (
      <Link href="/mcp-servers">
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-all"
        >
          <Server className="h-4 w-4" />
          <span className="hidden sm:inline">MCP 서버 설정</span>
        </Button>
      </Link>
    );
  }

  return (
    <Link href="/mcp-servers">
      <Button
        variant="ghost"
        size="sm"
        className={`gap-2 rounded-xl border transition-all ${
          hasError 
            ? "text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20" 
            : connectedCount > 0
              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10"
        }`}
      >
        <Server className="h-4 w-4" />
        <span className="hidden sm:inline">MCP</span>
        {connectedCount > 0 ? (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{connectedCount}</span>
          </span>
        ) : hasError ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <span className="text-xs text-slate-500">
            {servers.length}
          </span>
        )}
      </Button>
    </Link>
  );
}
