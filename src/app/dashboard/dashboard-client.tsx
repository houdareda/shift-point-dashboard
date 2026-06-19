/* eslint-disable react-hooks/preserve-manual-memoization */
'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Receipt, Wallet, PieChart, ShieldAlert, Briefcase, Calendar } from 'lucide-react'
import { getIncomingTransfersAction } from '@/app/actions/operations'

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
  total_amount?: number | null
}

interface MoneyRequestItem {
  amount: number
  status: string
  request_date: string
}

interface IncomingReportItem {
  transfers: Array<{ target_agent_id: string; amount: number }> | null
  report_date: string
  agent_id: string
}

interface DailyDataPoint {
  date: string
  day: number
  total: number
  personal: number
  sys1: number
  sys2: number
  sys3: number
  transfers: number
}

interface DashboardClientProps {
  initialWallets: WalletItem[]
  initialReports: ReportItem[]
  initialMoneyRequests: MoneyRequestItem[]
  initialIncomingReports: IncomingReportItem[]
  userId: string
  profileName: string
  agentSheets?: Record<string, string> | null
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
  initialMoneyRequests,
  initialIncomingReports,
  userId,
  profileName,
}: DashboardClientProps) {
  const [wallets, setWallets] = useState<WalletItem[]>(initialWallets)
  const [reports, setReports] = useState<ReportItem[]>(initialReports)
  const [moneyRequests, setMoneyRequests] = useState<MoneyRequestItem[]>(initialMoneyRequests)
  const [incomingReports, setIncomingReports] = useState<IncomingReportItem[]>(initialIncomingReports)
  const [hoveredPoint, setHoveredPoint] = useState<DailyDataPoint | null>(null)

  const tzOffset = new Date().getTimezoneOffset() * 60000
  // eslint-disable-next-line react-hooks/purity
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const currentMonthStr = todayLocal.substring(0, 7) // "YYYY-MM"

  const fetchLatestData = async () => {
    const supabase = createClient()

    // 1. Fetch active wallets
    const { data: wData } = await supabase
      .from('wallets')
      .select('id, phone_number, current_balance, is_active')
      .eq('agent_id', userId)
      .eq('is_active', true)
      .neq('is_archived', true)
      .order('created_at', { ascending: false })

    if (wData) {
      setWallets(wData)
    }

    // 2. Fetch daily reports (all-time)
    const { data: rData } = await supabase
      .from('daily_reports')
      .select('personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, report_date, transfers, total_amount')
      .eq('agent_id', userId)

    if (rData) {
      setReports(rData)
    }

    // 3. Fetch money requests (all-time)
    const { data: mrData } = await supabase
      .from('money_requests')
      .select('amount, status, request_date')
      .eq('agent_id', userId)
      .order('request_date', { ascending: false })

    if (mrData) {
      setMoneyRequests(mrData)
    }

    // 4. Fetch incoming transfers using server action
    const incomingData = await getIncomingTransfersAction(userId)
    if (incomingData) {
      setIncomingReports(incomingData as IncomingReportItem[])
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

    // Subscribe to daily reports updates (all-system reports to catch transfers)
    const reportsChannel = supabase
      .channel('dashboard-realtime-reports')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_reports',
        },
        () => {
          fetchLatestData()
        }
      )
      .subscribe()

    // Subscribe to money requests updates
    const moneyRequestsChannel = supabase
      .channel('dashboard-realtime-money-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'money_requests',
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
      supabase.removeChannel(moneyRequestsChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Calculation for Wallets
  const activeWallets = wallets.filter((w) => w.is_active !== false)
  const totalWalletBalance = activeWallets.reduce((acc, curr) => acc + (curr.current_balance || 0), 0)

  // Calculations for all-time and monthly expenses
  let totalSpentAllTime = 0
  let totalOutgoingTransfersAllTime = 0
  let monthlyPersonal = 0
  let monthlyMarketing1 = 0
  let monthlyMarketing2 = 0
  let monthlyMarketing3 = 0
  let monthlyTransfers = 0

  reports.forEach((rep) => {
    const transfersSum = rep.transfers && Array.isArray(rep.transfers)
      ? rep.transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0)
      : 0
    
    totalOutgoingTransfersAllTime += transfersSum
    
    const detailedSum = (Number(rep.personal_expenses || 0) + Number(rep.marketing_1_expenses || 0) + Number(rep.marketing_2_expenses || 0) + Number(rep.marketing_3_expenses || 0) + transfersSum)
    const repTotal = rep.total_amount !== null && rep.total_amount !== undefined && Number(rep.total_amount) > 0
      ? Number(rep.total_amount)
      : detailedSum

    totalSpentAllTime += repTotal

    if (rep.report_date && rep.report_date.startsWith(currentMonthStr)) {
      monthlyPersonal += Number(rep.personal_expenses || 0)
      monthlyMarketing1 += Number(rep.marketing_1_expenses || 0)
      monthlyMarketing2 += Number(rep.marketing_2_expenses || 0)
      monthlyMarketing3 += Number(rep.marketing_3_expenses || 0)
      monthlyTransfers += transfersSum
    }
  })

  const monthlyTotalExpenses = monthlyPersonal + monthlyMarketing1 + monthlyMarketing2 + monthlyMarketing3 + monthlyTransfers

  // Money Requests calculations
  let totalReceived = 0
  let totalPending = 0
  let pendingCount = 0

  moneyRequests.forEach((req) => {
    const amount = Number(req.amount || 0)
    if (req.status === 'approved') {
      totalReceived += amount
    } else if (req.status === 'pending') {
      totalPending += amount
      pendingCount++
    }
  })

  // Incoming Transfers calculations
  let totalIncomingTransfers = 0
  incomingReports.forEach((rep) => {
    if (rep.transfers && Array.isArray(rep.transfers)) {
      rep.transfers.forEach((t) => {
        if (t.target_agent_id === userId) {
          totalIncomingTransfers += Number(t.amount || 0)
        }
      })
    }
  })

  // Final custody balance calculations
  // العهدة الحالية = (الفلوس اللي طلبتها مقبولة + عهد مستلمة) - إجمالي المصاريف والعهد المرسلة
  const totalReceivedCustody = totalReceived + totalIncomingTransfers
  const currentCustody = totalReceivedCustody - totalSpentAllTime
  const actualExpensesAllTime = totalSpentAllTime - totalOutgoingTransfersAllTime

  const currentMonthName = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
    month: 'long',
    year: 'numeric',
  })

  // Prepare chart daily timeline data (all days of the current month)
  const dailyData = useMemo(() => {
    const year = Number(currentMonthStr.substring(0, 4))
    const month = Number(currentMonthStr.substring(5, 7))
    const daysInMonth = new Date(year, month, 0).getDate()
    
    const dataMap: Record<string, { total: number; personal: number; sys1: number; sys2: number; sys3: number; transfers: number }> = {}
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentMonthStr}-${String(d).padStart(2, '0')}`
      dataMap[dateStr] = { total: 0, personal: 0, sys1: 0, sys2: 0, sys3: 0, transfers: 0 }
    }
    
    reports.forEach((rep) => {
      if (rep.report_date && rep.report_date.startsWith(currentMonthStr)) {
        const dateStr = rep.report_date
        if (dataMap[dateStr]) {
          const transfersSum = rep.transfers && Array.isArray(rep.transfers)
            ? rep.transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0)
            : 0
          
          const detailedSum = (Number(rep.personal_expenses || 0) + Number(rep.marketing_1_expenses || 0) + Number(rep.marketing_2_expenses || 0) + Number(rep.marketing_3_expenses || 0) + transfersSum)
          const repTotal = rep.total_amount !== null && rep.total_amount !== undefined && Number(rep.total_amount) > 0
            ? Number(rep.total_amount)
            : detailedSum
          
          dataMap[dateStr].total += repTotal
          dataMap[dateStr].personal += Number(rep.personal_expenses || 0)
          dataMap[dateStr].sys1 += Number(rep.marketing_1_expenses || 0)
          dataMap[dateStr].sys2 += Number(rep.marketing_2_expenses || 0)
          dataMap[dateStr].sys3 += Number(rep.marketing_3_expenses || 0)
          dataMap[dateStr].transfers += transfersSum
        }
      }
    })
    
    return Object.entries(dataMap)
      .map(([date, val]) => ({
        date,
        day: Number(date.split('-')[2]),
        ...val,
      }))
      .sort((a, b) => a.day - b.day)
  }, [reports, currentMonthStr])

  // Chart rendering properties
  const chartProps = useMemo(() => {
    if (dailyData.length === 0) return null
    const w = 650
    const h = 220
    const paddingX = 40
    const paddingY = 25
    const innerWidth = w - 2 * paddingX
    const innerHeight = h - 2 * paddingY
    const maxVal = Math.max(...dailyData.map((d) => d.total), 100)

    const points = dailyData.map((d, index) => {
      const x = paddingX + (index / (dailyData.length - 1)) * innerWidth
      const y = paddingY + innerHeight - (d.total / maxVal) * innerHeight
      return { x, y, ...d }
    })

    const linePath = points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
      : ''
    
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${paddingY + innerHeight} L ${points[0].x} ${paddingY + innerHeight} Z`
      : ''

    return { w, h, paddingX, paddingY, innerWidth, innerHeight, maxVal, points, linePath, areaPath }
  }, [dailyData])

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Expenses */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-border text-brand-accent group-hover:scale-105 transition-transform duration-300">
              <Receipt className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">المصاريف الشهرية</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">إجمالي المصروفات</h3>
          <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {monthlyTotalExpenses.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim">ج.م</span>
          </p>
          <p className="mt-1 text-xs text-brand-dim/80">مصروفاتك المسجلة خلال شهر {currentMonthName}</p>

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-3">
            {/* Personal Expenses */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {monthlyPersonal.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-blue-400 bg-blue-400/10 border-blue-500/20">
                مصروف شخصي
              </span>
            </div>

            {/* Marketing 1 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {monthlyMarketing1.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border" style={{ color: '#818cf8', borderColor: '#818cf820', backgroundColor: '#818cf810' }}>
                ماركتنج 1
              </span>
            </div>

            {/* Marketing 2 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {monthlyMarketing2.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border" style={{ color: '#4ade80', borderColor: '#4ade8020', backgroundColor: '#4ade8010' }}>
                ماركتنج 2
              </span>
            </div>

            {/* Marketing 3 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {monthlyMarketing3.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border" style={{ color: '#c084fc', borderColor: '#c084fc20', backgroundColor: '#c084fc10' }}>
                ماركتنج 3
              </span>
            </div>

            {/* Sent Transfers */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-sm font-bold text-white font-mono">
                {monthlyTransfers.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-pink-400 bg-pink-400/10 border-pink-500/20">
                تحويل عهدة لزميل
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Current Custody */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-emerald-500/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-brand-border text-emerald-400 group-hover:scale-105 transition-transform duration-300">
              <Briefcase className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">العهدة الشخصية للعمل</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">العهدة الحالية</h3>
          <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {currentCustody.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim">ج.م</span>
          </p>
          <p className="mt-1 text-xs text-brand-dim/80">
            الرصيد المالي المتبقي في عهدتك للعمل
          </p>

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-2.5">
            {/* Approved Money Requests */}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-xs font-bold text-emerald-400 font-mono">
                +{totalReceived.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                طلبات شحن مقبولة
              </span>
            </div>

            {/* Incoming Transfers */}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-xs font-bold text-emerald-400 font-mono">
                +{totalIncomingTransfers.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                عهد مستلمة من زملاء
              </span>
            </div>

            {/* Expenses Spent */}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-xs font-bold text-rose-400 font-mono">
                -{actualExpensesAllTime.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/20 bg-rose-500/5 text-rose-400">
                مصاريف شخصية وتسويق
              </span>
            </div>

            {/* Outgoing Transfers */}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-xs font-bold text-rose-400 font-mono">
                -{totalOutgoingTransfersAllTime.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/20 bg-rose-500/5 text-rose-400">
                عهد مرسلة لزملاء
              </span>
            </div>

            {/* Pending Requests */}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
              <span className="text-xs font-bold text-amber-400 font-mono">
                {totalPending.toLocaleString('en-US')} ج.م
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/20 bg-amber-500/5 text-amber-400">
                طلبات معلقة ({pendingCount})
              </span>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-brand-border/40 text-center">
            <span className="text-[10px] text-brand-dim block font-mono">
              (إجمالي المستلم: {totalReceivedCustody.toLocaleString('en-US')} ج.م | إجمالي المنصرف: {totalSpentAllTime.toLocaleString('en-US')} ج.م)
            </span>
          </div>
        </div>

        {/* Card 3: Cash in Wallet */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-border text-brand-accent group-hover:scale-105 transition-transform duration-300">
              <Wallet className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">إيرادات ومحافظ الكاش لشهر {currentMonthName}</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">الكاش في المحفظة لشهر {currentMonthName}</h3>
          <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {totalWalletBalance.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim">ج.م</span>
          </p>
          <p className="mt-1 text-xs text-brand-dim/80">
            موزعة على ({activeWallets.length}) محافظ نشطة لشهر {currentMonthName}
          </p>

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
            {activeWallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-brand-dim">
                <ShieldAlert className="h-8 w-8 opacity-40 mb-2" />
                <span className="text-xs">لا توجد محافظ نشطة حالياً</span>
              </div>
            ) : (
              activeWallets.map((wallet, index) => {
                const colorClass = WALLET_COLORS[index % WALLET_COLORS.length]
                return (
                  <div
                    key={wallet.id}
                    className="flex items-center justify-between gap-2.5 py-1.5 px-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all"
                  >
                    <span className="text-xs font-extrabold text-white font-mono whitespace-nowrap">
                      {Number(wallet.current_balance || 0).toLocaleString('en-US')} ج.م
                    </span>
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] font-bold border tracking-wider font-mono whitespace-nowrap ${colorClass}`}>
                      {wallet.phone_number || 'غير معروف'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Analytics & Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Expense Trend Chart */}
        <div className="lg:col-span-2 relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">مخطط اتجاه الصرف اليومي</h3>
            <p className="text-xs text-brand-dim mb-4">حجم المصروفات اليومية المسجلة خلال الشهر الحالي</p>
          </div>

          {/* Interactive HTML Tooltip inside relative container */}
          {chartProps && (
            <div className="relative w-full h-[180px] mt-2">
              <div className="absolute top-0 left-0 bg-brand-card/95 border border-brand-border/60 rounded-xl p-3 shadow-lg pointer-events-none text-right min-w-[170px] z-20">
                {hoveredPoint ? (
                  <div className="space-y-1">
                    <div className="text-[10px] text-brand-dim flex items-center gap-1 justify-end font-medium">
                      <span>{hoveredPoint.day} {currentMonthName}</span>
                      <Calendar className="h-3 w-3" />
                    </div>
                    <div className="text-base font-extrabold text-white">
                      {hoveredPoint.total.toLocaleString('en-US')} ج.م
                    </div>
                    <div className="text-[10px] text-brand-dim mt-1 space-y-0.5 border-t border-brand-border/30 pt-1">
                      {hoveredPoint.personal > 0 && <div>شخصي: {hoveredPoint.personal} ج.م</div>}
                      {hoveredPoint.sys1 > 0 && <div>سيستم 1: {hoveredPoint.sys1} ج.م</div>}
                      {hoveredPoint.sys2 > 0 && <div>سيستم 2: {hoveredPoint.sys2} ج.م</div>}
                      {hoveredPoint.sys3 > 0 && <div>سيستم 3: {hoveredPoint.sys3} ج.م</div>}
                      {hoveredPoint.transfers > 0 && <div>تحويل: {hoveredPoint.transfers} ج.م</div>}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-brand-dim py-1 text-center font-medium">
                    مرر الماوس على المنحنى لرؤية التفاصيل
                  </div>
                )}
              </div>

              {/* The SVG element */}
              <svg
                viewBox={`0 0 ${chartProps.w} ${chartProps.h}`}
                className="w-full h-full overflow-visible"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <defs>
                  <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = chartProps.paddingY + (i / 4) * chartProps.innerHeight
                  const val = Math.round(chartProps.maxVal - (i / 4) * chartProps.maxVal)
                  return (
                    <g key={i} className="opacity-40">
                      <line
                        x1={chartProps.paddingX}
                        y1={y}
                        x2={chartProps.w - chartProps.paddingX}
                        y2={y}
                        stroke="rgba(255,255,255,0.08)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartProps.paddingX - 8}
                        y={y + 4}
                        fill="rgba(255,255,255,0.4)"
                        fontSize="9"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {val}
                      </text>
                    </g>
                  )
                })}

                {/* Area path */}
                {chartProps.areaPath && (
                  <path d={chartProps.areaPath} fill="url(#area-gradient)" />
                )}

                {/* Line path */}
                {chartProps.linePath && (
                  <path
                    d={chartProps.linePath}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover highlights */}
                {hoveredPoint && (
                  <>
                    <line
                      x1={chartProps.paddingX + ((hoveredPoint.day - 1) / (dailyData.length - 1)) * chartProps.innerWidth}
                      y1={chartProps.paddingY}
                      x2={chartProps.paddingX + ((hoveredPoint.day - 1) / (dailyData.length - 1)) * chartProps.innerWidth}
                      y2={chartProps.paddingY + chartProps.innerHeight}
                      stroke="rgba(139,92,246,0.3)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={chartProps.paddingX + ((hoveredPoint.day - 1) / (dailyData.length - 1)) * chartProps.innerWidth}
                      cy={chartProps.paddingY + chartProps.innerHeight - (hoveredPoint.total / chartProps.maxVal) * chartProps.innerHeight}
                      r="6"
                      fill="rgba(139,92,246,0.4)"
                    />
                    <circle
                      cx={chartProps.paddingX + ((hoveredPoint.day - 1) / (dailyData.length - 1)) * chartProps.innerWidth}
                      cy={chartProps.paddingY + chartProps.innerHeight - (hoveredPoint.total / chartProps.maxVal) * chartProps.innerHeight}
                      r="3.5"
                      fill="#8b5cf6"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </>
                )}

                {/* Interactive transparent rectangles for mouse tracking */}
                {chartProps.points.map((pt, index) => {
                  const widthPerDay = chartProps.innerWidth / (dailyData.length - 1)
                  const x = chartProps.paddingX + index * widthPerDay - widthPerDay / 2
                  return (
                    <rect
                      key={pt.date}
                      x={x}
                      y={chartProps.paddingY}
                      width={widthPerDay}
                      height={chartProps.innerHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(pt)}
                    />
                  )
                })}

                {/* X axis labels (1st, 10th, 20th, 30th) */}
                {[1, 10, 20, 30].map((day) => {
                  if (day > dailyData.length) return null
                  const index = day - 1
                  const x = chartProps.paddingX + (index / (dailyData.length - 1)) * chartProps.innerWidth
                  return (
                    <text
                      key={day}
                      x={x}
                      y={chartProps.h - 6}
                      fill="rgba(255,255,255,0.4)"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {day}
                    </text>
                  )
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Expense Breakdown Card */}
        <div className="relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">توزيع النفقات</h3>
            <p className="text-xs text-brand-dim mb-4">نسب الصرف حسب التصنيف خلال الشهر الحالي</p>
          </div>

          {monthlyTotalExpenses === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-brand-dim flex-1">
              <ShieldAlert className="h-8 w-8 opacity-40 mb-2" />
              <span className="text-xs">لا توجد مصروفات مسجلة في هذا الشهر</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center">
              {/* Stacked Percentage Bar */}
              <div className="h-5 w-full rounded-full bg-brand-border/40 overflow-hidden flex mb-6 shadow-inner">
                {monthlyPersonal > 0 && (
                  <div
                    style={{ width: `${(monthlyPersonal / monthlyTotalExpenses) * 100}%` }}
                    className="bg-blue-500 h-full transition-all duration-300 hover:opacity-90"
                    title={`شخصي: ${((monthlyPersonal / monthlyTotalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
                {monthlyMarketing1 > 0 && (
                  <div
                    className="h-full transition-all duration-300 hover:opacity-90"
                    style={{ width: `${(monthlyMarketing1 / monthlyTotalExpenses) * 100}%`, backgroundColor: '#818cf8' }}
                    title={`سيستم 1: ${((monthlyMarketing1 / monthlyTotalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
                {monthlyMarketing2 > 0 && (
                  <div
                    className="h-full transition-all duration-300 hover:opacity-90"
                    style={{ width: `${(monthlyMarketing2 / monthlyTotalExpenses) * 100}%`, backgroundColor: '#22c55e' }}
                    title={`سيستم 2: ${((monthlyMarketing2 / monthlyTotalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
                {monthlyMarketing3 > 0 && (
                  <div
                    className="h-full transition-all duration-300 hover:opacity-90"
                    style={{ width: `${(monthlyMarketing3 / monthlyTotalExpenses) * 100}%`, backgroundColor: '#a855f7' }}
                    title={`سيستم 3: ${((monthlyMarketing3 / monthlyTotalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
                {monthlyTransfers > 0 && (
                  <div
                    style={{ width: `${(monthlyTransfers / monthlyTotalExpenses) * 100}%` }}
                    className="bg-pink-500 h-full transition-all duration-300 hover:opacity-90"
                    title={`تحويلات: ${((monthlyTransfers / monthlyTotalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
              </div>

              {/* Legends & Details */}
              <div className="space-y-3.5">
                {/* Personal Expenses */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-blue-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-brand-dim">مصروف شخصي</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{monthlyPersonal.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((monthlyPersonal / monthlyTotalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Sys 1 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: '#818cf8' }} />
                    <span className="text-xs font-semibold text-brand-dim">سيستم 1 (تسويق)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{monthlyMarketing1.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((monthlyMarketing1 / monthlyTotalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Sys 2 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
                    <span className="text-xs font-semibold text-brand-dim">سيستم 2 (تسويق)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{monthlyMarketing2.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((monthlyMarketing2 / monthlyTotalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Sys 3 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: '#a855f7' }} />
                    <span className="text-xs font-semibold text-brand-dim">سيستم 3 (تسويق)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{monthlyMarketing3.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((monthlyMarketing3 / monthlyTotalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Transfers */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-pink-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-brand-dim">تحويل عهدة لزميل</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{monthlyTransfers.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((monthlyTransfers / monthlyTotalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
