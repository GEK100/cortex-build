import { CapturePanel } from '@/components/capture/capture-panel'

export default function Home() {
  return (
    <main className="mx-auto max-w-xl animate-rise px-4 py-6 md:py-10">
      <div className="mb-5 text-center md:text-left">
        <h1 className="text-xl font-semibold text-foreground">Capture</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Speak, type, or snap. Everything files into the active project and extracts on its own.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-card md:p-6">
        <CapturePanel />
      </div>
    </main>
  )
}
