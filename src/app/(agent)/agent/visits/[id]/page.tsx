import { VisitDetailContent } from '@/features/visits/visit-detail-content'

export default async function AgentVisitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params
  const { saved } = await searchParams
  return <VisitDetailContent basePath="/agent" id={id} saved={saved === '1'} />
}
