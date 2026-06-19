/* eslint-disable */
'use client'

import { useActionState, useEffect, useState, startTransition, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addMoneyRequestAction } from '@/app/actions/operations'
import { Calendar, Wallet, DollarSign, Lock, Eye, EyeOff, Loader2, Send, CheckCircle, AlertCircle } from 'lucide-react'
import AuditModal from './audit-modal'
import { createClient } from '@/utils/supabase/client'

// Zod Schema for money request form
const moneyRequestSchema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  amount: z.coerce.number().positive('يجب أن يكون المبلغ أكبر من صفر'),
  walletId: z.string().uuid('يرجى اختيار محفظة صالحة'),
  password: z.string().min(1, 'كلمة المرور مطلوبة لتأكيد الطلب'),
})

type MoneyRequestSchema = z.infer<typeof moneyRequestSchema>

interface MoneyRequestFormProps {
  wallets: Array<{ id: string; phone_number: string; current_balance: number }>
  currentAgentId: string
}

export default function MoneyRequestForm({ wallets, currentAgentId }: MoneyRequestFormProps) {
  const [state, dispatch, pending] = useActionState(addMoneyRequestAction, null)
  const [showPassword, setShowPassword] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const lastFormDataRef = useRef<FormData | null>(null)

  const [realtimeToast, setRealtimeToast] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({
    show: false,
    message: '',
    type: 'success'
  })

  const triggerRealtimeToast = (message: string, type: 'success' | 'error') => {
    setRealtimeToast({ show: true, message, type })
    setTimeout(() => {
      setRealtimeToast((prev) => ({ ...prev, show: false }))
    }, 5000)
  }

  useEffect(() => {
    if (!currentAgentId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`agent-money-requests-${currentAgentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'money_requests',
          filter: `agent_id=eq.${currentAgentId}`
        },
        (payload) => {
          console.log('Realtime money request update received:', payload.new)
          const updated = payload.new
          
          if (updated.status === 'approved') {
            triggerRealtimeToast(
              `تمت الموافقة على طلب شحن الرصيد بقيمة ${Number(updated.amount).toLocaleString('en-US')} ج.م بنجاح!`,
              'success'
            )
          } else if (updated.status === 'rejected') {
            triggerRealtimeToast(
              `تم رفض طلب شحن الرصيد بقيمة ${Number(updated.amount).toLocaleString('en-US')} ج.م.`,
              'error'
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentAgentId])

  // Calculate local today and yesterday dates to set HTML input restriction
  const tzOffset = new Date().getTimezoneOffset() * 60000
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const yesterdayLocal = new Date(Date.now() - tzOffset - 86400000).toISOString().split('T')[0]

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors: clientErrors },
  } = useForm<MoneyRequestSchema>({
    resolver: zodResolver(moneyRequestSchema) as any,
    defaultValues: {
      date: todayLocal,
      amount: '' as unknown as number,
      walletId: '',
      password: '',
    },
  })

  // Sync server errors or handle success
  useEffect(() => {
    if (state?.success) {
      reset({
        date: todayLocal,
        amount: '' as unknown as number,
        walletId: '',
        password: '',
      })
      setShowToast(true)

      if (state.id) {
        const supabase = createClient()
        const channel = supabase.channel('admin-realtime-approvals')
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'new-money-request',
              payload: { id: state.id },
            })
          }
        })
        setTimeout(() => {
          supabase.removeChannel(channel)
        }, 3000)
      }

      const timer = setTimeout(() => setShowToast(false), 4500)
      return () => clearTimeout(timer)
    } else if (state?.error === 'ERR_AUDIT_REQUIRED') {
      setShowAuditModal(true)
    } else if (state?.errors) {
      if (state.errors.date) {
        setError('date', { type: 'server', message: state.errors.date[0] })
      }
      if (state.errors.amount) {
        setError('amount', { type: 'server', message: state.errors.amount[0] })
      }
      if (state.errors.walletId) {
        setError('walletId', { type: 'server', message: state.errors.walletId[0] })
      }
      if (state.errors.password) {
        setError('password', { type: 'server', message: state.errors.password[0] })
      }
    }
  }, [state, reset, setError, todayLocal])

  const onSubmit = (data: MoneyRequestSchema) => {
    const formData = new FormData()
    formData.append('date', data.date)
    formData.append('amount', String(data.amount))
    formData.append('walletId', data.walletId)
    formData.append('password', data.password)

    lastFormDataRef.current = formData

    startTransition(() => {
      dispatch(formData)
    })
  }

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-[#10b981] text-white px-5 py-3.5 rounded-xl shadow-[0_8px_32px_rgba(16,185,129,0.35)] flex items-center gap-3 text-sm font-bold border border-emerald-400/20 animate-fade-in transition-all duration-300">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>تم إرسال طلب شحن الرصيد بنجاح!</span>
        </div>
      )}

      {/* Realtime Toast Notification */}
      {realtimeToast.show && (
        <div
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3 text-sm font-bold border animate-fade-in transition-all duration-300 ${
            realtimeToast.type === 'success'
              ? 'bg-[#10b981] text-white border-emerald-400/20 shadow-[0_8px_32px_rgba(16,185,129,0.3)]'
              : 'bg-brand-error text-white border-red-500/20 shadow-[0_8px_32px_rgba(239,68,68,0.3)]'
          }`}
        >
          {realtimeToast.type === 'success' ? (
            <CheckCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{realtimeToast.message}</span>
        </div>
      )}

      <div className="w-full rounded-[24px] bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden text-right">
        <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

        <h3 className="text-lg font-bold text-white mb-2">طلب شحن رصيد أموال</h3>
        <p className="text-xs text-brand-dim mb-6 leading-relaxed">
          أرسل طلباً جديداً لشحن رصيد إلى إحدى محافظك الإلكترونية النشطة. يتطلب تأكيد العملية إدخال كلمة مرور حسابك الشخصي.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Server Error Alert */}
          {state?.error && state.error !== 'ERR_AUDIT_REQUIRED' && (
            <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm font-semibold text-center animate-pulse">
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Request Date */}
            <div className="space-y-2">
              <label htmlFor="date" className="block text-xs font-semibold text-brand-dim">
                تاريخ الطلب
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="date"
                  dir="ltr"
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
                  {...register('date')}
                  disabled={pending}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
              </div>
              {clientErrors.date && (
                <p className="text-[11px] text-brand-error font-medium">{clientErrors.date.message}</p>
              )}
            </div>

            {/* Wallet Selection */}
            <div className="space-y-2">
              <label htmlFor="walletId" className="block text-xs font-semibold text-brand-dim">
                المحفظة المستهدفة
              </label>
              <div className="relative">
                <select
                  id="walletId"
                  className="block w-full rounded-xl bg-brand-bg/90 border border-white/[0.08] py-3.5 pl-4 pr-11 text-white appearance-none focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm cursor-pointer"
                  {...register('walletId')}
                  disabled={pending}
                >
                  <option value="" className="bg-brand-bg text-brand-dim">اختر محفظة...</option>
                  {wallets
                    .filter((wallet) => Number(wallet.current_balance || 0) < 200000)
                    .map((wallet) => (
                      <option key={wallet.id} value={wallet.id} className="bg-brand-bg text-white font-mono">
                        {wallet.phone_number} (الرصيد: {Number(wallet.current_balance || 0).toLocaleString('en-US')} ج.م)
                      </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                  <Wallet className="h-4.5 w-4.5" />
                </div>
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/30">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {clientErrors.walletId && (
                <p className="text-[11px] text-brand-error font-medium">{clientErrors.walletId.message}</p>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label htmlFor="amount" className="block text-xs font-semibold text-brand-dim">
                المبلغ المطلوب (ج.م)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="amount"
                  dir="ltr"
                  step="0.01"
                  placeholder="0.00"
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
                  {...register('amount')}
                  disabled={pending}
                  autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                  <DollarSign className="h-4.5 w-4.5" />
                </div>
              </div>
              {clientErrors.amount && (
                <p className="text-[11px] text-brand-error font-medium">{clientErrors.amount.message}</p>
              )}
            </div>

            {/* Password Confirmation */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-semibold text-brand-dim">
                تأكيد بكلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  dir="ltr"
                  placeholder="أدخل كلمة مرور حسابك"
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-11 pr-11 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left placeholder:text-right"
                  {...register('password')}
                  disabled={pending}
                  autoComplete="new-password"
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
            </div>
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={pending}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
            >
              {pending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>جاري إرسال الطلب...</span>
                </>
              ) : (
                <>
                  <Send className="h-4.5 w-4.5" />
                  <span>إرسال طلب الشحن</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <AuditModal
        isOpen={showAuditModal}
        wallets={wallets}
        onSuccess={() => {
          setShowAuditModal(false)
          if (lastFormDataRef.current) {
            startTransition(() => {
              dispatch(lastFormDataRef.current!)
            })
          }
        }}
      />
    </>
  )
}
