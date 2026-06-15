import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'
import AdminDashboardClient from './admin-dashboard-client'

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
      .order('created_at', { ascending: false })

    // 3. Fetch all daily reports
    const { data: reports } = await supabase
      .from('daily_reports')
      .select('id, personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, report_date, transfers, agent_id')

    return (
      <AdminDashboardClient
        agents={agents || []}
        initialWallets={wallets || []}
        initialReports={reports || []}
        profileName={profileName}
        userRole={userRole}
      />
    )
  }

  // 3. Compute local month range (from the 1st of the current month) for normal agents
  const tzOffset = new Date().getTimezoneOffset() * 60000
  // eslint-disable-next-line react-hooks/purity
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const currentMonthStr = todayLocal.substring(0, 7) // Format: "YYYY-MM"
  const firstDayOfMonth = `${currentMonthStr}-01`

  // 4. Fetch agent's active wallets (is_active = true)
  const { data: wallets, error: walletsError } = await supabase
    .from('wallets')
    .select('id, phone_number, current_balance, is_active')
    .eq('agent_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (walletsError) {
    console.error('Error fetching active wallets for dashboard overview:', walletsError)
  }

  // 5. Fetch agent's daily reports for the current month
  const { data: reports, error: reportsError } = await supabase
    .from('daily_reports')
    .select('personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, report_date, transfers')
    .eq('agent_id', user.id)
    .gte('report_date', firstDayOfMonth)

  if (reportsError) {
    console.error('Error fetching daily reports for dashboard overview:', reportsError)
  }

  return (
    <DashboardClient
      initialWallets={wallets || []}
      initialReports={reports || []}
      userId={user.id}
      profileName={profileName}
      agentSheets={profile?.agent_sheets as Record<string, string> | null}
    />
  )
}
