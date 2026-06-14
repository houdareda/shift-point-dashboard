'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Check,
  X,
  Clock,
  ArrowRightLeft,
  User,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wallet
} from 'lucide-react'
import {
  approveExpenseEditRequestAction,
  rejectExpenseEditRequestAction,
  approveMoneyRequestAction,
  rejectMoneyRequestAction,
  fetchExpenseEditRequestAction,
  fetchMoneyRequestAction
} from '@/app/actions/admin'

interface ExpenseRequest {
  id: string
  report_id: string
  agent_id: string
  report_date: string
  new_personal_expenses: number
  new_marketing_1_expenses: number
  new_marketing_2_expenses: number
  new_marketing_3_expenses: number
  new_transfers: Array<{ target_agent_id: string; amount: number }> | null
  status: string
  agent: {
    full_name: string
  }
  report: {
    personal_expenses: number
    marketing_1_expenses: number
    marketing_2_expenses: number
    marketing_3_expenses: number
    transfers: Array<{ target_agent_id: string; amount: number }> | null
  }
}

interface MoneyRequest {
  id: string
  agent_id: string
  wallet_id: string
  amount: number
  status: string
  request_date: string
  created_at: string
  agent: {
    full_name: string
  }
  wallet: {
    phone_number: string
    current_balance?: number
  }
}

interface TransferDiff {
  target_agent_id: string
  agent_name: string
  type: 'added' | 'removed' | 'updated' | 'unchanged'
  old_amount?: number
  new_amount?: number
}

function getTransfersDiff(
  oldTransfers: Array<{ target_agent_id: string; amount: number }> | null,
  newTransfers: Array<{ target_agent_id: string; amount: number }> | null,
  nameMap: Record<string, string>
): TransferDiff[] {
  const oldList = oldTransfers || []
  const newList = newTransfers || []
  
  const diffs: TransferDiff[] = []
  
  // 1. Check old transfers (either updated, unchanged, or removed)
  oldList.forEach((ot) => {
    const nt = newList.find((n) => n.target_agent_id === ot.target_agent_id)
    const agentName = nameMap[ot.target_agent_id] || 'موظف'
    if (!diffs.some((d) => d.target_agent_id === ot.target_agent_id)) {
      if (!nt) {
        diffs.push({
          target_agent_id: ot.target_agent_id,
          agent_name: agentName,
          type: 'removed',
          old_amount: ot.amount
        })
      } else if (nt.amount !== ot.amount) {
        diffs.push({
          target_agent_id: ot.target_agent_id,
          agent_name: agentName,
          type: 'updated',
          old_amount: ot.amount,
          new_amount: nt.amount
        })
      } else {
        diffs.push({
          target_agent_id: ot.target_agent_id,
          agent_name: agentName,
          type: 'unchanged',
          old_amount: ot.amount,
          new_amount: ot.amount
        })
      }
    }
  })
  
  // 2. Check new transfers (only added)
  newList.forEach((nt) => {
    const ot = oldList.find((o) => o.target_agent_id === nt.target_agent_id)
    if (!ot && !diffs.some((d) => d.target_agent_id === nt.target_agent_id)) {
      diffs.push({
        target_agent_id: nt.target_agent_id,
        agent_name: nameMap[nt.target_agent_id] || 'موظف',
        type: 'added',
        new_amount: nt.amount
      })
    }
  })
  
  return diffs
}

interface ApprovalsTabsProps {
  expenseRequests: ExpenseRequest[]
  moneyRequests: MoneyRequest[]
  agentNameMap: Record<string, string>
}

