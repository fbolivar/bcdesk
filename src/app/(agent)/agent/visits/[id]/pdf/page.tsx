import { VisitPdfContent } from '@/features/visits/visit-pdf-content'

export default async function AgentVisitPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VisitPdfContent basePath="/agent" id={id} />
}
