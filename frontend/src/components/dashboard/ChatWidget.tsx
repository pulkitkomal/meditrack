import ChatPanel from "../chat/ChatPanel";

const ChatWidget = ({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) => {
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Open Health Assistant"
        className="fixed bottom-6 right-6 w-14 h-14 bg-teal-600 rounded-full shadow-lg shadow-teal-600/25 flex items-center justify-center hover:bg-teal-700 hover:scale-105 transition-all z-40"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    );
  }
  return (
    <div role="dialog" aria-label="Health Assistant" className="fixed bottom-6 right-6 w-[400px] h-[min(620px,calc(100vh-3rem))] rounded-glass shadow-2xl border border-slate-200 z-50">
      <ChatPanel variant="widget" onClose={onToggle} />
    </div>
  );
};

export default ChatWidget;
