import { VisitDetailContent } from '@/features/visits/visit-detail-content'

export default async function AdminVisitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params
  const { saved } = await searchParams
  return <VisitDetailContent basePath="/admin" id={id} saved={saved === '1'} />
}
