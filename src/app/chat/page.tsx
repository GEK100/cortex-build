import { ChatPanel } from '@/components/chat/chat-panel'

export default function ChatPage() {
  return (
    <main>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-medium tracking-tight">Chat</h2>
      </div>
      <ChatPanel />
    </main>
  )
}
