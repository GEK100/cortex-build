import { CapturePanel } from '@/components/capture/capture-panel'

export default function Home() {
  return (
    <main className="mx-auto max-w-xl animate-rise px-4 py-6 md:py-10">
      <div className="mb-5 text-center md:text-left">
        <h1 className="font-display text-3xl font-bold text-foreground">Capture</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Speak, type, or snap. Everything files into the active project and extracts on its own.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-float md:p-6">
        <CapturePanel />
      </div>
    </main>
  )
}
