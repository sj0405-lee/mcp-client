"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, Loader2, Copy, Check } from "lucide-react";
import { MCPResource, ResourceContent } from "@/lib/mcp/types";

interface ResourceViewerProps {
  resource: MCPResource;
  serverId: string;
}

export function ResourceViewer({ resource, serverId }: ResourceViewerProps) {
  const [contents, setContents] = useState<ResourceContent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRead = async () => {
    setIsLoading(true);
    setError(null);
    setContents(null);

    try {
      const response = await fetch("/api/mcp/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId,
          uri: resource.uri,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Resource 읽기 실패");
      }

      const data = await response.json();
      setContents(data.contents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!contents) return;

    const text = contents.map((c) => c.text || c.blob || "").join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold">{resource.name}</h4>
        <p className="text-sm text-muted-foreground break-all">{resource.uri}</p>
        {resource.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {resource.description}
          </p>
        )}
        {resource.mimeType && (
          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-muted rounded">
            {resource.mimeType}
          </span>
        )}
      </div>

      {/* 읽기 버튼 */}
      <Button onClick={handleRead} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            읽는 중...
          </>
        ) : (
          <>
            <Eye className="h-4 w-4 mr-2" />
            읽기
          </>
        )}
      </Button>

      {/* 오류 */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <p className="text-destructive text-sm">{error}</p>
        </Card>
      )}

      {/* 컨텐츠 */}
      {contents && contents.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-medium">내용</h5>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="space-y-2">
            {contents.map((content, i) => (
              <div key={i}>
                {content.text && (
                  <pre className="whitespace-pre-wrap bg-muted p-3 rounded text-xs overflow-x-auto max-h-96">
                    {content.text}
                  </pre>
                )}
                {content.blob && (
                  <div className="bg-muted p-3 rounded">
                    {content.mimeType?.startsWith("image/") ? (
                      <img
                        src={`data:${content.mimeType};base64,${content.blob}`}
                        alt={resource.name}
                        className="max-w-full rounded"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Binary data ({content.mimeType || "unknown type"})
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

