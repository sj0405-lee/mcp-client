import { NextRequest, NextResponse } from "next/server";
import { GlobalMCPManager } from "@/lib/mcp/global-manager";

export const runtime = "nodejs";

// Resources 목록 조회
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

    const resources = await GlobalMCPManager.listResources(serverId);

    return NextResponse.json({ resources });
  } catch (error) {
    console.error("MCP list resources error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list resources",
      },
      { status: 500 }
    );
  }
}

// Resource 읽기
export async function POST(request: NextRequest) {
  try {
    const { serverId, uri } = await request.json();

    if (!serverId || !uri) {
      return NextResponse.json(
        { error: "Missing required fields: serverId, uri" },
        { status: 400 }
      );
    }

    const contents = await GlobalMCPManager.readResource(serverId, uri);

    return NextResponse.json({ contents });
  } catch (error) {
    console.error("MCP read resource error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read resource",
      },
      { status: 500 }
    );
  }
}
