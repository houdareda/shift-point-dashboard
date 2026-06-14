'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { LineChart, ArrowDownLeft, ArrowUpRight, Coins, Loader2, Calendar, PhoneCall, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'

interface MoneyRequestItem {
  id: string
  amount: number
  status: string
  request_date: string
  created_at: string
  wallet?: {
    phone_number: string
  } | null
}

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: 'معلق', icon: Clock, color: 'text-amber-400 bg-amber-400/10 border-amber-500/20' },
  approved: { label: 'تمت الموافقة', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: 'مرفوض', icon: XCircle, color: 'text-red-400 bg-red-400/10 border-red-500/20' },
}

export default function MyReportPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalIn, setTotalIn] = useState(0)
  const [totalOut, setTotalOut] = useState(0)
  const [recentRequests, setRecentRequests] = useState<MoneyRequestItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (uid: string) => {
    const supabase = createClient()
    try {
      // 1. Fetch approved money requests for total incoming
      const { data: moneyReqs, error: moneyErr } = await supabase
        .from('money_requests')
        .select('amount, status')
        .eq('agent_id', uid)

      if (moneyErr) throw moneyErr

      const approvedIn = moneyReqs
        ? moneyReqs
            .filter((r) => r.status === 'approved')
            .reduce((sum, r) => sum + Number(r.amount || 0), 0)
        : 0

      // 2. Fetch daily reports for total outgoing
      const { data: reports, error: reportsErr } = await supabase
        .from('daily_reports')
        .select('personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, transfers')
        .eq('agent_id', uid)

      if (reportsErr) throw reportsErr

      let expensesTotal = 0
      if (reports) {
        reports.forEach((r) => {
          expensesTotal += Number(r.personal_expenses || 0)
          expensesTotal += Number(r.marketing_1_expenses || 0)
          expensesTotal += Number(r.marketing_2_expenses || 0)
          expensesTotal += Number(r.marketing_3_expenses || 0)
          if (r.transfers && Array.isArray(r.transfers)) {
            r.transfers.forEach((t: any) => {
              expensesTotal += Number(t.amount || 0)
            })
          }
        })
      }

      // 3. Fetch wallets starting balance for total incoming
      const { data: wallets, error: walletsErr } = await supabase
        .from('wallets')
        .select('starting_balance')
        .eq('agent_id', uid)

      if (walletsErr) throw walletsErr

      const startingBalanceSum = wallets
        ? wallets.reduce((sum, w) => sum + Number(w.starting_balance || 0), 0)
        : 0

      // 4. Fetch last 5 money requests with wallets info
      const { data: recent, error: recentErr } = await supabase
        .from('money_requests')
        .select('id, amount, status, request_date, created_at, wallet:wallets(phone_number)')
        .eq('agent_id', uid)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentErr) throw recentErr

      setTotalIn(approvedIn + startingBalanceSum)
      setTotalOut(expensesTotal)
      setRecentRequests((recent as any) || [])
    } catch (err: any) {
      console.error('Error fetching financial report data:', err)
      setError(err.message || 'حدث خطأ أثناء تحميل البيانات المالية.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()

    const checkSessionAndFetch = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUserId(user.id)
        fetchData(user.id)
      } else {
        setLoading(false)
      }
    }

    checkSessionAndFetch()
  }, [])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Subscribe to money requests updates for this user
    const moneyChannel = supabase
      .channel('my-report-money-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'money_requests',
          filter: `agent_id=eq.${userId}`,
        },
        () => {
          fetchData(userId)
        }
      )
      .subscribe()

    // Subscribe to daily reports updates for this user
    const reportsChannel = supabase
      .channel('my-report-daily-reports')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_reports',
          filter: `agent_id=eq.${userId}`,
        },
        () => {
          fetchData(userId)
        }
      )
      .subscribe()

    // Subscribe to wallets updates for this user
    const walletsChannel = supabase
      .channel('my-report-wallets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `agent_id=eq.${userId}`,
        },
        () => {
          fetchData(userId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(moneyChannel)
      supabase.removeChannel(reportsChannel)
      supabase.removeChannel(walletsChannel)
    }
  }, [userId])

  const netBalance = totalIn - totalOut

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <LineChart className="h-7 w-7 text-brand-accent" />
            <span>تقريري المالي الشخصي</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            متابعة إجمالي العهدة المالية المستلمة، المصروفات اليومية الكلية، والعهدة الحالية المتبقية في ذمتك بلحظة بلحظة.
          </p>
        </div>
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-brand-dim bg-brand-card border border-brand-border backdrop-blur-xl rounded-[24px]">
          <Loader2 className="h-10 w-10 animate-spin text-brand-accent mb-4" />
          <span className="text-xs">جاري تحميل وتحديث تقريرك المالي...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 text-center max-w-lg mx-auto bg-brand-card border border-brand-border backdrop-blur-xl rounded-[24px]">
          <AlertCircle className="h-12 w-12 text-brand-error mb-4 animate-bounce" />
          <h4 className="text-base font-bold text-white mb-2">فشل جلب البيانات المالية</h4>
          <p className="text-xs text-brand-dim leading-relaxed mb-4">{error}</p>
          <button
            onClick={() => userId && fetchData(userId)}
            className="px-4 py-2 text-xs font-bold text-white bg-white/5 border border-brand-border hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Summary Cards Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total In */}
          <div className="p-6 rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-brand-accent/20 transition-all duration-300 group">
            <div className="text-right">
              <span className="text-xs font-semibold text-brand-dim">إجمالي الوارد (شحن + رصيد أول الشهر)</span>
              <p className="text-2xl font-extrabold text-emerald-400 mt-2 font-mono tracking-tight">
                {totalIn.toLocaleString('en-US')} ج.م
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform duration-300">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Total Out */}
          <div className="p-6 rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-brand-accent/20 transition-all duration-300 group">
            <div className="text-right">
              <span className="text-xs font-semibold text-brand-dim">إجمالي المنصرف (المصروفات)</span>
              <p className="text-2xl font-extrabold text-red-400 mt-2 font-mono tracking-tight">
                {totalOut.toLocaleString('en-US')} ج.م
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform duration-300">
              <ArrowUpRight className="h-6 w-6" />
            </div>
          </div>

          {/* Card 3: Net Balance */}
          <div className="p-6 rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-brand-accent/20 transition-all duration-300 group">
            <div className="text-right">
              <span className="text-xs font-semibold text-brand-dim">الرصيد المتبقي (العهدة الحالية)</span>
              <p className={`text-2xl font-extrabold mt-2 font-mono tracking-tight ${
                netBalance > 0 ? 'text-emerald-400' : netBalance < 0 ? 'text-red-400' : 'text-brand-dim'
              }`}>
                {netBalance.toLocaleString('en-US')} ج.م
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-border flex items-center justify-center text-brand-accent group-hover:scale-105 transition-transform duration-300">
              <Coins className="h-6 w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Table Container */}
      {!loading && !error && (
        <div className="rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden">
          <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

          <h3 className="text-base font-bold text-white mb-6 text-right">آخر 5 طلبات شحن رصيد</h3>

          {recentRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-brand-dim">
              <Clock className="h-10 w-10 opacity-30 mb-3" />
              <span className="text-xs">لم تقم بإجراء أي طلبات شحن رصيد حتى الآن.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.04] bg-white/[0.005]">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-brand-border bg-white/[0.01] text-xs text-brand-dim">
                    <th className="px-6 py-4.5 font-bold">تاريخ الطلب</th>
                    <th className="px-6 py-4.5 font-bold">المحفظة المستهدفة</th>
                    <th className="px-6 py-4.5 font-bold">المبلغ المطلوب</th>
                    <th className="px-6 py-4.5 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-xs">
                  {recentRequests.map((req) => {
                    const statusConfig = STATUS_MAP[req.status] || STATUS_MAP.pending
                    const StatusIcon = statusConfig.icon
                    const reqDate = new Date(req.request_date).toLocaleDateString('ar-EG-u-nu-latn', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })

                    return (
                      <tr key={req.id} className="hover:bg-white/[0.01] transition-colors">
                        {/* Date */}
                        <td className="px-6 py-4.5 text-white/90 font-medium flex items-center gap-2 justify-end">
                          <span>{reqDate}</span>
                          <Calendar className="h-4 w-4 text-brand-dim" />
                        </td>

                        {/* Wallet phone number */}
                        <td className="px-6 py-4.5 font-mono text-white/95 text-left dir-ltr">
                          {req.wallet?.phone_number || 'محفظة غير معروفة'}
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4.5 font-bold text-white font-mono">
                          {Number(req.amount).toLocaleString('en-US')} ج.م
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4.5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${statusConfig.color}`}>
                            <StatusIcon className="h-3 w-3 shrink-0" />
                            {statusConfig.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
