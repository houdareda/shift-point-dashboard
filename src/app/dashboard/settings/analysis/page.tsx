import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import AnalysisSettingsClient from './analysis-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'إعدادات شيتات التحليل - Shift Point',
  description: 'إدارة وتعديل روابط ومعرفات شيتات تحليل الأداء لكافة الأنظمة.',
}

export interface AnalysisSheetConfig {
  system_key: string
  system_label: string
  base_url: string
  monthly_gid: string
  daily_gid: string
  last_month_gid: string
}

export default async function AnalysisSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check role — only admin/owner can access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role?.toLowerCase() || 'agent'
  if (role !== 'admin' && role !== 'owner') {
    redirect('/dashboard')
  }

  // Fetch all rows from the analysis_sheets_config table
  const { data: configs, error } = await supabase
    .from('analysis_sheets_config')
    .select('*')
    .order('system_key', { ascending: true })

  if (error) {
    console.error('Error fetching analysis_sheets_config:', error)
  }

  return (
    <AnalysisSettingsClient
      initialConfigs={(configs as AnalysisSheetConfig[]) ?? []}
      profileName={profile?.full_name || user.email || 'المدير'}
    />
  )
}
