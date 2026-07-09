import { ProjectsManager } from '@/components/projects/projects-manager'

export default function ProjectsPage() {
  return (
    <main>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-medium tracking-tight">Projects</h2>
      </div>
      <ProjectsManager />
    </main>
  )
}
