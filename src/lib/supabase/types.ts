export type Role = 'admin' | 'agent' | 'client'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed' | 'cancelled'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type TicketCategory = 'support' | 'development' | 'billing' | 'onboarding' | 'other'
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type OrgStatus = 'active' | 'inactive' | 'suspended'

export interface Organization {
  id: string
  name: string
  slug: string
  industry: string | null
  website: string | null
  phone: string | null
  address: string | null
  logo_url: string | null
  status: OrgStatus
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  role: Role
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  job_title: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Invitation {
  id: string
  organization_id: string | null
  email: string
  role: Role
  token: string
  invited_by: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface SLAPolicy {
  id: string
  name: string
  category: string
  priority: TicketPriority
  response_time_minutes: number
  resolution_time_minutes: number
  escalate_after_minutes: number | null
  is_active: boolean
  created_at: string
}

export interface Ticket {
  id: string
  ticket_number: number
  organization_id: string
  created_by: string
  assigned_to: string | null
  sla_policy_id: string | null
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  source_channel: string | null
  parent_ticket_id: string | null
  first_response_at: string | null
  resolved_at: string | null
  sla_response_due_at: string | null
  sla_resolution_due_at: string | null
  sla_breached: boolean
  tags: string[] | null
  satisfaction_score: number | null
  satisfaction_comment: string | null
  created_at: string
  updated_at: string
  // joins
  organization?: Organization
  created_by_profile?: Profile
  assigned_to_profile?: Profile
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  content: string
  is_internal: boolean
  is_automated: boolean
  created_at: string
  updated_at: string
  author?: Profile
}

export interface TicketAttachment {
  id: string
  ticket_id: string | null
  comment_id: string | null
  uploaded_by: string
  file_name: string
  file_url: string
  file_size_bytes: number | null
  mime_type: string | null
  created_at: string
}

export interface Project {
  id: string
  organization_id: string
  managed_by: string | null
  name: string
  description: string | null
  status: ProjectStatus
  progress_percent: number
  start_date: string | null
  end_date: string | null
  budget_usd: number | null
  spent_usd: number
  created_at: string
  updated_at: string
  organization?: Organization
  manager?: Profile
  phases?: ProjectPhase[]
}

export interface ProjectPhase {
  id: string
  project_id: string
  name: string
  description: string | null
  order_index: number
  status: PhaseStatus
  start_date: string | null
  end_date: string | null
  progress_percent: number
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string
  organization_id: string
  project_id: string | null
  created_by: string
  status: InvoiceStatus
  subtotal_usd: number
  tax_percent: number
  tax_usd: number
  total_usd: number
  currency: string
  issue_date: string
  due_date: string
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  notes: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
  organization?: Organization
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price_usd: number
  total_usd: number
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface OnboardingSubmission {
  id: string
  organization_id: string
  submitted_by: string | null
  step_completed: number
  company_data: Record<string, unknown> | null
  contacts_data: Record<string, unknown> | null
  services_data: Record<string, unknown> | null
  completed_at: string | null
  created_at: string
  updated_at: string
}
