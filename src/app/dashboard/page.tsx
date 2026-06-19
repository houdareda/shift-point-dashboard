import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'
import AdminDashboardClient from './admin-dashboard-client'
import { getIncomingTransfersAction } from '@/app/actions/operations'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Get current authenticated user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Fetch the user's profile info
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profileName = profile?.full_name || user.email || 'مستخدم جديد'
  const userRole = profile?.role?.toLowerCase() || 'agent'

  const allowedOverviewRoles = ['admin', 'owner', 'leader', 'accountant']
  const isOverviewUser = allowedOverviewRoles.includes(userRole)

  if (isOverviewUser) {
    // 1. Fetch all profiles where role = 'agent'
    const { data: agents } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'agent')
      .order('full_name')

    // 2. Fetch all wallets
    const { data: wallets } = await supabase
      .from('wallets')
      .select('id, phone_number, current_balance, is_active, agent_id')
      .neq('is_archived', true)
      .order('created_at', { ascending: false })

    // 3. Fetch all daily reports
    const { data: reports } = await supabase
      .from('daily_reports')
      .select('id, personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, report_date, transfers, agent_id')

    // 4. Fetch all money requests
    const { data: moneyRequests } = await supabase
      .from('money_requests')
      .select('id, amount, status, request_date, agent_id')
      .order('request_date', { ascending: false })

    return (
      <AdminDashboardClient
        agents={agents || []}
        initialWallets={wallets || []}
        initialReports={reports || []}
        initialMoneyRequests={moneyRequests || []}
        profileName={profileName}
        userRole={userRole}
      />
    )
  }

  // 3. Compute local month range (from the 1st of the current month) for normal agents
  const tzOffset = new Date().getTimezoneOffset() * 60000
  // eslint-disable-next-line react-hooks/purity
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]

  // 4. Fetch agent's active wallets (is_active = true, is_archived = false)
  const { data: wallets, error: walletsError } = await supabase
    .from('wallets')
    .select('id, phone_number, current_balance, is_active')
    .eq('agent_id', user.id)
    .eq('is_active', true)
    .neq('is_archived', true)
    .order('created_at', { ascending: false })

  if (walletsError) {
    console.error('Error fetching active wallets for dashboard overview:', walletsError)
  }

  // 5. Fetch agent's daily reports (all-time)
  const { data: reports, error: reportsError } = await supabase
    .from('daily_reports')
    .select('personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, report_date, transfers, total_amount')
    .eq('agent_id', user.id)

  if (reportsError) {
    console.error('Error fetching daily reports for dashboard overview:', reportsError)
  }

  // 6. Fetch agent's money requests (all-time)
  const { data: moneyRequests, error: moneyRequestsError } = await supabase
    .from('money_requests')
    .select('amount, status, request_date')
    .eq('agent_id', user.id)
    .order('request_date', { ascending: false })

  if (moneyRequestsError) {
    console.error('Error fetching money requests for dashboard overview:', moneyRequestsError)
  }

  // 7. Fetch incoming transfers (all-time)
  const incomingReports = await getIncomingTransfersAction(user.id)

  return (
    <DashboardClient
      initialWallets={wallets || []}
      initialReports={reports || []}
      initialMoneyRequests={moneyRequests || []}
      initialIncomingReports={incomingReports}
      userId={user.id}
      profileName={profileName}
    />
  )
}
