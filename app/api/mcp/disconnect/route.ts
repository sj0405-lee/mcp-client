import { NextRequest, NextResponse } from "next/server";
import { getMCPClientManager } from "@/lib/mcp/client-manager";

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

    const manager = getMCPClientManager();
    await manager.disconnect(serverId);

    return NextResponse.json({ success: true, serverId });
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

