import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/dashboard-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Get current authenticated user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile to check role permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['admin', 'owner', 'leader', 'accountant']
  const userRole = profile?.role?.toLowerCase() || 'agent'

  if (!allowedRoles.includes(userRole)) {
    redirect('/dashboard')
  }

  // Profile data matching DashboardShell structure
  const profileData = {
    full_name: profile?.full_name || user.email || 'مستخدم جديد',
    role: userRole,
    email: user.email || '',
  }

  return (
    <DashboardShell profile={profileData}>
      {children}
    </DashboardShell>
  )
}
