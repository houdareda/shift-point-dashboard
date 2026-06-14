'use client'

import { useActionState, useEffect, useState, startTransition, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDailyExpensesAction } from '@/app/actions/operations'
import { Calendar, Receipt, DollarSign, Loader2, Send, CheckCircle, UserPlus, Trash2, User, Lock, Eye, EyeOff } from 'lucide-react'
import AuditModal from './audit-modal'

// Zod Schema for daily expenses & transfers unified validation
const transferItemSchema = z.object({
  targetAgentId: z.string().uuid('يرجى اختيار موظف صالح'),
  amount: z.coerce.number().positive('يجب أن يكون مبلغ التحويل أكبر من صفر'),
})

const dailyExpensesSchema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  personalExpenses: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0),
  marketing1Expenses: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0),
  marketing2Expenses: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0),
  marketing3Expenses: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0),
  transfers: z.array(transferItemSchema).default([]),
  password: z.string().min(1, 'كلمة المرور مطلوبة للتأكيد'),
})

type DailyExpensesSchema = z.infer<typeof dailyExpensesSchema>

interface ExpensesFormProps {
  agents: Array<{ id: string; full_name: string }>
  wallets: Array<{ id: string; phone_number: string }>
}

export default function ExpensesForm({ agents, wallets }: ExpensesFormProps) {
  const [state, dispatch, pending] = useActionState(addDailyExpensesAction, null)
  const [showPassword, setShowPassword] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const lastFormDataRef = useRef<FormData | null>(null)

  // Calculate local today and yesterday dates to set HTML input restriction
  const tzOffset = new Date().getTimezoneOffset() * 60000
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const yesterdayLocal = new Date(Date.now() - tzOffset - 86400000).toISOString().split('T')[0]

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors: clientErrors },
  } = useForm<DailyExpensesSchema>({
    resolver: zodResolver(dailyExpensesSchema) as any,
    defaultValues: {
      date: todayLocal,
      personalExpenses: '' as unknown as number,
      marketing1Expenses: '' as unknown as number,
      marketing2Expenses: '' as unknown as number,
      marketing3Expenses: '' as unknown as number,
      transfers: [],
      password: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'transfers',
  })

  // Sync server errors or handle success
  useEffect(() => {
    if (state?.success) {
      reset({
        date: todayLocal,
        personalExpenses: '' as unknown as number,
        marketing1Expenses: '' as unknown as number,
        marketing2Expenses: '' as unknown as number,
        marketing3Expenses: '' as unknown as number,
        transfers: [],
        password: '',
      })
      setShowToast(true)
      const timer = setTimeout(() => setShowToast(false), 4500)
      return () => clearTimeout(timer)
    } else if (state?.error === 'ERR_AUDIT_REQUIRED') {
      setShowAuditModal(true)
    } else if (state?.errors) {
      if (state.errors.date) {
        setError('date', { type: 'server', message: state.errors.date[0] })
      }
      if (state.errors.personalExpenses) {
        setError('personalExpenses', { type: 'server', message: state.errors.personalExpenses[0] })
      }
      if (state.errors.marketing1Expenses) {
        setError('marketing1Expenses', { type: 'server', message: state.errors.marketing1Expenses[0] })
      }
      if (state.errors.marketing2Expenses) {
        setError('marketing2Expenses', { type: 'server', message: state.errors.marketing2Expenses[0] })
      }
      if (state.errors.marketing3Expenses) {
        setError('marketing3Expenses', { type: 'server', message: state.errors.marketing3Expenses[0] })
      }
      if (state.errors.password) {
        setError('password', { type: 'server', message: state.errors.password[0] })
      }
      if (state.errors.transfers) {
        setError('transfers', { type: 'server', message: state.errors.transfers[0] })
      }
    }
  }, [state, reset, setError, todayLocal])

  const onSubmit = (data: DailyExpensesSchema) => {
    const formData = new FormData()
    formData.append('date', data.date)
    formData.append('personalExpenses', String(data.personalExpenses || 0))
    formData.append('marketing1Expenses', String(data.marketing1Expenses || 0))
    formData.append('marketing2Expenses', String(data.marketing2Expenses || 0))
    formData.append('marketing3Expenses', String(data.marketing3Expenses || 0))
    formData.append('transfers', JSON.stringify(data.transfers || []))
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
          <span>تم تسجيل المصاريف والتحويلات اليومية بنجاح!</span>
        </div>
      )}

      <div className="w-full rounded-[24px] bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden text-right">
        <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

        <h3 className="text-lg font-bold text-white mb-2">إغلاق المصاريف والتحويلات اليومية</h3>
        <p className="text-xs text-brand-dim mb-6 leading-relaxed">
          سجل تقريرك المالي اليومي. أدخل المصروفات الشخصية ومصاريف التسويق، بالإضافة إلى عمليات تحويل العهدة لزملائك. يتطلب تأكيد العملية إدخال كلمة المرور.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Server Error Alert */}
          {state?.error && state.error !== 'ERR_AUDIT_REQUIRED' && (
            <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm font-semibold text-center animate-pulse">
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Request Date */}
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="date" className="block text-xs font-semibold text-brand-dim">
                تاريخ التقرير
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="date"
                  dir="ltr"
                  min={yesterdayLocal}
                  max={todayLocal}
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
              <p className="text-[10px] text-brand-accent/80 font-medium">
                * يمكنك إغلاق اليوم (النهاردة أو إمبارح) بحد أقصى مرتين فقط.
              </p>
            </div>

            {/* Personal Expenses */}
            <div className="space-y-2">
              <label htmlFor="personalExpenses" className="block text-xs font-semibold text-brand-dim">
                المصاريف الشخصية (ج.م)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="personalExpenses"
                  dir="ltr"
                  step="0.01"
                  placeholder="0.00"
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
                  {...register('personalExpenses')}
                  disabled={pending}
                  autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                  <DollarSign className="h-4.5 w-4.5" />
                </div>
              </div>
              {clientErrors.personalExpenses && (
                <p className="text-[11px] text-brand-error font-medium">{clientErrors.personalExpenses.message}</p>
              )}
            </div>

            {/* Marketing 1 Expenses */}
            <div className="space-y-2">
              <label htmlFor="marketing1Expenses" className="block text-xs font-semibold text-brand-dim">
                مصاريف ماركتنج 1 (ج.م)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="marketing1Expenses"
                  dir="ltr"
                  step="0.01"
                  placeholder="0.00"
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
                  {...register('marketing1Expenses')}
                  disabled={pending}
                  autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                  <Receipt className="h-4.5 w-4.5" />
                </div>
              </div>
              {clientErrors.marketing1Expenses && (
                <p className="text-[11px] text-brand-error font-medium">{clientErrors.marketing1Expenses.message}</p>
              )}
            </div>

            {/* Marketing 2 Expenses */}
            <div className="space-y-2">
              <label htmlFor="marketing2Expenses" className="block text-xs font-semibold text-brand-dim">
                مصاريف ماركتنج 2 (ج.م)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="marketing2Expenses"
                  dir="ltr"
                  step="0.01"
                  placeholder="0.00"
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
                  {...register('marketing2Expenses')}
                  disabled={pending}
                  autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                  <Receipt className="h-4.5 w-4.5" />
                </div>
              </div>
              {clientErrors.marketing2Expenses && (
                <p className="text-[11px] text-brand-error font-medium">{clientErrors.marketing2Expenses.message}</p>
              )}
            </div>

            {/* Marketing 3 Expenses */}
            <div className="space-y-2">
              <label htmlFor="marketing3Expenses" className="block text-xs font-semibold text-brand-dim">
                مصاريف ماركتنج 3 (ج.م)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="marketing3Expenses"
                  dir="ltr"
                  step="0.01"
                  placeholder="0.00"
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
                  {...register('marketing3Expenses')}
                  disabled={pending}
                  autoComplete="off"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                  <Receipt className="h-4.5 w-4.5" />
                </div>
              </div>
              {clientErrors.marketing3Expenses && (
                <p className="text-[11px] text-brand-error font-medium">{clientErrors.marketing3Expenses.message}</p>
              )}
            </div>
          </div>

          {/* Dynamic Transfers List */}
          <div className="border-t border-brand-border/60 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => append({ targetAgentId: '', amount: '' as unknown as number })}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-brand-accent/10 border border-brand-accent/20 hover:bg-brand-accent/20 transition-all duration-300 cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                <span>إضافة تحويل لزميل</span>
              </button>
              <h4 className="text-sm font-bold text-white">تحويلات العهدة للزملاء</h4>
            </div>

            {/* Error notifications for transfers array validation */}
            {clientErrors.transfers?.root && (
              <p className="text-xs text-brand-error font-medium">{clientErrors.transfers.root.message}</p>
            )}
            {clientErrors.transfers && !Array.isArray(clientErrors.transfers) && (
              <p className="text-xs text-brand-error font-medium">{(clientErrors.transfers as any).message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => {
                const targetAgentIdError = clientErrors.transfers?.[index]?.targetAgentId
                const amountError = clientErrors.transfers?.[index]?.amount

                return (
                  <div
                    key={field.id}
                    className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 p-4 rounded-2xl bg-white/[0.01] border border-white/[0.04] relative group transition-all duration-300 hover:border-brand-border"
                  >
                    {/* Target Agent Select */}
                    <div className="flex-1 space-y-1">
                      <div className="relative">
                        <select
                          className="block w-full rounded-xl bg-brand-bg/95 border border-white/[0.08] py-3 pl-4 pr-11 text-white appearance-none focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs cursor-pointer"
                          {...register(`transfers.${index}.targetAgentId` as const)}
                          disabled={pending}
                        >
                          <option value="" className="bg-brand-bg text-brand-dim">اختر الموظف...</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id} className="bg-brand-bg text-white">
                              {agent.full_name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-white/30">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {targetAgentIdError && (
                        <p className="text-[10px] text-brand-error font-medium">{targetAgentIdError.message}</p>
                      )}
                    </div>

                    {/* Amount Input */}
                    <div className="sm:w-48 space-y-1">
                      <div className="relative">
                        <input
                          type="number"
                          dir="ltr"
                          step="0.01"
                          placeholder="0.00"
                          className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3 pl-4 pr-10 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs dir-ltr text-left"
                          {...register(`transfers.${index}.amount` as const)}
                          disabled={pending}
                          autoComplete="off"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                          <DollarSign className="h-4 w-4" />
                        </div>
                      </div>
                      {amountError && (
                        <p className="text-[10px] text-brand-error font-medium">{amountError.message}</p>
                      )}
                    </div>

                    {/* Delete button */}
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={pending}
                        className="p-2.5 rounded-xl bg-brand-error/5 hover:bg-brand-error/10 border border-brand-error/10 hover:border-brand-error/20 text-brand-error transition-all duration-300 cursor-pointer"
                        title="حذف هذا السطر"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Password Confirmation & Submit Button */}
          <div className="border-t border-brand-border/60 pt-5 grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
            {/* Password input */}
            <div className="md:col-span-2 space-y-2">
              <label htmlFor="password" className="block text-xs font-semibold text-brand-dim">
                تأكيد بكلمة المرور لإغلاق اليوم وإخلاء المسؤولية
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

            {/* Submit Button */}
            <div className="md:col-span-1">
              <button
                type="submit"
                disabled={pending}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>جاري حفظ تقرير الإغلاق...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4.5 w-4.5" />
                    <span>إغلاق اليوم المالي</span>
                  </>
                )}
              </button>
            </div>
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
