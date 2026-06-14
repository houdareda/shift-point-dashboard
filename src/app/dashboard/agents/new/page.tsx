import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AgentForm from './agent-form'
import { Users, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default async function NewAgentPage() {
  const supabase = await createClient()

  // 1. Retrieve authenticated user on server side
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Check the user's role in the database
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3. Strictly restrict access to admin users only
  if (profile?.role?.toLowerCase() !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        {/* Title */}
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <Users className="h-7 w-7 text-brand-accent" />
            <span>إضافة موظف جديد</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            قم بإنشاء حساب جديد وتعيين الصلاحيات ودور الموظف في النظام مباشرة.
          </p>
        </div>

        {/* Back button */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold text-brand-dim hover:text-white hover:bg-white/5 border border-brand-border transition-all duration-300"
          >
            <span>العودة للرئيسية</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Main Agent Creation Form */}
      <div className="py-4">
        <AgentForm />
      </div>
    </div>
  )
}
