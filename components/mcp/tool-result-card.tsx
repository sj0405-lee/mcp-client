"use client";

import { Card } from "@/components/ui/card";
import { Wrench, CheckCircle2, AlertCircle } from "lucide-react";
import { ToolCallResult } from "@/lib/mcp/types";

interface ToolResultCardProps {
  toolName: string;
  serverName: string;
  result: ToolCallResult;
}

export function ToolResultCard({
  toolName,
  serverName,
  result,
}: ToolResultCardProps) {
  return (
    <Card className="p-3 bg-muted/50 border-l-4 border-l-primary">
      <div className="flex items-start gap-2">
        <Wrench className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{toolName}</span>
            <span className="text-xs text-muted-foreground">
              via {serverName}
            </span>
            {result.isError ? (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            )}
          </div>
          <div className="space-y-1">
            {result.content.map((content, i) => (
              <div key={i} className="text-sm">
                {content.type === "text" && content.text && (
                  <pre className="whitespace-pre-wrap text-xs bg-background p-2 rounded overflow-x-auto max-h-48">
                    {content.text.length > 500
                      ? content.text.slice(0, 500) + "..."
                      : content.text}
                  </pre>
                )}
                {content.type === "image" && content.data && (
                  <img
                    src={`data:${content.mimeType || "image/png"};base64,${content.data}`}
                    alt="Tool result"
                    className="max-w-full max-h-48 rounded"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

