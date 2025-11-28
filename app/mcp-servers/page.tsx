"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Download,
  Upload,
  ArrowLeft,
  Server,
} from "lucide-react";
import Link from "next/link";
import { useMCP } from "@/contexts/mcp-context";
import { ServerForm } from "@/components/mcp/server-form";
import { ServerList } from "@/components/mcp/server-list";
import { ServerDetails } from "@/components/mcp/server-details";
import { MCPServerConfig } from "@/lib/mcp/types";

export default function MCPServersPage() {
  const {
    servers,
    addServer,
    removeServer,
    connectionStates,
    getConnectionStatus,
    connect,
    disconnect,
    exportSettings,
    importSettings,
    isLoading,
  } = useMCP();

  const [showForm, setShowForm] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const selectedConnectionState = selectedServerId
    ? connectionStates.get(selectedServerId)
    : undefined;

  const handleAddServer = (config: Omit<MCPServerConfig, "id">) => {
    const newServer = addServer(config);
    setShowForm(false);
    setSelectedServerId(newServer.id);
  };

  const handleConnect = async (serverId: string) => {
    try {
      await connect(serverId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "연결 실패";
      alert(`MCP 서버 연결 실패: ${message}`);
    }
  };

  const handleDisconnect = async (serverId: string) => {
    try {
      await disconnect(serverId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "연결 해제 실패";
      alert(`MCP 서버 연결 해제 실패: ${message}`);
    }
  };

  const handleDelete = async (serverId: string) => {
    await removeServer(serverId);
    if (selectedServerId === serverId) {
      setSelectedServerId(null);
    }
  };

  const handleExport = () => {
    const json = exportSettings();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mcp-servers.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        importSettings(json);
        setSelectedServerId(null);
      } catch (error) {
        alert("설정 파일을 불러오는데 실패했습니다.");
        console.error(error);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Card className="rounded-none border-x-0 border-t-0 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              <h1 className="text-xl font-semibold">MCP 서버 관리</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              내보내기
            </Button>
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" />
              가져오기
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </Card>

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 서버 목록 */}
          <div className="lg:col-span-1 space-y-4">
            {/* 새 서버 추가 버튼 */}
            {!showForm && (
              <Button
                className="w-full"
                onClick={() => setShowForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                새 서버 추가
              </Button>
            )}

            {/* 서버 등록 폼 */}
            {showForm && (
              <ServerForm
                onSubmit={handleAddServer}
                onCancel={() => setShowForm(false)}
              />
            )}

            {/* 서버 목록 */}
            <ScrollArea className="h-[calc(100vh-280px)]">
              <ServerList
                servers={servers}
                getStatus={getConnectionStatus}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onDelete={handleDelete}
                onSelect={setSelectedServerId}
                selectedServerId={selectedServerId}
                isLoading={isLoading}
              />
            </ScrollArea>
          </div>

          {/* 오른쪽: 서버 상세 */}
          <div className="lg:col-span-2">
            {selectedServer ? (
              <ServerDetails
                server={selectedServer}
                connectionState={selectedConnectionState}
              />
            ) : (
              <Card className="p-12 text-center">
                <Server className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">서버를 선택하세요</h3>
                <p className="text-muted-foreground text-sm">
                  왼쪽 목록에서 MCP 서버를 선택하면
                  <br />
                  Tools, Prompts, Resources를 확인할 수 있습니다.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

