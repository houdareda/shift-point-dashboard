import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PerformanceClient from './performance-client'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'شيتات الانالسيز - Shift Point',
  description: 'عرض مباشر لشيتات تحليل الأداء المستوردة ديناميكياً من Google Sheets لكافة الأنظمة.',
}

export default async function PerformancePage() {
  const supabase = await createClient()

  // Retrieve current user details on the server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Retrieve current user's role to verify permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role?.toLowerCase() || 'agent'
  if (userRole === 'accountant') {
    redirect('/dashboard')
  }

  return <PerformanceClient />
}
