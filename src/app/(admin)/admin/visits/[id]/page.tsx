import { VisitDetailContent } from '@/features/visits/visit-detail-content'

export default async function AdminVisitDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; sent?: string; why?: string }> }) {
  const { id } = await params
  const { saved, sent, why } = await searchParams
  return <VisitDetailContent basePath="/admin" id={id} saved={saved === '1'} sent={sent} sentWhy={why} />
}
