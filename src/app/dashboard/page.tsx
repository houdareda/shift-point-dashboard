import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'

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

  // 3. Compute local month range (from the 1st of the current month)
  const tzOffset = new Date().getTimezoneOffset() * 60000
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const currentMonthStr = todayLocal.substring(0, 7) // Format: "YYYY-MM"
  const firstDayOfMonth = `${currentMonthStr}-01`

  // 4. Fetch user's active wallets (is_active = true)
  const { data: wallets, error: walletsError } = await supabase
    .from('wallets')
    .select('id, phone_number, current_balance, is_active')
    .eq('agent_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (walletsError) {
    console.error('Error fetching active wallets for dashboard overview:', walletsError)
  }

  // 5. Fetch user's daily reports for the current month
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
    />
  )
}
