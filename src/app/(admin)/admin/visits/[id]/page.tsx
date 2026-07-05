import { VisitDetailContent } from '@/features/visits/visit-detail-content'

export default async function AdminVisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VisitDetailContent basePath="/admin" id={id} />
}
