"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  MessageSquare,
  FileText,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  MCPServerConfig,
  MCPConnectionState,
  MCPTool,
  MCPPrompt,
  MCPResource,
} from "@/lib/mcp/types";
import { ToolExecutor } from "./tool-executor";
import { PromptExecutor } from "./prompt-executor";
import { ResourceViewer } from "./resource-viewer";

type TabType = "tools" | "prompts" | "resources";

interface ServerDetailsProps {
  server: MCPServerConfig;
  connectionState?: MCPConnectionState;
}

export function ServerDetails({ server, connectionState }: ServerDetailsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("tools");
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<MCPPrompt | null>(null);
  const [selectedResource, setSelectedResource] = useState<MCPResource | null>(
    null
  );

  const isConnected = connectionState?.status === "connected";
  const tools = connectionState?.tools || [];
  const prompts = connectionState?.prompts || [];
  const resources = connectionState?.resources || [];

  const tabs: { id: TabType; label: string; icon: typeof Wrench; count: number }[] =
    [
      { id: "tools", label: "Tools", icon: Wrench, count: tools.length },
      {
        id: "prompts",
        label: "Prompts",
        icon: MessageSquare,
        count: prompts.length,
      },
      {
        id: "resources",
        label: "Resources",
        icon: FileText,
        count: resources.length,
      },
    ];

  if (!isConnected) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">{server.name}</h3>
        <p className="text-muted-foreground text-sm">
          서버에 연결되지 않았습니다.
        </p>
        <p className="text-muted-foreground text-sm">
          연결 버튼을 클릭하여 서버에 연결하세요.
        </p>
        {connectionState?.error && (
          <p className="text-destructive text-sm mt-2">
            오류: {connectionState.error}
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 서버 정보 */}
      <Card className="p-4">
        <h3 className="font-semibold">{server.name}</h3>
        <p className="text-sm text-muted-foreground">
          {server.transport === "stdio"
            ? `${server.command} ${server.args?.join(" ") || ""}`
            : server.url}
        </p>
      </Card>

      {/* 탭 */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            className={`rounded-b-none ${
              activeTab === tab.id
                ? "border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedTool(null);
              setSelectedPrompt(null);
              setSelectedResource(null);
            }}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">
              {tab.count}
            </span>
          </Button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 목록 */}
        <Card className="p-4 max-h-96 overflow-y-auto">
          {activeTab === "tools" && (
            <ItemList
              items={tools}
              selectedId={selectedTool?.name}
              onSelect={(item) => setSelectedTool(item as MCPTool)}
              renderItem={(item: MCPTool) => (
                <>
                  <span className="font-medium">{item.name}</span>
                  {item.description && (
                    <span className="text-xs text-muted-foreground block truncate">
                      {item.description}
                    </span>
                  )}
                </>
              )}
              emptyMessage="사용 가능한 Tool이 없습니다."
            />
          )}

          {activeTab === "prompts" && (
            <ItemList
              items={prompts}
              selectedId={selectedPrompt?.name}
              onSelect={(item) => setSelectedPrompt(item as MCPPrompt)}
              renderItem={(item: MCPPrompt) => (
                <>
                  <span className="font-medium">{item.name}</span>
                  {item.description && (
                    <span className="text-xs text-muted-foreground block truncate">
                      {item.description}
                    </span>
                  )}
                </>
              )}
              emptyMessage="사용 가능한 Prompt가 없습니다."
            />
          )}

          {activeTab === "resources" && (
            <ItemList
              items={resources}
              selectedId={selectedResource?.uri}
              onSelect={(item) => setSelectedResource(item as MCPResource)}
              renderItem={(item: MCPResource) => (
                <>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground block truncate">
                    {item.uri}
                  </span>
                </>
              )}
              emptyMessage="사용 가능한 Resource가 없습니다."
            />
          )}
        </Card>

        {/* 실행/상세 패널 */}
        <Card className="p-4">
          {activeTab === "tools" && selectedTool && (
            <ToolExecutor tool={selectedTool} serverId={server.id} />
          )}

          {activeTab === "prompts" && selectedPrompt && (
            <PromptExecutor prompt={selectedPrompt} serverId={server.id} />
          )}

          {activeTab === "resources" && selectedResource && (
            <ResourceViewer resource={selectedResource} serverId={server.id} />
          )}

          {!selectedTool && !selectedPrompt && !selectedResource && (
            <div className="text-center text-muted-foreground py-8">
              <p>왼쪽 목록에서 항목을 선택하세요.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// 공통 목록 컴포넌트
interface ItemListProps<T> {
  items: T[];
  selectedId?: string;
  onSelect: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  emptyMessage: string;
}

function ItemList<T extends { name?: string; uri?: string }>({
  items,
  selectedId,
  onSelect,
  renderItem,
  emptyMessage,
}: ItemListProps<T>) {
  if (items.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, index) => {
        const id = item.name || item.uri || index.toString();
        const isSelected = selectedId === id;

        return (
          <button
            key={id}
            className={`w-full text-left p-2 rounded flex items-center justify-between transition-colors ${
              isSelected
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted"
            }`}
            onClick={() => onSelect(item)}
          >
            <div className="flex-1 min-w-0">{renderItem(item)}</div>
            <ChevronRight className="h-4 w-4 shrink-0 ml-2" />
          </button>
        );
      })}
    </div>
  );
}

