import { redirect } from 'next/navigation'

// El acta ahora se entrega como PDF real (no impresión de pantalla).
export default async function AgentVisitPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/api/visits/${id}/report`)
}
