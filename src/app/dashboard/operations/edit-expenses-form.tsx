'use client'

import { useActionState, useEffect, useState, startTransition, useMemo } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { fetchDailyReportAction, submitExpenseEditRequestAction } from '@/app/actions/operations'
import { Calendar, Receipt, DollarSign, Loader2, Send, CheckCircle, AlertCircle, UserPlus, Trash2, User, Calculator } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// Zod Schema for validation
const transferItemSchema = z.object({
  targetAgentId: z.string().uuid('يرجى اختيار موظف صالح'),
  amount: z.coerce.number().positive('يجب أن يكون مبلغ التحويل أكبر من صفر'),
})

const editExpensesSchema = z.object({
  reportId: z.string().uuid('معرف التقرير غير صالح'),
  reportDate: z.string().min(1, 'التاريخ مطلوب'),
  personalExpenses: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0),
  marketing1Expenses: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0),
  marketing2Expenses: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0),
  marketing3Expenses: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0),
  totalExpenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون الإجمالي صفر أو أكثر').default(0)
  ),
  transfers: z.array(transferItemSchema).default([]),
})

type EditExpensesSchema = z.infer<typeof editExpensesSchema>

interface EditExpensesFormProps {
  agents: Array<{ id: string; full_name: string }>
  currentAgentId: string
}

