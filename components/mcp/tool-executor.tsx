"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Play, Loader2 } from "lucide-react";
import { MCPTool, ToolCallResult } from "@/lib/mcp/types";

interface ToolExecutorProps {
  tool: MCPTool;
  serverId: string;
}

export function ToolExecutor({ tool, serverId }: ToolExecutorProps) {
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ToolCallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // inputSchema에서 필드 추출
  const properties =
    (tool.inputSchema?.properties as Record<
      string,
      { type?: string; description?: string }
    >) || {};
  const required = (tool.inputSchema?.required as string[]) || [];

  const handleExecute = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 인자 타입 변환
      const typedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        const propType = properties[key]?.type;
        if (propType === "number" || propType === "integer") {
          typedArgs[key] = Number(value);
        } else if (propType === "boolean") {
          typedArgs[key] = value === "true";
        } else if (propType === "object" || propType === "array") {
          try {
            typedArgs[key] = JSON.parse(value);
          } catch {
            typedArgs[key] = value;
          }
        } else {
          typedArgs[key] = value;
        }
      }

      const response = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          toolName: tool.name,
          arguments: typedArgs,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Tool 실행 실패");
      }

      const data: ToolCallResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold">{tool.name}</h4>
        {tool.description && (
          <p className="text-sm text-muted-foreground">{tool.description}</p>
        )}
      </div>

      {/* 인자 입력 */}
      {Object.keys(properties).length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium">Arguments</h5>
          {Object.entries(properties).map(([key, prop]) => (
            <div key={key} className="space-y-1">
              <label className="text-sm">
                {key}
                {required.includes(key) && (
                  <span className="text-destructive">*</span>
                )}
                {prop.type && (
                  <span className="text-muted-foreground ml-1">
                    ({prop.type})
                  </span>
                )}
              </label>
              <Input
                value={args[key] || ""}
                onChange={(e) =>
                  setArgs((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={prop.description || key}
              />
            </div>
          ))}
        </div>
      )}

      {/* 실행 버튼 */}
      <Button onClick={handleExecute} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            실행 중...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            실행
          </>
        )}
      </Button>

      {/* 결과 */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <p className="text-destructive text-sm">{error}</p>
        </Card>
      )}

      {result && (
        <Card className="p-4">
          <h5 className="text-sm font-medium mb-2">결과</h5>
          <div className="space-y-2">
            {result.content.map((content, i) => (
              <div key={i} className="text-sm">
                {content.type === "text" && (
                  <pre className="whitespace-pre-wrap bg-muted p-2 rounded text-xs overflow-x-auto">
                    {content.text}
                  </pre>
                )}
                {content.type === "image" && content.data && (
                  <img
                    src={`data:${content.mimeType || "image/png"};base64,${content.data}`}
                    alt="Tool result"
                    className="max-w-full rounded"
                  />
                )}
                {content.type === "resource" && (
                  <p className="text-muted-foreground">
                    Resource: {content.uri}
                  </p>
                )}
              </div>
            ))}
          </div>
          {result.isError && (
            <p className="text-destructive text-sm mt-2">
              Tool 실행 중 오류가 발생했습니다.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

