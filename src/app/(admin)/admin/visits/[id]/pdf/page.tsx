import { VisitPdfContent } from '@/features/visits/visit-pdf-content'

export default async function AdminVisitPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VisitPdfContent basePath="/admin" id={id} />
}
