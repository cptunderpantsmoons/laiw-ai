export interface Matter {
  id: string
  name: string
  description: string
  status: 'open' | 'closed' | 'on-hold' | 'archived'
  type: string
  createdAt: string
  updatedAt: string
}

export interface Contract {
  id: string
  title: string
  counterparty: string
  matterId: string
  contractType: string
  status: 'draft' | 'active' | 'expired' | 'terminated'
  startDate: string
  endDate: string
  createdAt: string
}

export interface Budget {
  matterId: string
  totalAmount: number
  spent: number
  remaining: number
}

export interface Transaction {
  id: string
  matterId: string
  type: string
  vendorName: string
  amount: number
  status: string
  date: string
}

export interface InsightDashboard {
  totalMatters: number
  activeMatters: number
  totalContracts: number
  activeContracts: number
  pendingTasks: number
  totalSpend: number
  recentActivity: ActivityItem[]
  spendTrends: SpendTrend[]
  contractStatus: ContractStatusItem[]
  matterAging: MatterAgingItem[]
  intakeMetrics: IntakeMetrics
}

export interface SpendTrend {
  month: string
  amount: number
}

export interface ContractStatusItem {
  status: string
  count: number
}

export interface MatterAgingItem {
  bracket: string
  count: number
}

export interface IntakeMetrics {
  totalSubmissions: number
  pendingCount: number
  triagedCount: number
  convertedCount: number
  rejectedCount: number
}

export interface ActivityItem {
  id: string
  description: string
  timestamp: string
  type: string
}

export interface KbEntry {
  id: string
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface MatterDetail extends Matter {
  contracts: Contract[]
  documents: number
  spend: number
  tasks: ClientTask[]
}

export interface ClientTask {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'done' | 'blocked'
  dueDate: string
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  assigneeId?: string
  assigneeName?: string
  matterId?: string
  matterName?: string
}

export interface Task {
  id: string
  matterId: string | null
  title: string
  description: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  assigneeId: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  assigneeName?: string
  matterName?: string
}

export interface CustomMatterField {
  id: string
  orgId: string
  name: string
  fieldType: 'text' | 'select' | 'date' | 'number' | 'boolean'
  options: string | null
  required: boolean
  createdAt: string
  values?: { matterId: string; value: string }[]
}

export interface FetchState<T> {
  loading: boolean
  error: string | null
  data: T | null
}

export interface FormState {
  open: boolean
  submitting: boolean
}

// Billing
export interface Invoice {
  id: string
  matterId: string
  matterName: string
  amount: number
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled'
  date: string
  dueDate?: string
}

export interface TimeEntry {
  id: string
  matterId: string
  matterName: string
  userId: string
  userName: string
  duration: number // in minutes
  description: string
  date: string
  billed: boolean
}

// Contacts
export interface Contact {
  id: string
  name: string
  email: string
  phone: string
  relatedUserId?: string
  relatedUserName?: string
  createdAt: string
}

// Matter Types
export interface MatterType {
  id: string
  name: string
  description: string
  matterCount: number
  createdAt: string
}

// Audit Log
export interface AuditEntry {
  id: string
  matterId: string
  userId: string
  userName: string
  activity: string
  timestamp: string
}

// Intake Forms & Submissions
export interface IntakeForm {
  id: string
  name: string
  formSchema: string | null
  submissionsCount: number
}

export interface IntakeSubmission {
  id: string
  formId: string
  submitter: string
  answers: string
  triageResult?: string
  status: 'PENDING' | 'TRIAGED' | 'CONVERTED' | 'REJECTED'
  createdAt: string
  form?: { name: string }
}

export interface IntakeFormField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'email'
  required?: boolean
  options?: string[]
}

// AI Triage
export interface TriageResult {
  suggestedMatterType: string
  suggestedMatterTitle: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  prefill: Record<string, string>
  confidence: number
}
