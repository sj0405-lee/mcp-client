import { NextRequest, NextResponse } from "next/server";
import { GlobalMCPManager } from "@/lib/mcp/global-manager";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();

    if (!serverId) {
      return NextResponse.json(
        { error: "Missing required field: serverId" },
        { status: 400 }
      );
    }

    await GlobalMCPManager.disconnect(serverId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MCP disconnect error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to disconnect",
      },
      { status: 500 }
    );
  }
}
