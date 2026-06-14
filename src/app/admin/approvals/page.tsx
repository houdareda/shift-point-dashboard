import { createAdminClient } from '@/utils/supabase/server'
import ApprovalsTabs from './approvals-tabs'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const supabase = await createAdminClient()

  // 1. Fetch pending expense edit requests
  const { data: expenseRequests, error: expenseError } = await supabase
    .from('expense_edit_requests')
    .select('*, agent:profiles!expense_edit_requests_agent_id_fkey(full_name), report:daily_reports(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (expenseError) {
    console.error('Error fetching pending expense edit requests:', expenseError)
  }

  // 2. Fetch pending money requests
  const { data: moneyRequests, error: moneyError } = await supabase
    .from('money_requests')
    .select('*, agent:profiles(full_name), wallet:wallets(phone_number, current_balance)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (moneyError) {
    console.error('Error fetching pending money requests:', moneyError)
  }

  // 3. Fetch all profiles to map target agent IDs in transfers arrays
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name')

  if (profilesError) {
    console.error('Error fetching profiles mapping:', profilesError)
  }

  // Build a lookup map of agentId -> fullName
  const agentNameMap: Record<string, string> = {}
  if (profiles) {
    profiles.forEach((p) => {
      agentNameMap[p.id] = p.full_name
    })
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Page Header */}
      <div className="pb-5 border-b border-brand-border">
        <h2 className="text-xl font-bold text-white">لوحة تحكم الموافقات</h2>
        <p className="text-xs text-brand-dim mt-1">
          مراجعة واعتماد أو رفض طلبات تعديل المصاريف اليومية وطلبات الفلوس المقدمة من الموظفين.
        </p>
      </div>

      {/* Approvals Client Component */}
      <ApprovalsTabs
        expenseRequests={(expenseRequests as any) || []}
        moneyRequests={(moneyRequests as any) || []}
        agentNameMap={agentNameMap}
      />
    </div>
  )
}
