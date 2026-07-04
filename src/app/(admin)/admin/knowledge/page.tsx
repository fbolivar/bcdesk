import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookOpen, Plus, Eye, EyeOff, Trash2 } from 'lucide-react'
import { createKbArticle, updateKbArticle, toggleKbArticle, deleteKbArticle } from '@/features/admin/services/knowledge.service'
import { KbArticleForm } from '@/features/admin/components/kb-article-form'

export default async function AdminKnowledgePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const { data: articles } = await supabase
    .from('kb_articles')
    .select('id, title, slug, category, is_published, views, created_at')
    .order('created_at', { ascending: false })

  const list = articles ?? []
  const categories = [...new Set(list.map(a => a.category).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1E293B]">Base de conocimiento</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{list.length} artículos · {list.filter(a => a.is_published).length} publicados</p>
        </div>
        <KbArticleForm action={createKbArticle} />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen size={40} className="text-[#E6EBF2] mb-3" />
          <p className="text-[#64748B] font-medium">Sin artículos aún</p>
          <p className="text-sm text-[#64748B] mt-1">Crea el primer artículo para ayudar a tus clientes</p>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E6EBF2] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EBF2]">
                {['Título', 'Categoría', 'Vistas', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(article => (
                <tr key={article.id} className="border-b border-[#E6EBF2]/50 hover:bg-[#EEF2F7]">
                  <td className="px-4 py-3">
                    <p className="text-[#1E293B] font-medium">{article.title}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">/{article.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {article.category
                      ? <span className="px-2 py-0.5 rounded-full text-xs bg-[#E6EBF2] text-[#64748B]">{article.category}</span>
                      : <span className="text-[#CBD5E1]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{article.views ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${article.is_published ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#E6EBF2] text-[#64748B]'}`}>
                      {article.is_published ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <KbArticleForm article={article} action={updateKbArticle.bind(null, article.id)} />
                      <form action={async () => { 'use server'; await toggleKbArticle(article.id, !article.is_published) }}>
                        <button type="submit" title={article.is_published ? 'Despublicar' : 'Publicar'}
                          className="p-1.5 rounded text-[#64748B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors">
                          {article.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </form>
                      <form action={async () => { 'use server'; await deleteKbArticle(article.id) }}>
                        <button type="submit"
                          className="p-1.5 rounded text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