export default function EditExpensesForm({ agents, currentAgentId }: EditExpensesFormProps) {
  const [state, dispatch, pending] = useActionState(submitExpenseEditRequestAction, null)
  const [selectedDate, setSelectedDate] = useState('')
  const [fetchingReport, setFetchingReport] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [existingReport, setExistingReport] = useState<any | null>(null)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [realtimeToast, setRealtimeToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })

  // Real-time listener for updates on our edit requests
  useEffect(() => {
    if (!currentAgentId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`agent-expense-edit-update-${currentAgentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'expense_edit_requests',
          filter: `agent_id=eq.${currentAgentId}`
        },
        (payload) => {
          console.log('Realtime UPDATE received:', payload.new)
          const updatedRequest = payload.new
          const newStatus = updatedRequest.status
          
          if (newStatus === 'approved' || newStatus === 'rejected') {
            const dateStr = updatedRequest.report_date
            const isApproved = newStatus === 'approved'
            
            // 1. Show Toast
            const arabicStatus = isApproved ? 'قبول' : 'رفض'
            const toastMessage = `تم ${arabicStatus} طلب التعديل الخاص بك لتاريخ ${dateStr}.`
            setRealtimeToast({
              show: true,
              message: toastMessage,
              type: isApproved ? 'success' : 'error'
            })
            setTimeout(() => {
              setRealtimeToast((prev) => ({ ...prev, show: false }))
            }, 6000)

            // 2. If this request matches our selected date, update UI
            if (dateStr === selectedDate) {
              setHasPendingRequest(false)
              handleDateChange(dateStr)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentAgentId, selectedDate])

  // Calculate local today and yesterday dates to set HTML input restriction
  const tzOffset = new Date().getTimezoneOffset() * 60000
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const tenDaysAgoLocal = new Date(Date.now() - tzOffset - 10 * 86400000).toISOString().split('T')[0]

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors: clientErrors },
  } = useForm<EditExpensesSchema>({
    resolver: zodResolver(editExpensesSchema) as any,
    defaultValues: {
      reportId: '',
      reportDate: '',
      personalExpenses: 0,
      marketing1Expenses: 0,
      marketing2Expenses: 0,
      marketing3Expenses: 0,
      totalExpenses: 0,
      transfers: [],
    },
  })

  // Live calculation of all expense values and transfers for edit request
  const personalExpenses = useWatch({ control, name: 'personalExpenses' })
  const marketing1Expenses = useWatch({ control, name: 'marketing1Expenses' })
  const marketing2Expenses = useWatch({ control, name: 'marketing2Expenses' })
  const marketing3Expenses = useWatch({ control, name: 'marketing3Expenses' })
  const transfers = useWatch({ control, name: 'transfers' })

  const totalExpensesAndTransfers = useMemo(() => {
    const p = Number(personalExpenses) || 0
    const m1 = Number(marketing1Expenses) || 0
    const m2 = Number(marketing2Expenses) || 0
    const m3 = Number(marketing3Expenses) || 0
    const t = (transfers || []).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0)
    return p + m1 + m2 + m3 + t
  }, [personalExpenses, marketing1Expenses, marketing2Expenses, marketing3Expenses, transfers])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'transfers',
  })

  // Sync server errors or handle success
  useEffect(() => {
    if (state?.success) {
      setExistingReport(null)
      setSelectedDate('')
      setHasPendingRequest(false)
      
      setShowToast(true)

      if (state.id) {
        const supabase = createClient()
        const channel = supabase.channel('admin-realtime-approvals')
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'new-expense-edit',
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
    } else if (state?.errors) {
      if (state.errors.reportId) {
        setError('reportId', { type: 'server', message: state.errors.reportId[0] })
      }
      if (state.errors.reportDate) {
        setError('reportDate', { type: 'server', message: state.errors.reportDate[0] })
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
      if (state.errors.transfers) {
        setError('transfers', { type: 'server', message: state.errors.transfers[0] })
      }
      if (state.errors.totalExpenses) {
        setError('totalExpenses', { type: 'server', message: state.errors.totalExpenses[0] })
      }
    }
  }, [state, setError])

  // Fetch report on date select
  const handleDateChange = async (dateStr: string) => {
    if (!dateStr) {
      setSelectedDate('')
      setExistingReport(null)
      setHasPendingRequest(false)
      setFetchError('')
      return
    }
    setSelectedDate(dateStr)
    setFetchingReport(true)
    setFetchError('')
    setExistingReport(null)
    setHasPendingRequest(false)

    try {
      const res = await fetchDailyReportAction(dateStr)
      if (!res.success) {
        setFetchError(res.error || 'فشل جلب بيانات التقرير.')
      } else if (res.hasPendingRequest) {
        setHasPendingRequest(true)
      } else if (res.data) {
        setExistingReport(res.data)
        setValue('reportId', res.data.id)
        setValue('reportDate', res.data.report_date)
        setValue('personalExpenses', res.data.personal_expenses)
        setValue('marketing1Expenses', res.data.marketing_1_expenses)
        setValue('marketing2Expenses', res.data.marketing_2_expenses)
        setValue('marketing3Expenses', res.data.marketing_3_expenses)
        setValue('totalExpenses', res.data.total_amount || 0)

        // Map DB transfers JSONB structure back to client input format
        if (res.data.transfers && Array.isArray(res.data.transfers)) {
          const mappedTransfers = res.data.transfers.map((t: any) => ({
            targetAgentId: t.target_agent_id,
            amount: t.amount,
          }))
          setValue('transfers', mappedTransfers)
        } else {
          setValue('transfers', [])
        }
      } else {
        setExistingReport(null) // No report found
      }
    } catch (err) {
      console.error(err)
      setFetchError('حدث خطأ غير متوقع أثناء تحميل البيانات.')
    } finally {
      setFetchingReport(false)
    }
  }

  const onSubmit = (data: EditExpensesSchema) => {
    // Validate that the user inputted total matches the actual calculated total
    const computedTotal = totalExpensesAndTransfers
    const userEnteredTotal = Number(data.totalExpenses) || 0

    if (Math.abs(userEnteredTotal - computedTotal) > 0.01) {
      setError('totalExpenses', {
        type: 'manual',
        message: `المجموع المدخل (${userEnteredTotal.toFixed(2)}) غير مطابق للمجموع الفعلي للمصاريف والتحويلات (الفعلي: ${computedTotal.toFixed(2)} ج.م)`,
      })
      return
    }

    const formData = new FormData()
    formData.append('reportId', data.reportId)
    formData.append('reportDate', data.reportDate)
    formData.append('personalExpenses', String(data.personalExpenses || 0))
    formData.append('marketing1Expenses', String(data.marketing1Expenses || 0))
    formData.append('marketing2Expenses', String(data.marketing2Expenses || 0))
    formData.append('marketing3Expenses', String(data.marketing3Expenses || 0))
    formData.append('transfers', JSON.stringify(data.transfers || []))

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
          <span>تم إرسال طلب التعديل للإدارة للموافقة.</span>
        </div>
      )}

      {/* Real-time Status Toast Notification */}
      {realtimeToast.show && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3 text-sm font-bold border animate-fade-in transition-all duration-300 ${
          realtimeToast.type === 'success'
            ? 'bg-[#10b981] text-white border-emerald-400/20 shadow-[0_8px_32px_rgba(16,185,129,0.3)]'
            : 'bg-brand-error text-white border-red-500/20 shadow-[0_8px_32px_rgba(239,68,68,0.3)]'
        }`}>
          {realtimeToast.type === 'success' ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-white" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-white" />
          )}
          <span>{realtimeToast.message}</span>
        </div>
      )}

      <div className="w-full rounded-[24px] bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden text-right">
        <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

        <h3 className="text-lg font-bold text-white mb-2">طلب تعديل المصاريف والتحويلات اليومية</h3>
        <p className="text-xs text-brand-dim mb-6 leading-relaxed">
          اختر التاريخ المسجل مسبقاً لعرض التقرير الحالي وطلب إجراء التعديلات عليه. سيتم إرسال طلبك للإدارة ولن يتم التحديث المباشر للمصاريف إلا بعد المراجعة والموافقة.
        </p>

        <div className="space-y-6">
          {/* Step 1: Date Selection */}
          <div className="space-y-2 max-w-md">
            <label htmlFor="select-date" className="block text-xs font-semibold text-brand-dim">
              تاريخ التقرير المطلوب تعديله
            </label>
            <div className="relative">
              <input
                type="date"
                id="select-date"
                dir="ltr"
                min={tenDaysAgoLocal}
                max={todayLocal}
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
                disabled={pending || fetchingReport}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <Calendar className="h-4.5 w-4.5" />
              </div>
            </div>
          </div>

          {/* Loading indicator */}
          {fetchingReport && (
            <div className="flex items-center justify-center py-10 gap-3 text-brand-dim text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-brand-accent" />
              <span>جاري جلب بيانات التقرير والتحقق من الطلبات المعلقة...</span>
            </div>
          )}

          {/* Error Fetching Daily Report */}
          {fetchError && (
            <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm text-center animate-fade-in">
              {fetchError}
            </div>
          )}

          {/* Prompt to select a date */}
          {!fetchingReport && !fetchError && !selectedDate && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-border/30 border-dashed p-12 text-center relative overflow-hidden backdrop-blur-sm animate-fade-in">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand-accent/5 rounded-full blur-[40px] pointer-events-none" />
              <Calendar className="h-8 w-8 text-white/20 mb-5" />
              <h4 className="text-base font-bold text-white mb-2">يرجى اختيار تاريخ للبدء</h4>
              <p className="text-xs text-brand-dim max-w-sm leading-relaxed">
                يرجى تحديد تاريخ اليوم المالي المطلوب طلب تعديله لعرض تقريره الأصلي وإضافة التعديلات المقترحة (متاح حتى آخر 10 أيام مضت).
              </p>
            </div>
          )}

          {/* Warning: Pending request already exists */}
          {!fetchingReport && !fetchError && selectedDate && hasPendingRequest && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-error/20 bg-brand-error/5 p-10 text-center animate-fade-in">
              <AlertCircle className="h-8 w-8 text-brand-error mb-3" />
              <h4 className="text-sm font-bold text-white mb-1">لديك طلب تعديل قيد المراجعة لهذا اليوم</h4>
              <p className="text-xs text-brand-dim leading-relaxed max-w-md">
                لديك طلب تعديل قيد المراجعة لهذا اليوم. يرجى انتظار رد الإدارة قبل تقديم أي طلبات تعديل أخرى على هذا التاريخ.
              </p>
            </div>
          )}

          {/* Warning: No existing report found */}
          {!fetchingReport && !fetchError && selectedDate && !hasPendingRequest && !existingReport && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-border/60 bg-white/[0.01] p-10 text-center animate-fade-in">
              <AlertCircle className="h-8 w-8 text-amber-500 mb-3" />
              <h4 className="text-sm font-bold text-white mb-1">لا يوجد تقرير مصاريف مسجل لهذا اليوم لتعديله</h4>
              <p className="text-xs text-brand-dim leading-relaxed max-w-md">
                لم تقم بتسجيل تقرير مصاريف مسبق لهذا التاريخ ({selectedDate}). يرجى التأكد من اختيار التاريخ الصحيح أو تسجيل المصاريف أولاً من تبويب "المصاريف والتحويلات اليومية".
              </p>
            </div>
          )}

          {/* Step 2: Form with current report values (Conditional Rendering) */}
          {!fetchingReport && !fetchError && selectedDate && !hasPendingRequest && existingReport && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 border-t border-brand-border/60 pt-5 animate-fade-in">
              {/* Server Error Alert */}
              {state?.error && (
                <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm font-semibold text-center animate-pulse">
                  {state.error}
                </div>
              )}

              {/* Hidden inputs to send to action */}
              <input type="hidden" {...register('reportId')} />
              <input type="hidden" {...register('reportDate')} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Report Date (Disabled view for reference) */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-brand-dim">
                    تاريخ التقرير
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      dir="ltr"
                      disabled
                      value={selectedDate}
                      className="block w-full rounded-xl bg-white/[0.01] border border-white/[0.04] py-3.5 pl-4 pr-11 text-white/50 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left cursor-not-allowed"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/20">
                      <Calendar className="h-4.5 w-4.5" />
                    </div>
                  </div>
                </div>

                {/* Total Expenses and Transfers (Manual Input Field) */}
                <div className="space-y-2">
                  <label htmlFor="editTotalExpenses" className="block text-xs font-semibold text-brand-dim">
                    إجمالي المصروفات والتحويلات (التوتال)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="editTotalExpenses"
                      dir="ltr"
                      step="0.01"
                      placeholder="0.00"
                      className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left font-bold"
                      {...register('totalExpenses')}
                      disabled={pending}
                      autoComplete="off"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-brand-accent">
                      <Calculator className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  {clientErrors.totalExpenses && (
                    <p className="text-[11px] text-brand-error font-medium">{clientErrors.totalExpenses.message}</p>
                  )}
                  <p className="text-[10px] text-brand-accent/80 font-medium">
                    * أدخل مجموع المصاريف والتحويلات المقترحة يدوياً للمطابقة.
                  </p>
                </div>

                {/* Personal Expenses */}
                <div className="space-y-2">
                  <label htmlFor="editPersonalExpenses" className="block text-xs font-semibold text-brand-dim">
                    المصاريف الشخصية الجديدة (ج.م)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="editPersonalExpenses"
                      dir="ltr"
                      step="0.01"
                      className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
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
                  <label htmlFor="editMarketing1Expenses" className="block text-xs font-semibold text-brand-dim">
                    مصاريف ماركتنج 1 الجديدة (ج.م)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="editMarketing1Expenses"
                      dir="ltr"
                      step="0.01"
                      className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
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
                  <label htmlFor="editMarketing2Expenses" className="block text-xs font-semibold text-brand-dim">
                    مصاريف ماركتنج 2 الجديدة (ج.م)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="editMarketing2Expenses"
                      dir="ltr"
                      step="0.01"
                      className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
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
                  <label htmlFor="editMarketing3Expenses" className="block text-xs font-semibold text-brand-dim">
                    مصاريف ماركتنج 3 الجديدة (ج.م)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="editMarketing3Expenses"
                      dir="ltr"
                      step="0.01"
                      className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left"
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
                  <h4 className="text-sm font-bold text-white">تحويلات العهدة المقترحة الجديدة</h4>
                </div>

                {/* Error messages for transfers array validation */}
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
                      <span>جاري تقديم طلب التعديل...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4.5 w-4.5" />
                      <span>تقديم طلب التعديل للإدارة</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
