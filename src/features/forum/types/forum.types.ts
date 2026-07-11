export type ForumCategory = 'general' | 'technical' | 'billing' | 'feature_request' | 'announcement'

export interface ForumPost {
  id: string
  title: string
  body: string
  author_id: string | null
  organization_id: string | null
  category: ForumCategory
  is_answered: boolean
  is_pinned: boolean
  views: number
  created_at: string
  updated_at: string
}

export interface ForumReply {
  id: string
  post_id: string
  author_id: string | null
  body: string
  is_accepted: boolean
  upvotes: number
  created_at: string
}

export interface ForumVote {
  user_id: string
  reply_id: string
}

export const CATEGORY_LABELS: Record<ForumCategory, string> = {
  general: 'General',
  technical: 'Técnico',
  billing: 'Facturación',
  feature_request: 'Solicitud',
  announcement: 'Anuncio',
}

export const CATEGORY_COLORS: Record<ForumCategory, { bg: string; color: string }> = {
  general: { bg: 'rgba(148,163,184,0.15)', color: '#5B6B7C' },
  technical: { bg: 'rgba(0, 212, 170,0.15)', color: '#00D4AA' },
  billing: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  feature_request: { bg: 'rgba(168,85,247,0.15)', color: '#A855F7' },
  announcement: { bg: 'rgba(16,217,138,0.15)', color: '#10D98A' },
}
