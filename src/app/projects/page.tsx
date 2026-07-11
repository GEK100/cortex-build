import { ProjectsManager } from '@/components/projects/projects-manager'
import { PageHeader, PageShell } from '@/components/layout/page-header'

export default function ProjectsPage() {
  return (
    <PageShell size="narrow">
      <PageHeader eyebrow="Your spaces" title="Projects" subtitle="Split captures across sites. Notes with no project live in General." />
      <ProjectsManager />
    </PageShell>
  )
}
