import { NextRequest, NextResponse } from "next/server";
import { GlobalMCPManager } from "@/lib/mcp/global-manager";

export const runtime = "nodejs";

// 특정 서버 연결 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");

    if (serverId) {
      const state = GlobalMCPManager.getConnectionState(serverId);
      if (!state) {
        return NextResponse.json(
          { error: "Server not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(state);
    }

    // 모든 연결 상태 반환
    const states = GlobalMCPManager.getAllConnectionStates();
    const tools = GlobalMCPManager.getAllTools();

    return NextResponse.json({ states, tools });
  } catch (error) {
    console.error("MCP status error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 500 }
    );
  }
}
