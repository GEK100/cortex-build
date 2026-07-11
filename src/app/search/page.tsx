import { SearchView } from '@/components/search/search-view'
import { PageHeader, PageShell } from '@/components/layout/page-header'

export default function SearchPage() {
  return (
    <PageShell size="narrow">
      <PageHeader eyebrow="Find anything" title="Search" subtitle="Keyword + semantic across the active project." />
      <SearchView />
    </PageShell>
  )
}
