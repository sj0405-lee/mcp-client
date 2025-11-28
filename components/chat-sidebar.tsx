"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, Sparkles } from "lucide-react";
import { ChatSession } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: ChatSidebarProps) {
  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp; // 밀리초 차이
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) {
      return `${seconds}초 전`;
    } else if (minutes < 60) {
      return `${minutes}분 전`;
    } else if (hours < 24) {
      return `${hours}시간 전`;
    } else if (days < 7) {
      return `${days}일 전`;
    } else {
      const date = new Date(timestamp);
      return date.toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* 사이드바 헤더 */}
      <div className="p-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <h2 className="text-sm font-semibold text-white">채팅 히스토리</h2>
        </div>
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-white/10 text-white rounded-xl h-10 transition-all"
          variant="ghost"
        >
          <Plus className="h-4 w-4 text-cyan-400" />
          새 채팅
        </Button>
      </div>

      {/* 채팅 목록 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-5 w-5 text-slate-500" />
              </div>
              <p className="text-sm text-slate-500">채팅 내역이 없습니다</p>
              <p className="text-xs text-slate-600 mt-1">새 채팅을 시작해보세요</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group relative flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 border border-cyan-500/30 shadow-lg shadow-cyan-500/10"
                      : "hover:bg-white/5 border border-transparent"
                  )}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isActive 
                      ? "bg-cyan-500/20" 
                      : "bg-white/5 group-hover:bg-white/10"
                  )}>
                    <MessageSquare className={cn(
                      "h-4 w-4",
                      isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-400"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                      )}
                    >
                      {session.title}
                    </p>
                    <p
                      className={cn(
                        "text-xs truncate",
                        isActive
                          ? "text-cyan-400/70"
                          : "text-slate-500"
                      )}
                    >
                      {formatDate(session.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-all relative z-20 rounded-lg",
                      isActive
                        ? "hover:bg-red-500/20 text-red-400"
                        : "hover:bg-red-500/10 text-slate-500 hover:text-red-400"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* 하단 브랜딩 */}
      <div className="p-4 border-t border-white/5">
        <div className="text-center">
          <p className="text-xs text-slate-600">Powered by</p>
          <p className="text-xs font-medium gradient-text">Shine Muscat AI</p>
        </div>
      </div>
    </div>
  );
}
