import { useState, useRef, useEffect } from "react";
import { analysisService } from "../../services/api";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  sources?: { doc_name: string; category: string }[];
}

const getConditionBasedSuggestions = (conditions: string[]): string[] => {
  const suggestions: string[] = [];
  const all = [
    "Explain my latest lab results",
    "What do my medications do?",
    "Summarize my health summary",
    "What do my health predictions mean?"
  ];

  for (const c of conditions) {
    const cl = c.toLowerCase();
    if (cl.includes('diabetes')) {
      suggestions.push("Explain my glucose levels");
      suggestions.push("What does my HbA1c mean?");
    }
    if (cl.includes('hypertension')) {
      suggestions.push("Explain my blood pressure readings");
    }
    if (cl.includes('heart') || cl.includes('cardiac')) {
      suggestions.push("Explain my cholesterol levels");
    }
    if (cl.includes('thyroid')) {
      suggestions.push("Explain my thyroid test results");
    }
    if (cl.includes('kidney') || cl.includes('renal')) {
      suggestions.push("Explain my kidney function results");
    }
    if (cl.includes('anemia')) {
      suggestions.push("Explain my blood count results");
    }
  }

  return suggestions.length > 0 ? suggestions.slice(0, 4) : all;
};

const parseMarkdown = (text: string): string => {
  let result = text;
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 rounded text-sm">$1</code>');
  result = result.replace(/^### (.+)$/gm, '<h4 class="font-semibold text-md mt-3 mb-1">$1</h4>');
  result = result.replace(/^## (.+)$/gm, '<h3 class="font-semibold text-lg mt-3 mb-1">$1</h3>');
  result = result.replace(/^# (.+)$/gm, '<h2 class="font-bold text-xl mt-3 mb-1">$1</h2>');
  result = result.replace(/^\* (.+)$/gm, '<li class="ml-4">$1</li>');
  result = result.replace(/^− (.+)$/gm, '<li class="ml-4">$1</li>');
  result = result.replace(/\n/g, '<br/>');
  return result;
};

interface ChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  userConditions?: string[];
}

const ChatWidget = ({ isOpen, onToggle, userConditions = [] }: ChatWidgetProps) => {
  const conditionsText = userConditions.length > 0
    ? `Based on your conditions (${userConditions.join(', ')}), here are some things I can help with:`
    : "Here are some things I can help with:";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content: `Hi! I'm your Health Assistant. I can help you understand your health documents, explain test results, and answer questions about your health based on your actual medical data.\n\n**Important:** I'm an AI assistant, not a doctor. Always consult a healthcare professional for medical advice.\n\n${conditionsText}`
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const quickSuggestions = getConditionBasedSuggestions(userConditions);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await analysisService.chat(userMessage.content);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: response.data.response,
        sources: response.data.sources
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: "Sorry, I encountered an error. Please try again."
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

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-14 h-14 bg-teal-600 rounded-full shadow-lg shadow-teal-600/25 flex items-center justify-center hover:bg-teal-700 hover:scale-110 transition-all z-40"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[380px] h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-teal-600 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Health Assistant</h3>
            <p className="text-white/70 text-xs">AI-powered advisor</p>
          </div>
        </div>
        <button onClick={onToggle} className="text-white/80 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 px-3 py-2 border-b border-amber-100 flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-xs text-amber-800">Not medical advice</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
              <p className="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: msg.role === "bot" ? parseMarkdown(msg.content) : msg.content }}></p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-200/20">
                  <p className="text-xs text-slate-500 mb-2">Based on:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-xs bg-white/20 text-slate-600 px-2 py-1 rounded-full">
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

      {/* Quick Suggestions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {quickSuggestions.slice(0, 3).map((suggestion, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(suggestion);
                  sendMessage();
                  setInput("");
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about your health..."
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-teal-600 hover:bg-teal-700 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;