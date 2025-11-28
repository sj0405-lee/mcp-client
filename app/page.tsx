"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Copy, Check, PanelLeftClose, PanelLeft, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatSidebar } from "@/components/chat-sidebar";
import { MCPStatusIndicator } from "@/components/mcp/mcp-status-indicator";
import { MCPToolsToggle } from "@/components/mcp/mcp-tools-toggle";
import { ToolCallsList } from "@/components/mcp/tool-call-display";
import { Message, ChatSession, ToolCall, ToolCallResult } from "@/lib/types";
import {
  getSessions,
  getMessages,
  createSession,
  updateSessionTitle,
  deleteSession,
  saveMessages,
  migrateFromLocalStorage,
} from "@/lib/chat-storage";

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [useMCPTools, setUseMCPTools] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 초기화: localStorage 마이그레이션 후 세션 로드
  useEffect(() => {
    const initialize = async () => {
      await migrateFromLocalStorage();
      const loadedSessions = await getSessions();
      setSessions(loadedSessions);

      if (loadedSessions.length > 0) {
        setCurrentSessionId(loadedSessions[0].id);
      }

      setIsInitialized(true);
    };

    initialize();
  }, []);

  // 현재 세션의 메시지 로드
  useEffect(() => {
    if (!isInitialized) return;

    const loadMessages = async () => {
      if (currentSessionId) {
        const loadedMessages = await getMessages(currentSessionId);
        setMessages(loadedMessages);
      } else {
        setMessages([]);
      }
    };

    loadMessages();
  }, [currentSessionId, isInitialized]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createNewChat = useCallback(async () => {
    const sessionId = Date.now().toString();
    const newSession: ChatSession = {
      id: sessionId,
      title: "새로운 채팅",
      createdAt: Date.now(),
    };

    await createSession(newSession);
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(sessionId);
    setMessages([]);
    setInput("");
  }, []);

  const loadChat = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  const handleDeleteChat = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);

      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);

        if (currentSessionId === sessionId) {
          if (remaining.length > 0) {
            setCurrentSessionId(remaining[0].id);
          } else {
            setCurrentSessionId(null);
            setMessages([]);
          }
        }

        return remaining;
      });
    },
    [currentSessionId]
  );

  const handleUpdateSessionTitle = useCallback(
    async (sessionId: string, title: string) => {
      await updateSessionTitle(sessionId, title);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
      );
    },
    []
  );

  // MCP 도구와 함께 SSE 스트리밍 처리
  const handleMCPToolsResponse = async (
    response: Response,
    newMessages: Message[],
    sessionId: string
  ) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    let assistantMessage = "";
    const toolCalls: ToolCall[] = [];
    const toolResults: ToolCallResult[] = [];

    let buffer = "";

    // 실시간 UI 업데이트 함수
    const updateUI = () => {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: assistantMessage,
          toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
          toolResults: toolResults.length > 0 ? [...toolResults] : undefined,
        },
      ]);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 이벤트 파싱 (이벤트는 빈 줄로 구분됨)
      const events = buffer.split("\n\n");
      buffer = events.pop() || ""; // 마지막은 불완전할 수 있음

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;

        const lines = eventBlock.split("\n");
        let eventType = "";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            dataLines.push(line.slice(6));
          }
        }

        if (!eventType || dataLines.length === 0) continue;

        const data = dataLines.join("");
        console.log("[SSE] Event:", eventType, "Data length:", data.length);

        try {
          const parsed = JSON.parse(data);

            switch (eventType) {
              case "tools_available":
                console.log("Available tools:", parsed.tools);
                break;

              case "tool_call": {
                // 도구 호출 정보
                console.log("[SSE] tool_call received:", parsed);
                const newToolCall: ToolCall = {
                  id: parsed.id,
                  name: parsed.name,
                  args: parsed.args,
                  serverId: parsed.serverId,
                  serverName: parsed.serverName,
                };
                toolCalls.push(newToolCall);
                updateUI();
                break;
              }

              case "tool_result": {
                // 도구 실행 결과 (이미지 데이터 포함)
                console.log("[SSE] tool_result received:", {
                  name: parsed.name,
                  hasContents: !!parsed.contents,
                  contentsLength: parsed.contents?.length,
                  contentTypes: parsed.contents?.map((c: { type: string }) => c.type),
                  imageDataLengths: parsed.contents
                    ?.filter((c: { type: string }) => c.type === "image")
                    .map((c: { data?: string }) => c.data?.length || 0),
                });
                const newResult: ToolCallResult = {
                  toolCallId: parsed.toolCallId,
                  name: parsed.name,
                  result: parsed.result,
                  contents: parsed.contents, // 이미지 데이터 포함
                  isError: parsed.isError,
                };
                toolResults.push(newResult);
                console.log("[SSE] toolResults updated:", toolResults.length, "results");
                updateUI();
                break;
              }

              case "text":
                // 텍스트 응답
                assistantMessage = parsed.content;
                updateUI();
                break;

              case "error":
                throw new Error(parsed.message);

              case "done":
                // 완료
                break;
            }
        } catch (e) {
          if (eventType !== "done") {
            console.error("SSE parse error for event:", eventType, "error:", e);
            console.error("Data preview:", data.slice(0, 500));
          }
        }
      }
    }

    // 최종 메시지 저장
    const finalMessages: Message[] = [
      ...newMessages,
      {
        role: "assistant",
        content: assistantMessage,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      },
    ];
    await saveMessages(sessionId, finalMessages);
  };

  // 일반 스트리밍 처리
  const handlePlainTextResponse = async (
    response: Response,
    newMessages: Message[],
    sessionId: string
  ) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantMessage += chunk;

        setMessages([
          ...newMessages,
          { role: "assistant", content: assistantMessage },
        ]);
      }

      const finalMessages: Message[] = [
        ...newMessages,
        { role: "assistant", content: assistantMessage },
      ];
      await saveMessages(sessionId, finalMessages);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: sessionId,
        title: "새로운 채팅",
        createdAt: Date.now(),
      };
      await createSession(newSession);
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
    }

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    if (messages.length === 0 && sessionId) {
      const title = input.trim().slice(0, 30) || "새로운 채팅";
      await handleUpdateSessionTitle(sessionId, title);
    }

    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          useMCPTools,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const contentType = response.headers.get("Content-Type") || "";

      if (contentType.includes("text/event-stream")) {
        await handleMCPToolsResponse(response, newMessages, sessionId);
      } else {
        await handlePlainTextResponse(response, newMessages, sessionId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessages: Message[] = [
        ...newMessages,
        {
          role: "assistant",
          content: `오류가 발생했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        },
      ];
      setMessages(errorMessages);
      await saveMessages(sessionId, errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const CodeBlock = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => {
    const [copied, setCopied] = useState(false);
    const codeString = String(children).replace(/\n$/, "");
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";

    const handleCopy = async () => {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="relative group my-4">
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1a2e]/80 hover:bg-[#1a1a2e] border border-white/10"
            onClick={handleCopy}
            title="코드 복사"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-slate-400" />
            )}
          </Button>
        </div>
        {language && (
          <div className="absolute top-2 left-2 z-10 text-xs text-cyan-400/80 bg-[#1a1a2e]/90 px-2 py-0.5 rounded border border-cyan-500/20 font-mono">
            {language}
          </div>
        )}
        <pre className="bg-[#0d0d1a] rounded-xl p-4 overflow-x-auto pt-10 border border-white/5 shadow-lg shadow-black/20">
          <code className={`${className} text-slate-300 text-sm`}>{children}</code>
        </pre>
      </div>
    );
  };

  // 메시지 렌더링 컴포넌트
  const MessageBubble = ({ msg }: { msg: Message }) => {
    if (msg.role === "user") {
      return (
        <div className="flex justify-end message-enter">
          <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gradient-to-br from-cyan-500/90 to-cyan-600/90 text-white shadow-lg shadow-cyan-500/20">
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-start message-enter">
        <div className="max-w-[85%] space-y-3">
          {/* 도구 호출 표시 */}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <ToolCallsList
              toolCalls={msg.toolCalls}
              toolResults={msg.toolResults}
            />
          )}

          {/* 텍스트 응답 */}
          {msg.content && (
            <div className="rounded-2xl px-4 py-3 bg-[#1a1a2e]/80 border border-white/5 backdrop-blur-sm">
              <div className="max-w-none break-words text-slate-200">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = !match;

                      if (isInline) {
                        return (
                          <code
                            className="bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded text-sm font-mono border border-cyan-500/20"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      return (
                        <CodeBlock className={className} {...props}>
                          {children}
                        </CodeBlock>
                      );
                    },
                    p: ({ children }) => (
                      <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-3 space-y-1.5 text-slate-300">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-3 space-y-1.5 text-slate-300">
                        {children}
                      </ol>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-xl font-bold mb-3 mt-5 first:mt-0 text-white">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-white">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-white">
                        {children}
                      </h3>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-cyan-500/50 pl-4 italic my-3 text-slate-400">
                        {children}
                      </blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 underline decoration-cyan-400/30 hover:decoration-cyan-400 transition-colors"
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-3 rounded-lg border border-white/10">
                        <table className="min-w-full">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border-b border-white/10 px-3 py-2 bg-white/5 font-semibold text-left text-slate-200">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border-b border-white/5 px-3 py-2 text-slate-300">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 타이핑 인디케이터
  const TypingIndicator = () => (
    <div className="flex justify-start">
      <div className="bg-[#1a1a2e]/80 border border-white/5 rounded-2xl px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot" />
        </div>
      </div>
    </div>
  );

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background animated-gradient">
        <div className="text-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin mx-auto mb-4" />
            <Sparkles className="w-5 h-5 text-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-slate-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden relative animated-gradient noise-overlay">
      {/* 배경 효과 */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      {/* 사이드바 */}
      <div
        className={`${
          isSidebarOpen ? "w-80 border-r" : "w-0"
        } shrink-0 hidden md:flex flex-col border-white/5 relative z-10 bg-[#0a0a14]/90 backdrop-blur-xl transition-all duration-300 overflow-hidden`}
      >
        {isSidebarOpen && (
          <ChatSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onNewChat={createNewChat}
            onSelectSession={loadChat}
            onDeleteSession={handleDeleteChat}
          />
        )}
      </div>

      {/* 사이드바 토글 버튼 */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`hidden md:flex absolute top-4 z-20 h-8 w-8 rounded-full shadow-lg bg-[#1a1a2e]/90 border border-white/10 hover:bg-[#252538] hover:border-cyan-500/30 transition-all duration-300 ${
          isSidebarOpen ? "-translate-x-1/2 left-80" : "left-4"
        }`}
        title={isSidebarOpen ? "사이드바 접기" : "사이드바 펼치기"}
      >
        {isSidebarOpen ? (
          <PanelLeftClose className="h-4 w-4 text-slate-400" />
        ) : (
          <PanelLeft className="h-4 w-4 text-slate-400" />
        )}
      </Button>

      {/* 메인 채팅 영역 */}
      <div className="flex flex-col flex-1 min-w-0 relative z-0">
        {/* Header */}
        <div className="shrink-0 border-b border-white/5 bg-[#0d0d1a]/80 backdrop-blur-xl">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-white">Shine Muscat AI</h1>
            </div>
            <div className="flex items-center gap-2">
              <MCPToolsToggle enabled={useMCPTools} onToggle={setUseMCPTools} />
              <MCPStatusIndicator />
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6 border border-white/10">
                  <Sparkles className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">무엇을 도와드릴까요?</h2>
                <p className="text-slate-400 mb-4">메시지를 입력하여 대화를 시작하세요.</p>
                {useMCPTools && (
                  <div className="inline-flex items-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-glow" />
                    MCP 도구 활성화됨
                  </div>
                )}
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble key={idx} msg={msg} />
              ))
            )}

            {/* 로딩 중 표시 (도구 호출이 없을 때만) */}
            {isLoading && messages.length > 0 && !messages[messages.length - 1]?.toolCalls?.length && (
              <TypingIndicator />
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 border-t border-white/5 bg-[#0d0d1a]/80 backdrop-blur-xl">
          <div className="px-4 py-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-3 items-center bg-[#1a1a2e]/80 rounded-2xl border border-white/10 p-2 focus-within:border-cyan-500/50 focus-within:shadow-lg focus-within:shadow-cyan-500/10 transition-all">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    useMCPTools
                      ? "MCP 도구를 사용하여 질문하세요..."
                      : "메시지를 입력하세요..."
                  }
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-slate-500 text-base"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
