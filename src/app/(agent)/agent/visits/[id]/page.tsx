import { VisitDetailContent } from '@/features/visits/visit-detail-content'

export default async function AgentVisitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; sent?: string; why?: string }> }) {
  const { id } = await params
  const { saved, sent, why } = await searchParams
  return <VisitDetailContent basePath="/agent" id={id} saved={saved === '1'} sent={sent} sentWhy={why} />
}
