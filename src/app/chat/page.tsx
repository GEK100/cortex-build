import { ChatPanel } from '@/components/chat/chat-panel'

export default function ChatPage() {
  return (
    <div className="flex flex-col">
      <div className="border-b border-border px-4 py-3 md:px-6">
        <h1 className="font-display text-xl font-bold text-foreground">Chat</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ask about the active project, or capture by voice.
        </p>
      </div>
      <ChatPanel />
    </div>
  )
}
