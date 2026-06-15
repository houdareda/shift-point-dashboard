import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, UserPlus } from 'lucide-react'
import AgentsList, { Agent } from './agents-list'

export default async function AgentsPage() {
  const supabase = await createClient()

  // 1. Retrieve current user session on the server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Retrieve current user's role to verify permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['admin', 'owner', 'leader']
  const userRole = profile?.role?.toLowerCase() || 'agent'

  if (!allowedRoles.includes(userRole)) {
    redirect('/dashboard')
  }

  // 3. Fetch all profiles from public.profiles
  const { data: agents, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching agents:', error)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        {/* Title */}
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <Users className="h-7 w-7 text-brand-accent" />
            <span>إدارة الموظفين</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            استعرض ودرج الموظفين والمسؤولين وقم بإدارة حساباتهم وصلاحياتهم في النظام.
          </p>
        </div>

        {/* Add Agent Button (Admins only) */}
        {userRole === 'admin' && (
          <div>
            <Link
              href="/dashboard/agents/new"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
            >
              <UserPlus className="h-4.5 w-4.5" />
              <span>إضافة موظف جديد</span>
            </Link>
          </div>
        )}
      </div>

      {/* Agents Listing */}
      <div className="w-full rounded-[24px] bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
        {error ? (
          <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm text-center">
            حدث خطأ أثناء جلب قائمة الموظفين. يرجى المحاولة مرة أخرى.
          </div>
        ) : (
          <AgentsList initialAgents={(agents as unknown as Agent[]) || []} userRole={userRole} />
        )}
      </div>
    </div>
  )
}
