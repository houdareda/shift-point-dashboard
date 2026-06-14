'use client'

import { useActionState, useEffect, useState, startTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addAgentAction } from '@/app/actions/agents'
import { User, Mail, Lock, Shield, Eye, EyeOff, Loader2, Users, FolderKanban } from 'lucide-react'

// Zod validation schema
const agentSchema = z.object({
  fullName: z.string().min(1, 'الاسم الكامل مطلوب'),
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('البريد الإلكتروني غير صالح'),
  password: z
    .string()
    .min(6, 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل'),
  role: z.enum(['agent', 'leader', 'accountant', 'admin'], {
    message: 'الدور المحدد غير صالح',
  }),
  teamId: z.string().optional(),
})

type AgentSchema = z.infer<typeof agentSchema>

export default function AgentForm() {
  const [state, dispatch, pending] = useActionState(addAgentAction, null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: clientErrors },
  } = useForm<AgentSchema>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'agent',
      teamId: '',
    },
  })

  // Reset form upon successful user creation
  useEffect(() => {
    if (state?.success) {
      reset()
    }
  }, [state, reset])

  const onSubmit = (data: AgentSchema) => {
    const formData = new FormData()
    formData.append('fullName', data.fullName)
    formData.append('email', data.email)
    formData.append('password', data.password)
    formData.append('role', data.role)
    if (data.teamId) {
      formData.append('teamId', data.teamId)
    }

    startTransition(() => {
      dispatch(formData)
    })
  }

  return (
    <div className="w-full max-w-2xl mx-auto rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden text-right">
      <div className="absolute -top-[120px] -right-[120px] w-[250px] h-[250px] bg-brand-accent/5 rounded-full blur-[60px] pointer-events-none" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
        {/* Server Success Alert */}
        {state?.success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold text-center animate-fade-in">
            تم إنشاء حساب الموظف وملفه الشخصي بنجاح وتفعيل بريده الإلكتروني!
          </div>
        )}

        {/* Server Error Alert */}
        {state?.error && (
          <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm font-semibold text-center animate-pulse">
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div className="space-y-2">
            <label htmlFor="fullName" className="block text-xs font-semibold text-brand-dim">
              الاسم الكامل
            </label>
            <div className="relative">
              <input
                type="text"
                id="fullName"
                autoComplete="off"
                placeholder="أدخل الاسم الرباعي"
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm"
                {...register('fullName')}
                disabled={pending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <User className="h-4.5 w-4.5" />
              </div>
            </div>
            {clientErrors.fullName && (
              <p className="text-[11px] text-brand-error font-medium">{clientErrors.fullName.message}</p>
            )}
            {state?.errors?.fullName && (
              <p className="text-[11px] text-brand-error font-medium">{state.errors.fullName[0]}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-semibold text-brand-dim">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                dir="ltr"
                autoComplete="new-email"
                placeholder="name@company.com"
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 text-left dir-ltr focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm font-mono"
                {...register('email')}
                disabled={pending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <Mail className="h-4.5 w-4.5" />
              </div>
            </div>
            {clientErrors.email && (
              <p className="text-[11px] text-brand-error font-medium">{clientErrors.email.message}</p>
            )}
            {state?.errors?.email && (
              <p className="text-[11px] text-brand-error font-medium">{state.errors.email[0]}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-semibold text-brand-dim">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                dir="ltr"
                autoComplete="new-password"
                placeholder="حدّد كلمة مرور قوية"
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-11 pr-11 text-white placeholder:text-white/20 text-left placeholder:text-right dir-ltr focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm"
                {...register('password')}
                disabled={pending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/30 hover:text-white/60 transition-colors"
                disabled={pending}
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
            {clientErrors.password && (
              <p className="text-[11px] text-brand-error font-medium">{clientErrors.password.message}</p>
            )}
            {state?.errors?.password && (
              <p className="text-[11px] text-brand-error font-medium">{state.errors.password[0]}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label htmlFor="role" className="block text-xs font-semibold text-brand-dim">
              الدور / الصلاحية
            </label>
            <div className="relative">
              <select
                id="role"
                className="block w-full rounded-xl bg-brand-bg/90 border border-white/[0.08] py-3.5 pl-4 pr-11 text-white appearance-none focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm cursor-pointer"
                {...register('role')}
                disabled={pending}
              >
                <option value="agent" className="bg-brand-bg text-white">موظف (Agent)</option>
                <option value="leader" className="bg-brand-bg text-white">قائد فريق (Leader)</option>
                <option value="accountant" className="bg-brand-bg text-white">محاسب (Accountant)</option>
                <option value="admin" className="bg-brand-bg text-white">مدير النظام (Admin)</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <Shield className="h-4.5 w-4.5" />
              </div>
              {/* Custom Dropdown Arrow */}
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/30">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {clientErrors.role && (
              <p className="text-[11px] text-brand-error font-medium">{clientErrors.role.message}</p>
            )}
            {state?.errors?.role && (
              <p className="text-[11px] text-brand-error font-medium">{state.errors.role[0]}</p>
            )}
          </div>

          {/* Team ID (Optional) */}
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="teamId" className="block text-xs font-semibold text-brand-dim">
              معرف الفريق (Team ID) - اختياري
            </label>
            <div className="relative">
              <input
                type="text"
                id="teamId"
                autoComplete="off"
                placeholder="أدخل كود الفريق أو اتركه فارغاً"
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm"
                {...register('teamId')}
                disabled={pending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <FolderKanban className="h-4.5 w-4.5" />
              </div>
            </div>
            {clientErrors.teamId && (
              <p className="text-[11px] text-brand-error font-medium">{clientErrors.teamId.message}</p>
            )}
            {state?.errors?.teamId && (
              <p className="text-[11px] text-brand-error font-medium">{state.errors.teamId[0]}</p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={pending}
            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
          >
            {pending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>جاري إنشاء حساب الموظف...</span>
              </>
            ) : (
              <>
                <Users className="h-5 w-5" />
                <span>إنشاء حساب الموظف</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
