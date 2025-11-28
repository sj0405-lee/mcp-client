import { NextRequest, NextResponse } from "next/server";
import { getMCPClientManager } from "@/lib/mcp/client-manager";

export const runtime = "nodejs";

// Prompts 목록 조회
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

    const manager = getMCPClientManager();
    const prompts = await manager.listPrompts(serverId);

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("MCP list prompts error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list prompts",
      },
      { status: 500 }
    );
  }
}

// Prompt 실행
export async function POST(request: NextRequest) {
  try {
    const { serverId, promptName, arguments: args } = await request.json();

    if (!serverId || !promptName) {
      return NextResponse.json(
        { error: "Missing required fields: serverId, promptName" },
        { status: 400 }
      );
    }

    const manager = getMCPClientManager();
    const result = await manager.getPrompt(serverId, promptName, args || {});

    return NextResponse.json(result);
  } catch (error) {
    console.error("MCP get prompt error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get prompt",
      },
      { status: 500 }
    );
  }
}

