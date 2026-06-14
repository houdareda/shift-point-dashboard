'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Shield,
  Award,
  User,
  Briefcase,
  Pencil,
  UserX,
  UserCheck,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2
} from 'lucide-react'
import { updateAgentAction, toggleAgentSuspensionAction } from '@/app/actions/agents'

interface Agent {
  id: string
  full_name: string | null
  role: string | null
  team_id: string | null
  created_at: string
}

interface AgentsListProps {
  initialAgents: Agent[]
  userRole?: string
}

interface RoleDetail {
  label: string
  icon: React.ComponentType<any>
  color: string
}

const ROLE_MAP: Record<string, RoleDetail> = {
  admin: { label: 'مدير النظام', icon: Shield, color: 'text-red-400 bg-red-400/10 border-red-500/20' },
  owner: { label: 'مدير النظام', icon: Shield, color: 'text-red-400 bg-red-400/10 border-red-500/20' },
  leader: { label: 'قائد فريق', icon: Award, color: 'text-amber-400 bg-amber-400/10 border-amber-500/20' },
  agent: { label: 'موظف', icon: User, color: 'text-blue-400 bg-blue-400/10 border-blue-500/20' },
  accountant: { label: 'محاسب', icon: Briefcase, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20' },
  suspended: { label: 'موقوف', icon: AlertCircle, color: 'text-red-500 bg-red-500/10 border-red-600/20' }
}

export default function AgentsList({ initialAgents, userRole }: AgentsListProps) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents)
  const isAdmin = userRole?.toLowerCase() === 'admin'

  // Modal States
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [suspendingAgent, setSuspendingAgent] = useState<Agent | null>(null)

  // Edit Form Fields State
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editTeamId, setEditTeamId] = useState('')

  // UI States
  const [isPending, setIsPending] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })

  useEffect(() => {
    setAgents(initialAgents)
  }, [initialAgents])

  // Realtime profiles synchronization
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('public-profiles-list')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('Realtime profiles INSERT received:', payload.new)
          setAgents((prev) => {
            if (prev.some((a) => a.id === payload.new.id)) return prev
            return [payload.new as Agent, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('Realtime profiles UPDATE received:', payload.new)
          setAgents((prev) =>
            prev.map((a) => (a.id === payload.new.id ? { ...a, ...payload.new } : a))
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          console.log('Realtime profiles DELETE received:', payload.old)
          setAgents((prev) => prev.filter((a) => a.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const triggerToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }))
    }, 4500)
  }

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent)
    setEditName(agent.full_name || '')
    setEditRole(agent.role || 'agent')
    setEditTeamId(agent.team_id || '')
    setActionError('')
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAgent) return

    setIsPending(true)
    setActionError('')

    try {
      const trimmedTeamId = editTeamId.trim() || null
      const res = await updateAgentAction(
        editingAgent.id,
        editName,
        editRole,
        trimmedTeamId
      )

      if (res.success) {
        // Local Optimistic UI Update
        setAgents((prev) =>
          prev.map((a) =>
            a.id === editingAgent.id
              ? { ...a, full_name: editName, role: editRole, team_id: trimmedTeamId }
              : a
          )
        )
        triggerToast('تم تحديث بيانات الموظف بنجاح.', 'success')
        setEditingAgent(null)
      } else {
        setActionError(res.error || 'حدث خطأ أثناء حفظ التعديلات.')
      }
    } catch (err) {
      console.error(err)
      setActionError('حدث خطأ غير متوقع أثناء معالجة الطلب.')
    } finally {
      setIsPending(false)
    }
  }

  const handleToggleSuspension = async () => {
    if (!suspendingAgent) return

    setIsPending(true)
    try {
      const res = await toggleAgentSuspensionAction(suspendingAgent.id, suspendingAgent.role || 'agent')
      if (res.success) {
        const isCurrentlySuspended = suspendingAgent.role === 'suspended'
        const newRole = isCurrentlySuspended ? 'agent' : 'suspended'

        // Local Optimistic UI Update
        setAgents((prev) =>
          prev.map((a) =>
            a.id === suspendingAgent.id
              ? { ...a, role: newRole }
              : a
          )
        )

        const successMessage = isCurrentlySuspended
          ? `تم إعادة تفعيل حساب الموظف "${suspendingAgent.full_name || ''}" بنجاح.`
          : `تم إيقاف حساب الموظف "${suspendingAgent.full_name || ''}" بنجاح.`

        triggerToast(successMessage, 'success')
        setSuspendingAgent(null)
      } else {
        triggerToast(res.error || 'فشل تعديل حالة الحساب.', 'error')
      }
    } catch (err) {
      console.error(err)
      triggerToast('حدث خطأ غير متوقع.', 'error')
    } finally {
      setIsPending(false)
    }
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-12 text-brand-dim">
        لا يوجد موظفين مسجلين حالياً.
      </div>
    )
  }

  return (
    <>
      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3 text-sm font-bold border animate-fade-in transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-[#10b981] text-white border-emerald-400/20 shadow-[0_8px_32px_rgba(16,185,129,0.3)]'
              : 'bg-brand-error text-white border-red-500/20 shadow-[0_8px_32px_rgba(239,68,68,0.3)]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Agents Table List */}
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-brand-border text-brand-dim text-xs font-semibold pb-4">
              <th className="pb-4 pt-2 font-semibold">الاسم الكامل</th>
              <th className="pb-4 pt-2 font-semibold">الدور الصلاحية</th>
              <th className="pb-4 pt-2 font-semibold">رقم الفريق (Team ID)</th>
              <th className="pb-4 pt-2 font-semibold hidden md:table-cell">تاريخ الإنشاء</th>
              {isAdmin && <th className="pb-4 pt-2 font-semibold text-left pl-8">الإجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/40 text-sm text-white">
            {agents.map((agent) => {
              const roleKey = agent.role?.toLowerCase() || 'agent'
              const roleDetail = ROLE_MAP[roleKey] || ROLE_MAP.agent
              const RoleIcon = roleDetail.icon

              const creationDate = agent.created_at
                ? new Date(agent.created_at).toLocaleDateString('ar-EG-u-nu-latn', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })
                : 'غير محدد'

              return (
                <tr key={agent.id} className="hover:bg-white/[0.01] transition-colors duration-250">
                  {/* Name */}
                  <td className="py-4 font-semibold text-white">
                    {agent.full_name || 'مستخدم جديد'}
                  </td>

                  {/* Role Badge */}
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${roleDetail.color}`}>
                      <RoleIcon className="h-3.5 w-3.5" />
                      {roleDetail.label}
                    </span>
                  </td>

                  {/* Team ID */}
                  <td className="py-4 font-mono text-brand-dim">
                    {agent.team_id || '—'}
                  </td>

                  {/* Created At Date */}
                  <td className="py-4 text-brand-dim hidden md:table-cell">
                    {creationDate}
                  </td>

                  {/* Actions Column (Admins only) */}
                  {isAdmin && (
                    <td className="py-4 text-left pl-8">
                      {roleKey !== 'admin' && roleKey !== 'owner' ? (
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(agent)}
                            className="inline-flex items-center justify-center p-2 rounded-xl text-brand-accent bg-brand-accent/10 border border-brand-accent/15 hover:bg-brand-accent/25 transition-all duration-300 cursor-pointer"
                            title="تعديل الموظف"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* Suspension / Reactivation Button */}
                          {roleKey === 'suspended' ? (
                            <button
                              onClick={() => setSuspendingAgent(agent)}
                              className="inline-flex items-center justify-center p-2 rounded-xl text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 hover:bg-emerald-500/25 transition-all duration-300 cursor-pointer"
                              title="تفعيل الحساب"
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setSuspendingAgent(agent)}
                              className="inline-flex items-center justify-center p-2 rounded-xl text-brand-error bg-brand-error/10 border border-brand-error/15 hover:bg-brand-error/25 transition-all duration-300 cursor-pointer"
                              title="إيقاف الحساب"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-brand-dim pl-2 select-none cursor-not-allowed" title="حساب مسؤول محمي">غير قابل للتعديل</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Agent Modal Overlay */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative text-right animate-scale-up">
            <button
              onClick={() => setEditingAgent(null)}
              className="absolute top-4 left-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2">تعديل بيانات الموظف</h3>
            <p className="text-xs text-brand-dim mb-6">
              قم بتعديل بيانات الموظف والصلاحيات وفريق العمل الخاص به في النظام.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-4.5">
              {actionError && (
                <div className="p-3.5 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-xs font-semibold text-center animate-pulse">
                  {actionError}
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-brand-dim">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3 px-4 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm text-right"
                  disabled={isPending}
                />
              </div>

              {/* Role Select */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-brand-dim">الصلاحية / الدور</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="block w-full rounded-xl bg-brand-bg border border-white/[0.08] py-3 px-4 text-white appearance-none focus:border-brand-accent focus:outline-none transition-all duration-300 text-sm cursor-pointer"
                  disabled={isPending}
                >
                  <option value="agent" className="bg-brand-bg text-white">موظف</option>
                  <option value="leader" className="bg-brand-bg text-white">قائد فريق</option>
                  <option value="accountant" className="bg-brand-bg text-white">محاسب</option>
                  <option value="admin" className="bg-brand-bg text-white">مدير النظام</option>
                </select>
              </div>

              {/* Team ID */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-brand-dim">رقم الفريق (Team ID)</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="اتركه فارغاً إذا لم يكن ينتمي لفريق"
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value)}
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3 px-4 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm text-left font-mono placeholder:text-white/20 placeholder:text-right"
                  disabled={isPending}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  disabled={isPending}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-brand-dim bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 flex justify-center items-center gap-1.5 py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspension/Reactivation Modal Overlay */}
      {suspendingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative text-right animate-scale-up">
            <button
              onClick={() => setSuspendingAgent(null)}
              className="absolute top-4 left-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Suspend Alert Icon */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              suspendingAgent.role === 'suspended'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-brand-error/10 border border-brand-error/20 text-brand-error'
            }`}>
              <AlertCircle className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              {suspendingAgent.role === 'suspended' ? 'إعادة تفعيل حساب الموظف' : 'إيقاف حساب الموظف'}
            </h3>
            <p className="text-xs text-brand-dim mb-6 leading-relaxed">
              {suspendingAgent.role === 'suspended'
                ? `هل أنت متأكد من إعادة تفعيل حساب الموظف "${suspendingAgent.full_name || ''}"؟ سيتمكن من تسجيل الدخول واستخدام النظام كالمعتاد.`
                : `هل أنت متأكد من إيقاف حساب الموظف "${suspendingAgent.full_name || ''}"؟ لن يتمكن من تسجيل الدخول بعد الآن، ولكن سيتم الاحتفاظ بكافة بياناته المالية وتقاريره التاريخية في النظام لحماية البيانات.`
              }
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSuspendingAgent(null)}
                disabled={isPending}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-brand-dim bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleToggleSuspension}
                disabled={isPending}
                className={`flex-1 flex justify-center items-center gap-1.5 py-3 px-4 rounded-xl text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50 ${
                  suspendingAgent.role === 'suspended'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-brand-error hover:bg-brand-error/80 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                }`}
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {suspendingAgent.role === 'suspended' ? 'تأكيد التفعيل' : 'تأكيد الإيقاف'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
