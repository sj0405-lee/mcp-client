import { NextRequest, NextResponse } from "next/server";
import { getMCPClientManager } from "@/lib/mcp/client-manager";
import { MCPServerConfig } from "@/lib/mcp/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const config: MCPServerConfig = await request.json();

    if (!config.id || !config.name || !config.transport) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, transport" },
        { status: 400 }
      );
    }

    // Transport별 필수 필드 검증
    if (config.transport === "stdio" && !config.command) {
      return NextResponse.json(
        { error: "STDIO transport requires command" },
        { status: 400 }
      );
    }

    if (
      (config.transport === "streamable-http" || config.transport === "sse") &&
      !config.url
    ) {
      return NextResponse.json(
        { error: "HTTP/SSE transport requires url" },
        { status: 400 }
      );
    }

    const manager = getMCPClientManager();
    const state = await manager.connect(config);

    return NextResponse.json(state);
  } catch (error) {
    console.error("MCP connect error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to connect",
      },
      { status: 500 }
    );
  }
}

