"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Send, Copy, Check, PanelLeftClose, PanelLeft } from "lucide-react";
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
        let dataLines: string[] = [];

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
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
            onClick={handleCopy}
            title="코드 복사"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        {language && (
          <div className="absolute top-2 left-2 z-10 text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded border border-border">
            {language}
          </div>
        )}
        <pre className="bg-[#1e1e1e] dark:bg-[#0d1117] text-[#d4d4d4] rounded-lg p-4 overflow-x-auto pt-8">
          <code className={className}>{children}</code>
        </pre>
      </div>
    );
  };

  // 메시지 렌더링 컴포넌트
  const MessageBubble = ({ msg }: { msg: Message }) => {
    if (msg.role === "user") {
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-lg px-4 py-2 bg-primary text-primary-foreground">
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] space-y-2">
          {/* 도구 호출 표시 */}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <ToolCallsList
              toolCalls={msg.toolCalls}
              toolResults={msg.toolResults}
            />
          )}

          {/* 텍스트 응답 */}
          {msg.content && (
            <div className="rounded-lg px-4 py-2 bg-muted">
              <div className="max-w-none break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = !match;

                      if (isInline) {
                        return (
                          <code
                            className="bg-muted-foreground/20 text-foreground px-1 py-0.5 rounded text-sm font-mono"
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
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-2 space-y-1">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2 space-y-1">
                        {children}
                      </ol>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-lg font-semibold mb-2 mt-3 first:mt-0">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-base font-semibold mb-1 mt-2 first:mt-0">
                        {children}
                      </h3>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic my-2">
                        {children}
                      </blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:text-primary/80"
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-2">
                        <table className="min-w-full border-collapse border border-border">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border px-2 py-1 bg-muted font-semibold text-left">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-2 py-1">
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

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* 사이드바 */}
      <div
        className={`${
          isSidebarOpen ? "w-80 border-r" : "w-0"
        } shrink-0 hidden md:flex flex-col border-border relative z-10 bg-background transition-all duration-300 overflow-hidden`}
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
        className={`hidden md:flex absolute top-4 z-20 h-8 w-8 rounded-full shadow-md bg-background border-2 hover:bg-accent transition-all duration-300 ${
          isSidebarOpen ? "-translate-x-1/2 left-80" : "left-0"
        }`}
        title={isSidebarOpen ? "사이드바 접기" : "사이드바 펼치기"}
      >
        {isSidebarOpen ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeft className="h-4 w-4" />
        )}
      </Button>

      {/* 메인 채팅 영역 */}
      <div className="flex flex-col flex-1 min-w-0 bg-background relative z-0">
        {/* Header */}
        <Card className="rounded-none border-x-0 border-t-0 shadow-sm shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">AI 채팅</h1>
            <div className="flex items-center gap-2">
              <MCPToolsToggle enabled={useMCPTools} onToggle={setUseMCPTools} />
              <MCPStatusIndicator />
            </div>
          </div>
        </Card>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <p className="text-lg mb-2">안녕하세요!</p>
                <p className="text-sm">메시지를 입력하여 대화를 시작하세요.</p>
                {useMCPTools && (
                  <p className="text-xs mt-2 text-blue-500">
                    MCP 도구가 활성화되어 있습니다.
                  </p>
                )}
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble key={idx} msg={msg} />
              ))
            )}

            {/* 로딩 중 표시 (도구 호출이 없을 때만) */}
            {isLoading && messages.length > 0 && !messages[messages.length - 1]?.toolCalls?.length && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground rounded-lg px-4 py-2">
                  <span className="animate-pulse">입력 중...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <Card className="rounded-none border-x-0 border-b-0 shadow-sm shrink-0">
          <div className="px-4 py-4">
            <div className="max-w-3xl mx-auto flex gap-2">
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
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
