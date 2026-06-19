import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/dashboard/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Get current auth user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Query profile from public.profiles table matching user ID
  console.log('--- جلب بيانات الحساب من قاعدة البيانات ---')
  console.log('معرف المستخدم الحالي:', user.id)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, agent_sheets')
    .eq('id', user.id)
    .single()

  if (profileError) {
    // PGRST116 indicates no rows were returned, which is handled gracefully by our fallback metadata.
    // We only log other unexpected database or connection errors.
    if (profileError.code !== 'PGRST116') {
      console.error('خطأ أثناء جلب الملف الشخصي (Profiles Error):', {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code
      })
    }
  } else {
    console.log('تم جلب بيانات الحساب بنجاح:', profile)
  }

  // Fallback metadata if profile does not exist yet
  const profileData = {
    full_name: profile?.full_name || user.email || 'مستخدم جديد',
    role: profile?.role?.toLowerCase() || 'agent',
    email: user.email || '',
    agent_sheets: profile?.agent_sheets || null,
  }

  return (
    <DashboardShell profile={profileData}>
      {children}
    </DashboardShell>
  )
}
