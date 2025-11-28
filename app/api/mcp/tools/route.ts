import { NextRequest, NextResponse } from "next/server";
import { GlobalMCPManager } from "@/lib/mcp/global-manager";

export const runtime = "nodejs";

// Tools 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");

    if (!serverId) {
      return NextResponse.json(
        { error: "Missing required query param: serverId" },
        { status: 400 }
      );
    }

    const tools = await GlobalMCPManager.listTools(serverId);

    return NextResponse.json({ tools });
  } catch (error) {
    console.error("MCP list tools error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list tools",
      },
      { status: 500 }
    );
  }
}

// Tool 실행
export async function POST(request: NextRequest) {
  try {
    const { serverId, toolName, arguments: args } = await request.json();

    if (!serverId || !toolName) {
      return NextResponse.json(
        { error: "Missing required fields: serverId, toolName" },
        { status: 400 }
      );
    }

    const result = await GlobalMCPManager.callTool(serverId, toolName, args || {});

    return NextResponse.json(result);
  } catch (error) {
    console.error("MCP call tool error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to call tool",
      },
      { status: 500 }
    );
  }
}
