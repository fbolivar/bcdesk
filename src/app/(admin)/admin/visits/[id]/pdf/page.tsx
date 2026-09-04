import { redirect } from 'next/navigation'

// El acta ahora se entrega como PDF real (no impresión de pantalla). Se redirige
// al generador de PDF para cualquier enlace/bookmark antiguo.
export default async function AdminVisitPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/api/visits/${id}/report`)
}
