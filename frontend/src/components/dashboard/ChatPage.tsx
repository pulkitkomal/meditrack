import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { analysisService } from "../../services/api";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: { doc_name: string; category: string }[];
}

const quickSuggestions = [
  "Explain my latest lab results",
  "What do my medications do?",
  "Summarize my health summary",
  "What do my health predictions mean?"
];

const ChatPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content: "Hi! I'm your Health Assistant. I can help you understand your health documents, explain test results, and answer general health questions.\n\n**Important:** I'm an AI assistant, not a doctor. Always consult a healthcare professional for medical advice.\n\nWhat would you like to know?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

    const sendMessage = async (text?: string) => {
        const messageText = text || input;
        if (!messageText.trim() || loading) return;
        
        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: messageText.trim()
        };
        
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setLoading(true);
        
        console.log('[CHAT] Sending message:', userMessage.content);
        
        try {
            const response = await analysisService.chat(userMessage.content);
            console.log('[CHAT] Received response:', response.data);
            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "bot",
                content: response.data.response,
                sources: response.data.sources
            };
            setMessages(prev => [...prev, botMessage]);
        } catch (error: any) {
            console.error('[CHAT] Error:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "bot",
                content: error.response?.data?.detail || error.response?.data?.error?.message || "Sorry, I encountered an error. Please try again."
            }]);
        } finally {
            setLoading(false);
        }
    };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isFirstBotMessage = messages.filter(m => m.role === "bot").length <= 1;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-xl">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Health Assistant</h3>
          <p className="text-xs text-slate-400">AI-powered health advisor</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-xs text-amber-800">Not a replacement for professional medical advice</p>
      </div>

{/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-teal-600 text-white rounded-br-lg"
                    : "bg-slate-100 text-slate-700 rounded-bl-lg"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                  </div>
                )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/20">
                  <p className="text-xs text-slate-500 mb-2">Based on:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-xs bg-white/20 text-slate-700 px-2 py-1 rounded-full">
                        {s.doc_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-lg">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions (only show on first load) */}
      {isFirstBotMessage && messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {quickSuggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => sendMessage(suggestion)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about your health..."
            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-12 h-12 bg-teal-600 hover:bg-teal-700 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;