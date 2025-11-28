"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { TransportType, MCPServerConfig } from "@/lib/mcp/types";

interface ServerFormProps {
  onSubmit: (config: Omit<MCPServerConfig, "id">) => void;
  onCancel?: () => void;
  initialValues?: Partial<MCPServerConfig>;
}

export function ServerForm({
  onSubmit,
  onCancel,
  initialValues,
}: ServerFormProps) {
  const [name, setName] = useState(initialValues?.name || "");
  const [transport, setTransport] = useState<TransportType>(
    initialValues?.transport || "stdio"
  );
  const [command, setCommand] = useState(initialValues?.command || "");
  const [args, setArgs] = useState<string[]>(initialValues?.args || []);
  const [url, setUrl] = useState(initialValues?.url || "");
  const [newArg, setNewArg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const config: Omit<MCPServerConfig, "id"> = {
      name,
      transport,
    };

    if (transport === "stdio") {
      config.command = command;
      config.args = args.filter((a) => a.trim());
    } else {
      config.url = url;
    }

    onSubmit(config);
  };

  const addArg = () => {
    if (newArg.trim()) {
      setArgs([...args, newArg.trim()]);
      setNewArg("");
    }
  };

  const removeArg = (index: number) => {
    setArgs(args.filter((_, i) => i !== index));
  };

  const isValid =
    name.trim() &&
    (transport === "stdio" ? command.trim() : url.trim());

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold mb-4">
          {initialValues ? "서버 수정" : "새 MCP 서버 등록"}
        </h3>

        {/* 서버 이름 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">서버 이름</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: My MCP Server"
          />
        </div>

        {/* Transport 타입 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Transport 타입</label>
          <div className="flex gap-2">
            {(["stdio", "streamable-http", "sse"] as TransportType[]).map(
              (t) => (
                <Button
                  key={t}
                  type="button"
                  variant={transport === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTransport(t)}
                >
                  {t === "stdio"
                    ? "STDIO"
                    : t === "streamable-http"
                      ? "HTTP"
                      : "SSE"}
                </Button>
              )
            )}
          </div>
        </div>

        {/* STDIO 설정 */}
        {transport === "stdio" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Command</label>
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="예: npx, node, python"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Arguments</label>
              <div className="flex gap-2">
                <Input
                  value={newArg}
                  onChange={(e) => setNewArg(e.target.value)}
                  placeholder="인자 추가"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArg();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addArg}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {args.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {args.map((arg, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
                    >
                      {arg}
                      <button
                        type="button"
                        onClick={() => removeArg(i)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* HTTP/SSE 설정 */}
        {(transport === "streamable-http" || transport === "sse") && (
          <div className="space-y-2">
            <label className="text-sm font-medium">URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="예: http://localhost:3000/mcp"
            />
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={!isValid}>
            {initialValues ? "수정" : "등록"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              취소
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

