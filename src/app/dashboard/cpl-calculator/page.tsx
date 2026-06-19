import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CplCalculatorClient from './cpl-calculator-client'

export const dynamic = 'force-dynamic'

export default async function CplCalculatorPage() {
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
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const profileName = profile?.full_name || user.email || 'مستخدم جديد'
  const userRole = (profile?.role || 'agent').toLowerCase()
  if (userRole === 'accountant') {
    redirect('/dashboard')
  }

  let reports: any[] = []
  let allAgents: any[] = []
  let wallets: any[] = []
  let latestReport: any = null

  if (userRole === 'admin' || userRole === 'owner') {
    // 3. Fetch all reports from all users, joining profiles for the agent name
    const { data: reportsData, error: reportsError } = await supabase
      .from('cpl_reports')
      .select('*, agent:profiles(id, full_name, role)')
      .order('report_date', { ascending: false })

    if (reportsError) {
      console.error('Error fetching all cpl reports history:', reportsError)
    } else {
      reports = reportsData || []
    }

    // 4. Fetch all profiles to populate the agents dropdown
    const { data: agentsData, error: agentsError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name', { ascending: true })

    if (agentsError) {
      console.error('Error fetching profiles:', agentsError)
    } else {
      allAgents = agentsData || []
    }
  } else {
    // 3. Fetch cpl reports history for this user
    const { data: reportsData, error: reportsError } = await supabase
      .from('cpl_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('report_date', { ascending: false })

    if (reportsError) {
      console.error('Error fetching cpl reports history:', reportsError)
    } else {
      reports = reportsData || []
    }

    // 4. Fetch user's active, non-archived wallets list
    const { data: walletsData, error: walletsError } = await supabase
      .from('wallets')
      .select('id, phone_number, current_balance')
      .eq('agent_id', user.id)
      .eq('is_active', true)
      .neq('is_archived', true)
      .order('created_at', { ascending: false })

    if (walletsError) {
      console.error('Error fetching active wallets:', walletsError)
    } else {
      wallets = walletsData || []
    }

    // 5. Fetch user's latest saved report (for smart defaults / sticky data)
    const { data: latestData, error: latestError } = await supabase
      .from('cpl_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestError) {
      console.error('Error fetching latest cpl report:', latestError)
    } else {
      latestReport = latestData || null
    }
  }

  return (
    <CplCalculatorClient
      initialReports={reports}
      profileName={profileName}
      activeWallets={wallets}
      latestReport={latestReport}
      userRole={userRole}
      allAgents={allAgents}
    />
  )
}
