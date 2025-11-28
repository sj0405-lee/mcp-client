"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Play, Loader2, Copy, Check } from "lucide-react";
import { MCPPrompt, PromptResult } from "@/lib/mcp/types";

interface PromptExecutorProps {
  prompt: MCPPrompt;
  serverId: string;
}

export function PromptExecutor({ prompt, serverId }: PromptExecutorProps) {
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/mcp/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          promptName: prompt.name,
          arguments: args,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Prompt 실행 실패");
      }

      const data: PromptResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;

    const text = result.messages
      .map((m) => `[${m.role}]\n${m.content.text || ""}`)
      .join("\n\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold">{prompt.name}</h4>
        {prompt.description && (
          <p className="text-sm text-muted-foreground">{prompt.description}</p>
        )}
      </div>

      {/* 인자 입력 */}
      {prompt.arguments && prompt.arguments.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium">Arguments</h5>
          {prompt.arguments.map((arg) => (
            <div key={arg.name} className="space-y-1">
              <label className="text-sm">
                {arg.name}
                {arg.required && <span className="text-destructive">*</span>}
              </label>
              <Input
                value={args[arg.name] || ""}
                onChange={(e) =>
                  setArgs((prev) => ({ ...prev, [arg.name]: e.target.value }))
                }
                placeholder={arg.description || arg.name}
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

      {/* 오류 */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <p className="text-destructive text-sm">{error}</p>
        </Card>
      )}

      {/* 결과 */}
      {result && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-medium">결과</h5>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {result.description && (
            <p className="text-sm text-muted-foreground mb-3">
              {result.description}
            </p>
          )}

          <div className="space-y-3">
            {result.messages.map((message, i) => (
              <div
                key={i}
                className={`p-3 rounded ${
                  message.role === "user"
                    ? "bg-primary/10"
                    : "bg-muted"
                }`}
              >
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {message.role === "user" ? "User" : "Assistant"}
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {message.content.text}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

