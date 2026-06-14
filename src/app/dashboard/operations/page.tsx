import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import OperationsTabs from './operations-tabs'
import { ClipboardList } from 'lucide-react'

// Server Component for Daily Operations Page
export default async function OperationsPage() {
  const supabase = await createClient()

  // 1. Retrieve current authenticated user session on the server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Fetch active wallets (is_active = true) for the current user
  const { data: wallets, error: walletsError } = await supabase
    .from('wallets')
    .select('id, phone_number, current_balance')
    .eq('agent_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (walletsError) {
    console.error('Error fetching active wallets:', walletsError)
  }

  // 3. Fetch active agents (role = 'agent') excluding the current user
  const { data: agents, error: agentsError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'agent')
    .neq('id', user.id)
    .order('full_name', { ascending: true })

  if (agentsError) {
    console.error('Error fetching agents:', agentsError)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <ClipboardList className="h-7 w-7 text-brand-accent" />
            <span>العمليات اليومية</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            سجّل طلبات الشحن، ومصاريفك الشخصية ومصاريف التسويق، بالإضافة إلى عمليات تحويل الأموال لزملائك.
          </p>
        </div>
      </div>

      {/* Main Operations Tabs (Client Component Wrapper) */}
      <div className="py-2">
        <OperationsTabs wallets={wallets || []} agents={agents || []} currentAgentId={user.id} />
      </div>
    </div>
  )
}
