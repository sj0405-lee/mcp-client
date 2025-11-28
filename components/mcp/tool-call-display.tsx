"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
} from "lucide-react";
import { ToolCall, ToolCallResult } from "@/lib/types";

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  result?: ToolCallResult;
  isLoading?: boolean;
}

export function ToolCallDisplay({
  toolCall,
  result,
  isLoading,
}: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (result?.isError) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (result) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return "실행 중...";
    if (result?.isError) return "오류 발생";
    if (result) return "완료";
    return "실행 중...";
  };

  const getStatusColor = () => {
    if (result?.isError) return "border-l-red-500";
    if (result) return "border-l-green-500";
    return "border-l-blue-500";
  };

  // 이미지 컨텐츠 확인
  const imageContents = result?.contents?.filter((c) => c.type === "image") || [];
  const textContents = result?.contents?.filter((c) => c.type === "text") || [];
  const hasImages = imageContents.length > 0;

  return (
    <Card
      className={`my-2 overflow-hidden border-l-4 ${getStatusColor()} bg-muted/30`}
    >
      <div className="p-3">
        {/* 헤더 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>

          <Wrench className="h-4 w-4 text-blue-500" />

          <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
            {toolCall.name}
          </span>

          {toolCall.serverName && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              <Server className="h-3 w-3" />
              {toolCall.serverName}
            </span>
          )}

          {hasImages && (
            <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded">
              <ImageIcon className="h-3 w-3" />
              이미지 {imageContents.length}개
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {getStatusIcon()}
            <span className="text-xs text-muted-foreground">
              {getStatusText()}
            </span>
          </div>
        </div>

        {/* 확장된 내용 */}
        {isExpanded && (
          <div className="mt-3 space-y-3 text-sm">
            {/* 입력 매개변수 */}
            <div className="bg-background rounded-lg p-3 border">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <ArrowRight className="h-3 w-3 text-blue-500" />
                <span>입력 매개변수 (Arguments)</span>
              </div>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded">
                {Object.keys(toolCall.args || {}).length > 0
                  ? JSON.stringify(toolCall.args, null, 2)
                  : "(매개변수 없음)"}
              </pre>
            </div>

            {/* 반환값 (Result) - 이미지와 텍스트 모두 포함 */}
            {result && (
              <div
                className={`rounded-lg p-3 border ${
                  result.isError
                    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                    : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-medium mb-2">
                  <ArrowLeft
                    className={`h-3 w-3 ${result.isError ? "text-red-500" : "text-green-500"}`}
                  />
                  <span
                    className={
                      result.isError
                        ? "text-red-700 dark:text-red-300"
                        : "text-green-700 dark:text-green-300"
                    }
                  >
                    {result.isError ? "오류 결과" : "반환값 (Result)"}
                  </span>
                </div>

                {/* 이미지가 있으면 이미지 먼저 표시 */}
                {hasImages && (
                  <div className="mb-3 space-y-2">
                    {imageContents.map((img, idx) => (
                      <div key={idx} className="relative">
                        {img.url ? (
                          // Storage URL로 저장된 이미지
                          <img
                            src={img.url}
                            alt={`Generated image ${idx + 1}`}
                            className="rounded-lg max-w-full h-auto shadow-md border"
                            style={{ maxHeight: "500px" }}
                          />
                        ) : img.data && img.mimeType ? (
                          // base64 이미지 (아직 저장 전)
                          <img
                            src={`data:${img.mimeType};base64,${img.data}`}
                            alt={`Generated image ${idx + 1}`}
                            className="rounded-lg max-w-full h-auto shadow-md border"
                            style={{ maxHeight: "500px" }}
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            이미지 데이터 없음 (type: {img.type}, mimeType: {img.mimeType}, hasData: {String(!!img.data)})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 텍스트 결과 */}
                {(textContents.length > 0 || result.result) && (
                  <pre
                    className={`text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono p-2 rounded ${
                      result.isError
                        ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                        : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                    }`}
                  >
                    {textContents.length > 0
                      ? textContents.map((t) => t.text).join("\n")
                      : result.result || "(빈 결과)"}
                  </pre>
                )}
              </div>
            )}

            {/* 로딩 중 표시 */}
            {isLoading && !result && (
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-900">
                <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>MCP 서버에서 도구를 실행하고 있습니다...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// 여러 도구 호출을 표시하는 컴포넌트
interface ToolCallsListProps {
  toolCalls: ToolCall[];
  toolResults?: ToolCallResult[];
  isLoading?: boolean;
}

export function ToolCallsList({
  toolCalls,
  toolResults = [],
  isLoading,
}: ToolCallsListProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Wrench className="h-3.5 w-3.5" />
        <span>MCP 도구 호출 ({toolCalls.length}개)</span>
      </div>
      {toolCalls.map((toolCall, index) => {
        const result = toolResults.find((r) => r.toolCallId === toolCall.id);
        const isCallLoading = isLoading && !result;

        return (
          <ToolCallDisplay
            key={toolCall.id || index}
            toolCall={toolCall}
            result={result}
            isLoading={isCallLoading}
          />
        );
      })}
    </div>
  );
}
