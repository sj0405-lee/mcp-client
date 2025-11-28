import { GoogleGenAI, Type, FunctionDeclaration, Schema } from "@google/genai";
import { NextRequest } from "next/server";
import { GlobalMCPManager } from "@/lib/mcp/global-manager";
import { MCPTool } from "@/lib/mcp/types";

export const runtime = "nodejs";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  useMCPTools?: boolean;
}

// SSE 이벤트 전송 헬퍼
function createSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// MCP Tool을 Gemini FunctionDeclaration으로 변환
function mcpToolToFunctionDeclaration(tool: MCPTool): FunctionDeclaration {
  const schema = tool.inputSchema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  } | undefined;

  return {
    name: tool.name,
    description: tool.description || "",
    parameters: schema ? {
      type: Type.OBJECT,
      properties: (schema.properties || {}) as Record<string, Schema>,
      required: schema.required || [],
    } : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { messages, useMCPTools = false }: ChatRequest = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 메시지를 Gemini Content 형식으로 변환
    const contents = messages.map((msg: ChatMessage) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // MCP 도구 사용 여부에 따라 처리
    if (useMCPTools) {
      return handleWithMCPTools(ai, contents);
    } else {
      return handleWithoutTools(ai, contents);
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// MCP 도구 없이 일반 스트리밍
async function handleWithoutTools(
  ai: GoogleGenAI,
  contents: { role: string; parts: { text: string }[] }[]
) {
  const stream = await ai.models.generateContentStream({
    model: "gemini-2.0-flash-001",
    contents,
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text || "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// MCP 도구와 함께 SSE 스트리밍 (수동 함수 호출)
async function handleWithMCPTools(
  ai: GoogleGenAI,
  contents: { role: string; parts: { text: string }[] }[]
) {
  const allTools = GlobalMCPManager.getAllTools();

  // 연결된 MCP 도구가 없으면 일반 스트리밍으로 처리
  if (allTools.length === 0) {
    return handleWithoutTools(ai, contents);
  }

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // 도구 정보 전송
        controller.enqueue(
          encoder.encode(
            createSSEMessage("tools_available", {
              tools: allTools.map((t) => ({
                name: t.tool.name,
                description: t.tool.description,
                serverName: t.serverName,
                serverId: t.serverId,
              })),
            })
          )
        );

        // FunctionDeclaration 생성
        const functionDeclarations = allTools.map((t) =>
          mcpToolToFunctionDeclaration(t.tool)
        );

        // 서버ID와 도구 이름 매핑
        const toolServerMap = new Map<string, string>();
        const toolServerNameMap = new Map<string, string>();
        for (const t of allTools) {
          toolServerMap.set(t.tool.name, t.serverId);
          toolServerNameMap.set(t.tool.name, t.serverName);
        }

        // 사용 가능한 도구 목록 문자열 생성
        const toolDescriptions = allTools
          .map((t) => `- ${t.tool.name}: ${t.tool.description || "설명 없음"}`)
          .join("\n");

        // 시스템 프롬프트 추가 (도구 사용 강제)
        const systemPrompt = `당신은 MCP(Model Context Protocol) 도구를 사용할 수 있는 AI 어시스턴트입니다.

사용 가능한 도구:
${toolDescriptions}

중요 규칙:
1. 사용자가 이미지 생성, 그림, 사진 등을 요청하면 반드시 'generate-image' 도구를 호출하세요.
2. 시간 관련 질문에는 'time', 'get_current_time', 'convert_time' 도구를 사용하세요.
3. 계산이 필요하면 'calc' 도구를 사용하세요.
4. 도구를 사용할 수 있는 상황에서는 반드시 도구를 호출하세요. 직접 답변하지 마세요.
5. 도구 호출 후 결과를 바탕으로 사용자에게 친절하게 답변하세요.`;

        // 대화 기록 복사 (함수 호출 루프용)
        // 시스템 프롬프트를 첫 번째 사용자 메시지에 추가
        const conversationContents = contents.map((c, idx) => {
          if (idx === 0 && c.role === "user") {
            return {
              ...c,
              parts: [{ text: `${systemPrompt}\n\n사용자 요청: ${c.parts[0].text}` }],
            };
          }
          return c;
        });

        let maxIterations = 10; // 무한 루프 방지

        while (maxIterations > 0) {
          maxIterations--;

          console.log("[MCP Chat] Calling Gemini with tools:", functionDeclarations.map(f => f.name));

          // Gemini API 호출
          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-001",
            contents: conversationContents,
            config: {
              tools: [{ functionDeclarations }],
            },
          });

          // 함수 호출이 있는지 확인
          const functionCalls = response.functionCalls;

          console.log("[MCP Chat] Function calls:", functionCalls?.map(f => f.name) || "none");
          console.log("[MCP Chat] Response text:", response.text?.slice(0, 100) || "none");

          if (!functionCalls || functionCalls.length === 0) {
            // 함수 호출이 없으면 최종 텍스트 응답 전송
            const text = response.text || "";
            if (text) {
              controller.enqueue(
                encoder.encode(createSSEMessage("text", { content: text }))
              );
            }
            break;
          }

          // 함수 호출 처리
          for (const call of functionCalls) {
            const toolName = call.name || "";
            const toolCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const serverId = toolServerMap.get(toolName);
            const serverName = toolServerNameMap.get(toolName);

            // 함수 호출 정보 전송
            controller.enqueue(
              encoder.encode(
                createSSEMessage("tool_call", {
                  id: toolCallId,
                  name: toolName,
                  args: call.args,
                  serverId,
                  serverName,
                })
              )
            );

            // MCP 서버에서 도구 실행
            let result: string;
            let isError = false;
            let contents: {
              type: "text" | "image" | "resource";
              text?: string;
              data?: string;
              mimeType?: string;
              uri?: string;
            }[] = [];

            try {
              if (!serverId) {
                throw new Error(`Server not found for tool: ${toolName}`);
              }

              const toolResult = await GlobalMCPManager.callTool(
                serverId,
                toolName,
                (call.args as Record<string, unknown>) || {}
              );

              // 전체 컨텐츠 저장 (이미지 포함)
              contents = toolResult.content;

              // 디버그: 이미지 데이터 확인
              console.log("[MCP Chat] Tool result contents:", contents.map(c => ({
                type: c.type,
                hasData: !!c.data,
                dataLength: c.data?.length,
                mimeType: c.mimeType,
              })));

              // 결과를 문자열로 변환 (LLM 대화용)
              result = toolResult.content
                .map((c) => {
                  if (c.type === "text" && c.text) return c.text;
                  if (c.type === "image" && c.data)
                    return `[이미지가 생성되었습니다: ${c.mimeType}]`;
                  if (c.type === "resource" && c.uri) return `[Resource: ${c.uri}]`;
                  return JSON.stringify(c);
                })
                .join("\n");

              isError = toolResult.isError || false;
            } catch (error) {
              result =
                error instanceof Error ? error.message : "Tool execution failed";
              isError = true;
            }

            // 도구 실행 결과 전송 (이미지 데이터 포함)
            controller.enqueue(
              encoder.encode(
                createSSEMessage("tool_result", {
                  toolCallId,
                  name: call.name,
                  result,
                  contents, // 이미지 데이터 포함
                  isError,
                })
              )
            );

            // 대화 기록에 함수 호출과 결과 추가
            conversationContents.push({
              role: "model",
              parts: [
                {
                  functionCall: {
                    name: call.name,
                    args: call.args,
                  },
                },
              ],
            } as unknown as { role: string; parts: { text: string }[] });

            conversationContents.push({
              role: "user",
              parts: [
                {
                  functionResponse: {
                    name: call.name,
                    response: { result },
                  },
                },
              ],
            } as unknown as { role: string; parts: { text: string }[] });
          }
        }

        // 완료 이벤트
        controller.enqueue(encoder.encode(createSSEMessage("done", {})));
        controller.close();
      } catch (error) {
        console.error("MCP tools error:", error);
        controller.enqueue(
          encoder.encode(
            createSSEMessage("error", {
              message: error instanceof Error ? error.message : "Unknown error",
            })
          )
        );
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