export default function ApprovalsTabs({
  expenseRequests: initialExpenseRequests,
  moneyRequests: initialMoneyRequests,
  agentNameMap
}: ApprovalsTabsProps) {
  const [activeTab, setActiveTab] = useState<'expenses' | 'money'>('money')
  const [isPending, startTransition] = useTransition()
  
  // Toast notifications state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  })

  // Optimistic/Local state for immediate visual feedback after action
  const [expenseList, setExpenseList] = useState<ExpenseRequest[]>(initialExpenseRequests)
  const [moneyList, setMoneyList] = useState<MoneyRequest[]>(initialMoneyRequests)

  useEffect(() => {
    const supabase = createClient()

    const fetchAndAddExpenseEditRequest = async (newId: string) => {
      // Fetch the full request with joins via server action to bypass client-side RLS limits on daily_reports
      const res = await fetchExpenseEditRequestAction(newId)

      if (!res.success) {
        console.error('Error fetching newly inserted edit request details:', res.error)
        return
      }

      const data = res.data
      if (data) {
        setExpenseList((prev) => {
          if (prev.some((r) => r.id === data.id)) return prev
          return [data as any, ...prev]
        })
        triggerToast(`تم استلام طلب تعديل مصاريف جديد من ${data.agent?.full_name || 'موظف'}.`, 'success')
      }
    }

    const fetchAndAddMoneyRequest = async (newId: string) => {
      // Fetch the full request with joins via server action to bypass client-side RLS limits on wallets
      const res = await fetchMoneyRequestAction(newId)

      if (!res.success) {
        console.error('Error fetching newly inserted money request details:', res.error)
        return
      }

      const data = res.data
      if (data) {
        setMoneyList((prev) => {
          if (prev.some((r) => r.id === data.id)) return prev
          return [data as any, ...prev]
        })
        triggerToast(`تم استلام طلب شحن رصيد جديد بقيمة ${data.amount} ج.م من ${data.agent?.full_name || 'موظف'}.`, 'success')
      }
    }

    const channel = supabase
      .channel('admin-realtime-approvals')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'expense_edit_requests'
        },
        async (payload) => {
          console.log('Realtime INSERT received:', payload.new)
          const newId = payload.new.id
          await fetchAndAddExpenseEditRequest(newId)
        }
      )
      .on(
        'broadcast',
        { event: 'new-expense-edit' },
        async (payload) => {
          console.log('Broadcast new-expense-edit received:', payload)
          const newId = payload.payload?.id || payload.id
          if (newId) {
            await fetchAndAddExpenseEditRequest(newId)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'expense_edit_requests'
        },
        (payload) => {
          const updated = payload.new
          if (updated.status !== 'pending') {
            setExpenseList((prev) => prev.filter((r) => r.id !== updated.id))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'money_requests'
        },
        async (payload) => {
          console.log('Realtime money request INSERT received:', payload.new)
          const newId = payload.new.id
          await fetchAndAddMoneyRequest(newId)
        }
      )
      .on(
        'broadcast',
        { event: 'new-money-request' },
        async (payload) => {
          console.log('Broadcast new-money-request received:', payload)
          const newId = payload.payload?.id || payload.id
          if (newId) {
            await fetchAndAddMoneyRequest(newId)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'money_requests'
        },
        (payload) => {
          const updated = payload.new
          if (updated.status !== 'pending') {
            setMoneyList((prev) => prev.filter((r) => r.id !== updated.id))
          }
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

  const handleApproveExpense = async (requestId: string) => {
    startTransition(async () => {
      const res = await approveExpenseEditRequestAction(requestId)
      if (res.success) {
        triggerToast('تمت الموافقة على طلب تعديل المصاريف وتحديث التقرير بنجاح.', 'success')
        setExpenseList((prev) => prev.filter((r) => r.id !== requestId))
      } else {
        triggerToast(res.error || 'فشل اعتماد الطلب. يرجى المحاولة مرة أخرى.', 'error')
      }
    })
  }

  const handleRejectExpense = async (requestId: string) => {
    startTransition(async () => {
      const res = await rejectExpenseEditRequestAction(requestId)
      if (res.success) {
        triggerToast('تم رفض طلب تعديل المصاريف بنجاح.', 'success')
        setExpenseList((prev) => prev.filter((r) => r.id !== requestId))
      } else {
        triggerToast(res.error || 'فشل رفض الطلب.', 'error')
      }
    })
  }

  const handleApproveMoney = async (requestId: string) => {
    startTransition(async () => {
      const res = await approveMoneyRequestAction(requestId)
      if (res.success) {
        triggerToast('تمت الموافقة على طلب سحب الأموال بنجاح.', 'success')
        setMoneyList((prev) => prev.filter((r) => r.id !== requestId))
      } else {
        triggerToast(res.error || 'فشل اعتماد الطلب.', 'error')
      }
    })
  }

  const handleRejectMoney = async (requestId: string) => {
    startTransition(async () => {
      const res = await rejectMoneyRequestAction(requestId)
      if (res.success) {
        triggerToast('تم رفض طلب سحب الأموال بنجاح.', 'success')
        setMoneyList((prev) => prev.filter((r) => r.id !== requestId))
      } else {
        triggerToast(res.error || 'فشل رفض الطلب.', 'error')
      }
    })
  }

  const RenderCompareField = ({
    label,
    oldVal,
    newVal
  }: {
    label: string
    oldVal: number
    newVal: number
  }) => {
    const isChanged = oldVal !== newVal
    return (
      <div className={`flex items-center justify-between text-xs py-2 px-3 rounded-lg ${isChanged ? 'bg-brand-accent/5 border border-brand-accent/10' : 'bg-white/[0.005]'}`}>
        <span className="text-brand-dim">{label}</span>
        <div className="flex items-center gap-2">
          {isChanged ? (
            <>
              <span className="text-brand-error line-through opacity-70 font-semibold">{oldVal} ج.م</span>
              <span className="text-brand-dim text-[10px]">←</span>
              <span className="text-brand-accent font-bold">{newVal} ج.م</span>
            </>
          ) : (
            <span className="text-white/20 italic font-medium">لا يوجد تغيير</span>
          )}
        </div>
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
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Tabs Switcher Navigation */}
      <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/[0.06] rounded-2xl w-full sm:w-fit mb-6 text-xs">
        <button
          onClick={() => setActiveTab('money')}
          disabled={isPending}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 cursor-pointer ${
            activeTab === 'money'
              ? 'bg-brand-accent text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]'
              : 'text-brand-dim hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>طلبات الفلوس ({moneyList.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          disabled={isPending}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-brand-accent text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]'
              : 'text-brand-dim hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          <span>تعديلات المصاريف ({expenseList.length})</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'money' ? (
        <div className="space-y-6">
          {moneyList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-brand-border/40 border-dashed p-16 text-center bg-white/[0.005]">
              <Clock className="h-10 w-10 text-white/10 mb-4 animate-pulse" />
              <h4 className="text-base font-bold text-white mb-2">لا توجد طلبات عهدة معلقة</h4>
              <p className="text-xs text-brand-dim max-w-sm leading-relaxed">
                تمت معالجة جميع طلبات الأموال/العهدة المقدمة من الموظفين بنجاح.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-brand-card border border-brand-border overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-brand-border bg-white/[0.01] text-brand-dim font-bold">
                      <th className="px-6 py-4.5 font-bold">اسم الموظف</th>
                      <th className="px-6 py-4.5 font-bold">التاريخ</th>
                      <th className="px-6 py-4.5 font-bold">محفظة الاستلام</th>
                      <th className="px-6 py-4.5 font-bold">المبلغ المطلوب</th>
                      <th className="px-6 py-4.5 text-center font-bold">الحالة</th>
                      <th className="px-6 py-4.5 text-left font-bold pl-8">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] font-semibold text-white/95">
                    {moneyList.map((req) => (
                      <tr key={req.id} className="hover:bg-white/[0.005] transition-colors duration-300">
                        <td className="px-6 py-4.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center">
                              <User className="h-4 w-4 text-brand-accent" />
                            </div>
                            <span className="font-bold">{req.agent?.full_name || 'موظف مجهول'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4.5 font-medium text-brand-dim">{req.request_date}</td>
                        <td className="px-6 py-4.5">
                          <div className="flex flex-col gap-1 text-white/80">
                            <span className="dir-ltr font-mono">{req.wallet?.phone_number || 'بدون رقم'}</span>
                            {req.wallet && (
                              <span className="text-[10px] text-brand-dim font-bold">
                                (الرصيد: {Number(req.wallet.current_balance || 0).toLocaleString('en-US')} ج.م)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4.5">
                          <span className="inline-flex items-center gap-0.5 text-brand-accent font-bold text-sm">
                            {req.amount}
                            <span className="text-[10px] text-brand-dim font-semibold">ج.م</span>
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <Clock className="h-3 w-3" />
                            <span>قيد الانتظار</span>
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-left pl-8">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => handleRejectMoney(req.id)}
                              disabled={isPending}
                              className="inline-flex items-center justify-center p-2 rounded-xl text-brand-error bg-brand-error/10 border border-brand-error/15 hover:bg-brand-error/25 transition-all duration-300 cursor-pointer disabled:opacity-50"
                              title="رفض الطلب"
                            >
                              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4.5 w-4.5" />}
                            </button>
                            
                            <button
                              onClick={() => handleApproveMoney(req.id)}
                              disabled={isPending}
                              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent shadow-[0_0_15px_rgba(139,92,246,0.15)] transition-all duration-300 cursor-pointer disabled:opacity-50"
                            >
                              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              <span className="mr-1">موافقة</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {expenseList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-brand-border/40 border-dashed p-16 text-center bg-white/[0.005]">
              <Clock className="h-10 w-10 text-white/10 mb-4 animate-pulse" />
              <h4 className="text-base font-bold text-white mb-2">لا توجد طلبات تعديل مصاريف معلقة</h4>
              <p className="text-xs text-brand-dim max-w-sm leading-relaxed">
                تمت معالجة جميع طلبات التعديل المقدمة من الموظفين بنجاح.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {expenseList.map((req) => (
                <div
                  key={req.id}
                  className="rounded-3xl bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-white/[0.1] transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

                  {/* Top Header Card */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.05] pb-5 mb-5">
                    <div className="flex items-center gap-3.5">
                      <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-brand-accent/10 border border-brand-accent/20">
                        <User className="h-5 w-5 text-brand-accent" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{req.agent?.full_name || 'موظف مجهول'}</h4>
                        <span className="inline-flex items-center mt-1 text-[10px] text-brand-dim bg-white/[0.03] border border-white/[0.06] rounded-full px-2.5 py-0.5 font-medium">
                          تعديل المصاريف والتحويلات اليومية
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="flex items-center gap-1.5 text-brand-dim">
                        <Calendar className="h-4 w-4" />
                        <span>تاريخ التقرير: <span className="text-white">{req.report_date}</span></span>
                      </div>
                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>قيد الانتظار</span>
                      </span>
                    </div>
                  </div>

                  {/* Comparisons Layout Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Column 1: البيانات الحالية (Current Data) */}
                    <div className="p-5 rounded-2xl bg-white/[0.01] border border-white/[0.04] space-y-4">
                      <h5 className="text-xs font-bold text-brand-dim border-r-2 border-white/20 pr-2">البيانات الحالية (التقرير الأصلي)</h5>
                      <div className="space-y-2.5">
                        <div className="flex justify-between text-xs py-2 px-3 rounded-lg bg-white/[0.005]">
                          <span className="text-brand-dim">المصاريف الشخصية</span>
                          <span className="text-white/60 font-semibold">{req.report?.personal_expenses ?? 0} ج.م</span>
                        </div>
                        <div className="flex justify-between text-xs py-2 px-3 rounded-lg bg-white/[0.005]">
                          <span className="text-brand-dim">مصاريف ماركتنج 1</span>
                          <span className="text-white/60 font-semibold">{req.report?.marketing_1_expenses ?? 0} ج.م</span>
                        </div>
                        <div className="flex justify-between text-xs py-2 px-3 rounded-lg bg-white/[0.005]">
                          <span className="text-brand-dim">مصاريف ماركتنج 2</span>
                          <span className="text-white/60 font-semibold">{req.report?.marketing_2_expenses ?? 0} ج.م</span>
                        </div>
                        <div className="flex justify-between text-xs py-2 px-3 rounded-lg bg-white/[0.005]">
                          <span className="text-brand-dim">مصاريف ماركتنج 3</span>
                          <span className="text-white/60 font-semibold">{req.report?.marketing_3_expenses ?? 0} ج.م</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: البيانات المقترحة (Proposed Data) */}
                    <div className="p-5 rounded-2xl bg-brand-accent/[0.01] border border-brand-accent/10 space-y-4">
                      <h5 className="text-xs font-bold text-brand-accent border-r-2 border-brand-accent pr-2">البيانات المقترحة (طلب التعديل)</h5>
                      <div className="space-y-2.5">
                        <RenderCompareField
                          label="المصاريف الشخصية"
                          oldVal={req.report?.personal_expenses ?? 0}
                          newVal={req.new_personal_expenses}
                        />
                        <RenderCompareField
                          label="مصاريف ماركتنج 1"
                          oldVal={req.report?.marketing_1_expenses ?? 0}
                          newVal={req.new_marketing_1_expenses}
                        />
                        <RenderCompareField
                          label="مصاريف ماركتنج 2"
                          oldVal={req.report?.marketing_2_expenses ?? 0}
                          newVal={req.new_marketing_2_expenses}
                        />
                        <RenderCompareField
                          label="مصاريف ماركتنج 3"
                          oldVal={req.report?.marketing_3_expenses ?? 0}
                          newVal={req.new_marketing_3_expenses}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Transfers Comparison in full width */}
                  <div className="mb-6">
                    <div className="space-y-4">
                      <h5 className="text-xs font-bold text-white/80 mb-2 border-r-2 border-brand-accent pr-2">تعديلات تحويلات العهدة للزملاء</h5>
                      
                      <div className="p-4 rounded-2xl bg-white/[0.005] border border-white/[0.04] space-y-3.5">
                        {(() => {
                          const diffs = getTransfersDiff(req.report?.transfers, req.new_transfers, agentNameMap)
                          if (diffs.length === 0) {
                            return <span className="block text-xs text-white/30 italic py-2 text-center">لا توجد تحويلات عهدة مسجلة أو مقترحة</span>
                          }

                          return (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {diffs.map((diff, i) => {
                                if (diff.type === 'added') {
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs py-2.5 px-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                      <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        إضافة تحويل لـ {diff.agent_name}
                                      </span>
                                      <span className="font-bold text-emerald-400">+{diff.new_amount} ج.م</span>
                                    </div>
                                  )
                                }
                                if (diff.type === 'removed') {
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs py-2.5 px-3.5 rounded-xl bg-red-500/5 border border-red-500/10">
                                      <span className="flex items-center gap-1.5 font-bold text-red-400/80 line-through">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
                                        إلغاء تحويل لـ {diff.agent_name}
                                      </span>
                                      <span className="font-bold text-red-400/80 line-through">-{diff.old_amount} ج.م</span>
                                    </div>
                                  )
                                }
                                if (diff.type === 'updated') {
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs py-2.5 px-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                      <span className="flex items-center gap-1.5 font-bold text-amber-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                        تعديل مبلغ تحويل {diff.agent_name}
                                      </span>
                                      <div className="flex items-center gap-2 font-bold">
                                        <span className="text-red-400/70 line-through text-[11px]">{diff.old_amount} ج.م</span>
                                        <span className="text-white/40 text-[10px]">←</span>
                                        <span className="text-amber-400">{diff.new_amount} ج.م</span>
                                      </div>
                                    </div>
                                  )
                                }
                                // Unchanged
                                return (
                                  <div key={i} className="flex items-center justify-between text-xs py-2.5 px-3.5 rounded-xl bg-white/[0.005] border border-white/[0.03]">
                                    <span className="flex items-center gap-1.5 text-brand-dim">
                                      <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                      تحويل لـ {diff.agent_name} (بدون تغيير)
                                    </span>
                                    <span className="text-white/60 font-medium">{diff.new_amount} ج.م</span>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="flex justify-end gap-3.5 border-t border-white/[0.05] pt-5">
                    <button
                      onClick={() => handleRejectExpense(req.id)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-6 py-3 rounded-xl text-xs font-bold text-brand-error bg-brand-error/10 border border-brand-error/20 hover:bg-brand-error/20 transition-all duration-300 cursor-pointer disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      <span>رفض الطلب</span>
                    </button>
                    
                    <button
                      onClick={() => handleApproveExpense(req.id)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all duration-300 cursor-pointer disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      <span>موافقة واعتماد التعديل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
