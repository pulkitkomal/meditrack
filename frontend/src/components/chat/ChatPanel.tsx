import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  chatService, ChatRequestError,
  type ChatAllowance, type ChatMessage, type ConversationSummary,
} from "../../services/api";
import { parseRecordDate, parseTimestamp } from "../../lib/dates";

const STORAGE_KEY = "healthsync-chat-conversation";

interface LocalMessage extends ChatMessage {
  pending?: boolean;
  stopped?: boolean;
}

interface ChatPanelProps {
  variant: "page" | "widget";
  onClose: () => void;
}

const Icon = ({ d, className = "w-5 h-5" }: { d: string; className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const ICONS = {
  back: "M15 19l-7-7 7-7",
  close: "M6 18L18 6M6 6l12 12",
  history: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  plus: "M12 4v16m8-8H4",
  send: "M5 12h14M12 5l7 7-7 7",
  stop: "M6 6h12v12H6z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  up: "M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5",
  down: "M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5",
};

const relativeDay = (value?: string) => {
  const date = parseTimestamp(value);
  if (!date) return "";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const ChatPanel = ({ variant, onClose }: ChatPanelProps) => {
  const [view, setView] = useState<"chat" | "history">("chat");
  const [conversationId, setConversationId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(!!conversationId);
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allowance, setAllowance] = useState<ChatAllowance | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const rememberConversation = (id: string | null) => {
    setConversationId(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    chatService.status().then(res => {
      setSuggestions(res.data.suggestions);
      setAllowance(res.data.allowance);
    }).catch(() => {});
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setLoadingConversation(true);
    setView("chat");
    try {
      const res = await chatService.getConversation(id);
      setMessages(res.data.messages);
      rememberConversation(id);
    } catch {
      setMessages([]);
      rememberConversation(null);
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) openConversation(stored);
    return () => abortRef.current?.abort();
  }, [openConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, view]);

  const showHistory = async () => {
    setView("history");
    setConversations(null);
    const res = await chatService.listConversations().catch(() => null);
    setConversations(res?.data || []);
  };

  const newChat = () => {
    abortRef.current?.abort();
    rememberConversation(null);
    setMessages([]);
    setNotice(null);
    setView("chat");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const deleteConversation = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    await chatService.deleteConversation(id).catch(() => {});
    setConversations(list => (list || []).filter(c => c.id !== id));
    if (id === conversationId) newChat();
  };

  const deleteAll = async () => {
    if (!confirm("Delete all conversations? This can't be undone.")) return;
    await chatService.deleteAllConversations().catch(() => {});
    setConversations([]);
    newChat();
  };

  const updateLast = (patch: (m: LocalMessage) => LocalMessage) =>
    setMessages(list => list.map((m, i) => (i === list.length - 1 ? patch(m) : m)));

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    setInput("");
    setNotice(null);
    setStreaming(true);
    setMessages(list => [...list, { role: "user", content: message }, { role: "assistant", content: "", pending: true }]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await chatService.send(message, conversationId, event => {
        if (event.type === "start") rememberConversation(event.conversation_id);
        else if (event.type === "delta") updateLast(m => ({ ...m, content: m.content + event.text }));
        else if (event.type === "done") {
          updateLast(m => ({ ...m, pending: false, sources: event.sources, urgent: event.urgent }));
          setAllowance(event.allowance);
        }
      }, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) {
        updateLast(m => ({ ...m, pending: false, stopped: true }));
      } else {
        setMessages(list => list.slice(0, -2));
        setInput(message);
        if (err instanceof ChatRequestError) {
          setNotice(err.message);
          if (err.status === 429) setAllowance(a => (a ? { ...a, used: a.limit } : a));
          if (err.status === 404) rememberConversation(null);
        } else {
          setNotice("Couldn't reach the assistant. Check your connection and try again.");
        }
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const rate = async (index: number, rating: "up" | "down") => {
    if (!conversationId) return;
    const next = messages[index].feedback === rating ? null : rating;
    setMessages(list => list.map((m, i) => (i === index ? { ...m, feedback: next } : m)));
    await chatService.rate(conversationId, index, next).catch(() => {});
  };

  const remaining = allowance ? Math.max(0, Math.round(100 - (allowance.used / allowance.limit) * 100)) : null;
  const outOfAllowance = remaining === 0;
  const isPage = variant === "page";

  const headerButton = "p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors";

  return (
    <div className={`flex flex-col bg-surface ${isPage ? "h-full" : "h-full rounded-glass overflow-hidden"}`}>
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100">
        {isPage && (
          <button type="button" onClick={view === "history" ? () => setView("chat") : onClose} className={headerButton} aria-label="Back">
            <Icon d={ICONS.back} />
          </button>
        )}
        <div className="flex-1 min-w-0 px-1">
          <h2 className="font-semibold text-slate-800 leading-tight">{view === "history" ? "Conversations" : "Health Assistant"}</h2>
          {view === "chat" && <p className="text-xs text-slate-500">Answers from your records and readings</p>}
        </div>
        {view === "chat" ? (
          <button type="button" onClick={showHistory} className={headerButton} aria-label="Conversation history" title="History">
            <Icon d={ICONS.history} />
          </button>
        ) : !isPage && (
          <button type="button" onClick={() => setView("chat")} className={headerButton} aria-label="Back to chat">
            <Icon d={ICONS.back} />
          </button>
        )}
        <button type="button" onClick={newChat} className={headerButton} aria-label="New chat" title="New chat">
          <Icon d={ICONS.plus} />
        </button>
        {!isPage && (
          <button type="button" onClick={onClose} className={headerButton} aria-label="Close assistant">
            <Icon d={ICONS.close} />
          </button>
        )}
      </div>

      {view === "history" ? (
        <div className="flex-1 overflow-y-auto p-3">
          {conversations === null ? (
            <div className="space-y-2" aria-label="Loading">
              {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No saved conversations yet.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {conversations.map(c => (
                  <li key={c.id} className="flex items-center gap-1 rounded-xl hover:bg-slate-50">
                    <button type="button" onClick={() => openConversation(c.id)} className="flex-1 min-w-0 text-left px-3 py-2.5">
                      <span className={`block text-sm truncate ${c.id === conversationId ? "font-semibold text-teal-700" : "font-medium text-slate-800"}`}>{c.title}</span>
                      <span className="block text-xs text-slate-500">{relativeDay(c.updated_at)} · {Math.ceil(c.message_count / 2)} question{c.message_count > 2 ? "s" : ""}</span>
                    </button>
                    <button type="button" onClick={() => deleteConversation(c.id)} className="p-2 mr-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label={`Delete ${c.title}`}>
                      <Icon d={ICONS.trash} className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={deleteAll} className="mt-4 w-full text-sm text-red-600 hover:bg-red-50 rounded-xl py-2">
                Delete all conversations
              </button>
            </>
          )}
          <p className="mt-4 text-xs text-slate-400 text-center">Conversations are saved to your account so you can come back to them.</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" aria-live="polite">
            {loadingConversation ? (
              <div className="space-y-3" aria-label="Loading">
                <div className="h-10 w-2/3 ml-auto rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-24 w-5/6 rounded-2xl bg-slate-100 animate-pulse" />
              </div>
            ) : messages.length === 0 ? (
              <div className="pt-4">
                <p className="text-slate-800 font-medium">Hi! Ask me about your lab results, medications or home readings.</p>
                <p className="text-sm text-slate-500 mt-1">I answer from your own records and can explain what the numbers mean.</p>
                {suggestions.length > 0 && (
                  <div className="mt-4 flex flex-col items-start gap-2">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        disabled={outOfAllowance}
                        className="text-left text-sm px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-teal-50 transition-colors disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "user" ? (
                    <p className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-teal-600 text-white text-sm whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className={`max-w-[92%] text-sm ${m.urgent ? "border-l-4 border-red-500 bg-red-50 rounded-r-2xl px-4 py-3" : ""}`}>
                      {m.urgent && <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1">⚠ Urgent</p>}
                      {m.pending && !m.content ? (
                        <span className="inline-flex gap-1 py-2" aria-label="Assistant is typing">
                          {[0, 150, 300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                        </span>
                      ) : (
                        <div className="chat-markdown text-slate-700">
                          <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                        </div>
                      )}
                      {m.stopped && <p className="text-xs text-slate-400 mt-1">Stopped</p>}
                      {!m.pending && m.sources && m.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="text-xs text-slate-500 self-center">From:</span>
                          {m.sources.map(s => {
                            const date = parseRecordDate(s.date);
                            return (
                              <Link
                                key={s.doc_id}
                                to={`/analysis/${s.doc_id}`}
                                className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 max-w-full truncate"
                              >
                                {s.title}{date ? ` · ${date.toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                      {!m.pending && !m.urgent && m.content && conversationId && (
                        <div className="mt-1 flex gap-1">
                          {(["up", "down"] as const).map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => rate(i, r)}
                              aria-pressed={m.feedback === r}
                              aria-label={r === "up" ? "Helpful" : "Not helpful"}
                              className={`p-1.5 rounded-lg transition-colors ${m.feedback === r ? "text-teal-700 bg-teal-50" : "text-slate-300 hover:text-slate-600 hover:bg-slate-100"}`}
                            >
                              <Icon d={ICONS[r]} className="w-4 h-4" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {notice && (
            <p role="alert" className="mx-4 mb-2 text-sm px-3 py-2 rounded-xl bg-amber-50 text-amber-800">{notice}</p>
          )}

          <div className={`border-t border-slate-100 px-3 pt-3 ${isPage ? "pb-[calc(0.75rem+env(safe-area-inset-bottom))]" : "pb-3"}`}>
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor={`chat-input-${variant}`}>Message</label>
              <textarea
                id={`chat-input-${variant}`}
                ref={inputRef}
                rows={1}
                maxLength={4000}
                value={input}
                disabled={outOfAllowance}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={outOfAllowance ? "Today's allowance is used up" : "Ask about your health…"}
                className="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl border border-slate-200 bg-surface text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 disabled:opacity-60"
              />
              {streaming ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className="w-10 h-10 shrink-0 rounded-full bg-slate-800 text-white flex items-center justify-center" aria-label="Stop answering">
                  <Icon d={ICONS.stop} className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={() => send()} disabled={!input.trim() || outOfAllowance} className="w-10 h-10 shrink-0 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 disabled:opacity-40" aria-label="Send">
                  <Icon d={ICONS.send} className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>AI can make mistakes. Not medical advice — check with your doctor.</span>
              {remaining !== null && (
                <span className={`shrink-0 ${remaining <= 20 ? "text-amber-700" : ""}`}>{remaining}% left today</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatPanel;
