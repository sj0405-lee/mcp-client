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
        <Button variant="ghost" size="sm" className="gap-2">
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
        className={`gap-2 ${hasError ? "text-destructive" : ""}`}
      >
        <Server className="h-4 w-4" />
        <span className="hidden sm:inline">MCP</span>
        {connectedCount > 0 ? (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs">{connectedCount}</span>
          </span>
        ) : hasError ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {servers.length}
          </span>
        )}
      </Button>
    </Link>
  );
}

