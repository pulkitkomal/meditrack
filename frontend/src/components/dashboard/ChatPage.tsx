import ChatPanel from "../chat/ChatPanel";

const ChatPage = ({ onBack }: { onBack: () => void }) => <ChatPanel variant="page" onClose={onBack} />;

export default ChatPage;
