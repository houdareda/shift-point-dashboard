'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Receipt, Wallet, ArrowUpLeft, Coins, PieChart, ShieldAlert } from 'lucide-react'

interface WalletItem {
  id: string
  phone_number: string
  current_balance: number
  is_active: boolean
}

interface ReportItem {
  personal_expenses: number
  marketing_1_expenses: number
  marketing_2_expenses: number
  marketing_3_expenses: number
  report_date: string
  transfers?: Array<{ target_agent_id: string; amount: number }> | null
}

interface DashboardClientProps {
  initialWallets: WalletItem[]
  initialReports: ReportItem[]
  userId: string
  profileName: string
}

const WALLET_COLORS = [
  'text-blue-400 bg-blue-400/10 border-blue-500/20',
  'text-amber-400 bg-amber-400/10 border-amber-500/20',
  'text-purple-400 bg-purple-400/10 border-purple-500/20',
  'text-emerald-400 bg-emerald-400/10 border-emerald-500/20',
  'text-pink-400 bg-pink-400/10 border-pink-500/20',
]

export default function DashboardClient({
  initialWallets,
  initialReports,
  userId,
  profileName,
}: DashboardClientProps) {
  const [wallets, setWallets] = useState<WalletItem[]>(initialWallets)
  const [reports, setReports] = useState<ReportItem[]>(initialReports)

  const tzOffset = new Date().getTimezoneOffset() * 60000
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const currentMonthStr = todayLocal.substring(0, 7) // "YYYY-MM"
  const firstDayOfMonth = `${currentMonthStr}-01`

  const fetchLatestData = async () => {
    const supabase = createClient()

    // 1. Fetch active wallets
    const { data: wData } = await supabase
      .from('wallets')
      .select('id, phone_number, current_balance, is_active')
      .eq('agent_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (wData) {
      setWallets(wData)
    }

    // 2. Fetch daily reports for the current month
    const { data: rData } = await supabase
      .from('daily_reports')
      .select('personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, report_date, transfers')
      .eq('agent_id', userId)
      .gte('report_date', firstDayOfMonth)

    if (rData) {
      setReports(rData)
    }
  }

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Subscribe to wallets updates
    const walletsChannel = supabase
      .channel('dashboard-realtime-wallets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `agent_id=eq.${userId}`,
        },
        () => {
          fetchLatestData()
        }
      )
      .subscribe()

    // Subscribe to daily reports updates
    const reportsChannel = supabase
      .channel('dashboard-realtime-reports')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_reports',
          filter: `agent_id=eq.${userId}`,
        },
        () => {
          fetchLatestData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(walletsChannel)
      supabase.removeChannel(reportsChannel)
    }
  }, [userId])

  // Calculation for Wallets
  const activeWallets = wallets.filter((w) => w.is_active !== false)
  const totalWalletBalance = activeWallets.reduce((acc, curr) => acc + (curr.current_balance || 0), 0)

  // Calculation for Expenses
  let totalPersonal = 0
  let totalMarketing1 = 0
  let totalMarketing2 = 0
  let totalMarketing3 = 0
  let totalTransfers = 0

  reports.forEach((rep) => {
    totalPersonal += Number(rep.personal_expenses || 0)
    totalMarketing1 += Number(rep.marketing_1_expenses || 0)
    totalMarketing2 += Number(rep.marketing_2_expenses || 0)
    totalMarketing3 += Number(rep.marketing_3_expenses || 0)
    if (rep.transfers && Array.isArray(rep.transfers)) {
      rep.transfers.forEach((t) => {
        totalTransfers += Number(t.amount || 0)
      })
    }
  })

  const totalExpenses = totalPersonal + totalMarketing1 + totalMarketing2 + totalMarketing3 + totalTransfers

  const currentMonthName = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Welcome & Dashboard header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <PieChart className="h-7 w-7 text-brand-accent animate-pulse" />
            <span>لوحة المعلومات الرئيسية</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            مرحباً بك، <span className="text-white font-semibold">{profileName}</span>. إليك ملخص المعاملات المالية والمحفظة الخاصة بك خلال شهر {currentMonthName}.
          </p>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Total Expenses */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 md:p-8 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-border text-brand-accent group-hover:scale-105 transition-transform duration-300">
              <Receipt className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">المصاريف الشهرية</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">إجمالي المصروفات</h3>
          <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {totalExpenses.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim">ج.م</span>
          </p>
          <p className="mt-1 text-xs text-brand-dim/80">مصروفاتك المسجلة خلال شهر {currentMonthName}</p>

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-3">
            {/* Personal Expenses */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {totalPersonal.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-blue-400 bg-blue-400/10 border-blue-500/20">
                مصروف شخصي
              </span>
            </div>

            {/* Marketing 1 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {totalMarketing1.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-amber-400 bg-amber-400/10 border-amber-500/20">
                ماركتنج 1
              </span>
            </div>

            {/* Marketing 2 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {totalMarketing2.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-purple-400 bg-purple-400/10 border-purple-500/20">
                ماركتنج 2
              </span>
            </div>

            {/* Marketing 3 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {totalMarketing3.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-emerald-400 bg-emerald-400/10 border-emerald-500/20">
                ماركتنج 3
              </span>
            </div>

            {/* Sent Transfers */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {totalTransfers.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-purple-400 bg-purple-400/10 border-purple-500/20">
                تحويل عهدة لزميل
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Cash in Wallet */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 md:p-8 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-border text-brand-accent group-hover:scale-105 transition-transform duration-300">
              <Wallet className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">إيرادات ومحافظ الكاش</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">الكاش في المحفظة</h3>
          <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {totalWalletBalance.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim">ج.م</span>
          </p>
          <p className="mt-1 text-xs text-brand-dim/80">
            موزعة على ({activeWallets.length}) محافظ نشطة
          </p>

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-3">
            {activeWallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-brand-dim">
                <ShieldAlert className="h-8 w-8 opacity-40 mb-2" />
                <span className="text-xs">لا توجد محافظ نشطة حالياً</span>
              </div>
            ) : (
              activeWallets.map((wallet, index) => {
                const colorClass = WALLET_COLORS[index % WALLET_COLORS.length]
                const last4Digits = wallet.phone_number ? wallet.phone_number.slice(-4) : 'غير معروف'
                return (
                  <div
                    key={wallet.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all"
                  >
                    <span className="text-sm font-bold text-white font-mono">
                      {Number(wallet.current_balance || 0).toLocaleString('en-US')} ج.م
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}>
                      محفظة {last4Digits}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
