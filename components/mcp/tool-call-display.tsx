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
      return <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />;
    }
    if (result?.isError) {
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
    if (result) {
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    }
    return <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />;
  };

  const getStatusText = () => {
    if (isLoading) return "실행 중...";
    if (result?.isError) return "오류 발생";
    if (result) return "완료";
    return "실행 중...";
  };

  const getStatusColor = () => {
    if (result?.isError) return "border-l-red-500";
    if (result) return "border-l-emerald-500";
    return "border-l-cyan-500";
  };

  // 이미지 컨텐츠 확인
  const imageContents = result?.contents?.filter((c) => c.type === "image") || [];
  const textContents = result?.contents?.filter((c) => c.type === "text") || [];
  const hasImages = imageContents.length > 0;

  return (
    <Card
      className={`my-2 overflow-hidden border-l-4 ${getStatusColor()} bg-[#1a1a2e]/60 border-white/5 backdrop-blur-sm`}
    >
      <div className="p-3">
        {/* 헤더 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/10 rounded-md"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </Button>

          <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center">
            <Wrench className="h-3.5 w-3.5 text-cyan-400" />
          </div>

          <span className="font-mono text-sm font-semibold text-cyan-400">
            {toolCall.name}
          </span>

          {toolCall.serverName && (
            <span className="flex items-center gap-1 text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
              <Server className="h-3 w-3" />
              {toolCall.serverName}
            </span>
          )}

          {hasImages && (
            <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
              <ImageIcon className="h-3 w-3" />
              이미지 {imageContents.length}개
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {getStatusIcon()}
            <span className="text-xs text-slate-400">
              {getStatusText()}
            </span>
          </div>
        </div>

        {/* 확장된 내용 */}
        {isExpanded && (
          <div className="mt-3 space-y-3 text-sm">
            {/* 입력 매개변수 */}
            <div className="bg-[#0d0d1a]/80 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-2">
                <ArrowRight className="h-3 w-3 text-cyan-400" />
                <span>입력 매개변수</span>
              </div>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono text-slate-300 bg-white/5 p-2 rounded-lg">
                {Object.keys(toolCall.args || {}).length > 0
                  ? JSON.stringify(toolCall.args, null, 2)
                  : "(매개변수 없음)"}
              </pre>
            </div>

            {/* 반환값 (Result) - 이미지와 텍스트 모두 포함 */}
            {result && (
              <div
                className={`rounded-xl p-3 border ${
                  result.isError
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-emerald-500/10 border-emerald-500/20"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-medium mb-2">
                  <ArrowLeft
                    className={`h-3 w-3 ${result.isError ? "text-red-400" : "text-emerald-400"}`}
                  />
                  <span
                    className={
                      result.isError
                        ? "text-red-400"
                        : "text-emerald-400"
                    }
                  >
                    {result.isError ? "오류 결과" : "반환값"}
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
                            className="rounded-xl max-w-full h-auto shadow-lg border border-white/10"
                            style={{ maxHeight: "500px" }}
                          />
                        ) : img.data && img.mimeType ? (
                          // base64 이미지 (아직 저장 전)
                          <img
                            src={`data:${img.mimeType};base64,${img.data}`}
                            alt={`Generated image ${idx + 1}`}
                            className="rounded-xl max-w-full h-auto shadow-lg border border-white/10"
                            style={{ maxHeight: "500px" }}
                          />
                        ) : (
                          <div className="text-xs text-slate-500">
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
                    className={`text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono p-2 rounded-lg ${
                      result.isError
                        ? "bg-red-500/10 text-red-300"
                        : "bg-emerald-500/10 text-emerald-300"
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
              <div className="bg-cyan-500/10 rounded-xl p-3 border border-cyan-500/20">
                <div className="flex items-center gap-2 text-xs text-cyan-400">
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
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
        <div className="w-5 h-5 rounded-md bg-cyan-500/20 flex items-center justify-center">
          <Wrench className="h-3 w-3 text-cyan-400" />
        </div>
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
