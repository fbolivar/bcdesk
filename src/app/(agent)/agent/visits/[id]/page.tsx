import { VisitDetailContent } from '@/features/visits/visit-detail-content'

export default async function AgentVisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VisitDetailContent basePath="/agent" id={id} />
}
