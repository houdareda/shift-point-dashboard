'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Receipt,
  Wallet,
  ChevronDown,
  Check,
  X,
  BarChart3,
  ShieldAlert,
  Briefcase,
  Calendar,
  Smartphone,
  PieChart
} from 'lucide-react'

interface WalletItem {
  id: string
  phone_number: string
  current_balance: number
  is_active: boolean
  agent_id: string
}

interface ReportItem {
  id: string
  personal_expenses: number
  marketing_1_expenses: number
  marketing_2_expenses: number
  marketing_3_expenses: number
  report_date: string
  transfers?: Array<{ target_agent_id: string; amount: number }> | null
  agent_id: string
}

interface MoneyRequestItem {
  id: string
  amount: number
  status: string
  request_date: string
  agent_id: string
}

interface AgentProfile {
  id: string
  full_name: string | null
}

interface AdminDashboardClientProps {
  agents: AgentProfile[]
  initialWallets: WalletItem[]
  initialReports: ReportItem[]
  initialMoneyRequests: MoneyRequestItem[]
  profileName: string
  userRole: string
}

interface DailyDataPoint {
  date: string
  day: number
  label: string
  total: number
  personal: number
  sys1: number
  sys2: number
  sys3: number
  transfers: number
}

const WALLET_COLORS = [
  'text-blue-400 bg-blue-400/10 border-blue-500/20',
  'text-amber-400 bg-amber-400/10 border-amber-500/20',
  'text-purple-400 bg-purple-400/10 border-purple-500/20',
  'text-emerald-400 bg-emerald-400/10 border-emerald-500/20',
  'text-pink-400 bg-pink-400/10 border-pink-500/20',
]

export default function AdminDashboardClient({
  agents,
  initialWallets,
  initialReports,
  initialMoneyRequests,
  profileName,
  userRole,
}: AdminDashboardClientProps) {
  const [wallets, setWallets] = useState<WalletItem[]>(initialWallets)
  const [reports, setReports] = useState<ReportItem[]>(initialReports)
  const [moneyRequests, setMoneyRequests] = useState<MoneyRequestItem[]>(initialMoneyRequests)
  const [hoveredPoint, setHoveredPoint] = useState<DailyDataPoint | null>(null)

  // Filter States
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const tzOffset = new Date().getTimezoneOffset() * 60000
  // eslint-disable-next-line react-hooks/purity
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const currentMonthStr = todayLocal.substring(0, 7)
  const firstDayOfMonth = `${currentMonthStr}-01`

  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(todayLocal)

  // Skeleton Loader State for dynamic filter recalculations
  const [isCalculating, setIsCalculating] = useState(false)

  useEffect(() => {
    setIsCalculating(true)
    const timer = setTimeout(() => {
      setIsCalculating(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [selectedAgents, startDate, endDate])

  // Real-time synchronization
  useEffect(() => {
    const supabase = createClient()

    const walletsChannel = supabase
      .channel('admin-realtime-wallets')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallets' },
        (payload) => {
          setWallets((prev) => {
            if (prev.some((w) => w.id === payload.new.id)) return prev
            return [payload.new as WalletItem, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wallets' },
        (payload) => {
          setWallets((prev) =>
            prev.map((w) => (w.id === payload.new.id ? { ...w, ...payload.new } : w))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'wallets' },
        (payload) => {
          setWallets((prev) => prev.filter((w) => w.id !== payload.old.id))
        }
      )
      .subscribe()

    const reportsChannel = supabase
      .channel('admin-realtime-reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'daily_reports' },
        (payload) => {
          setReports((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) return prev
            return [payload.new as ReportItem, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'daily_reports' },
        (payload) => {
          setReports((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) {
              return prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r))
            }
            return [payload.new as ReportItem, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'daily_reports' },
        (payload) => {
          setReports((prev) => prev.filter((r) => r.id !== payload.old.id))
        }
      )
      .subscribe()

    const moneyRequestsChannel = supabase
      .channel('admin-realtime-money-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'money_requests' },
        (payload) => {
          setMoneyRequests((prev) => {
            if (prev.some((r) => r.id === payload.new.id)) return prev
            return [payload.new as MoneyRequestItem, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'money_requests' },
        (payload) => {
          setMoneyRequests((prev) =>
            prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'money_requests' },
        (payload) => {
          setMoneyRequests((prev) => prev.filter((r) => r.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(walletsChannel)
      supabase.removeChannel(reportsChannel)
      supabase.removeChannel(moneyRequestsChannel)
    }
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Toggle single agent selection
  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) => {
      if (prev.includes(agentId)) {
        return prev.filter((id) => id !== agentId)
      } else {
        return [...prev, agentId]
      }
    })
  }

  // Toggle All agents
  const toggleAll = () => {
    if (selectedAgents.length === agents.length) {
      setSelectedAgents([])
    } else {
      setSelectedAgents(agents.map((a) => a.id))
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setSelectedAgents([])
    setStartDate(firstDayOfMonth)
    setEndDate(todayLocal)
  }

  // Filter Logic applied locally
  const isAgentFiltered = selectedAgents.length > 0

  // 1. Filtered active wallets
  const filteredWallets = wallets.filter((w) => {
    if (isAgentFiltered) {
      return selectedAgents.includes(w.agent_id)
    }
    return true
  })
  const activeWallets = filteredWallets.filter((w) => w.is_active !== false)
  const totalWalletBalance = activeWallets.reduce((acc, curr) => acc + (curr.current_balance || 0), 0)

  // 2. Filtered reports (within date range and selected agents) for Expenses Card and Charts
  const filteredReports = reports.filter((r) => {
    const isWithinDate = r.report_date >= startDate && r.report_date <= endDate
    if (!isWithinDate) return false
    if (isAgentFiltered) {
      return selectedAgents.includes(r.agent_id)
    }
    return true
  })

  // Date Range Expenses Calculations
  let totalPersonal = 0
  let totalMarketing1 = 0
  let totalMarketing2 = 0
  let totalMarketing3 = 0
  let totalTransfers = 0

  filteredReports.forEach((rep) => {
    const transfersSum = rep.transfers && Array.isArray(rep.transfers)
      ? rep.transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0)
      : 0
    
    totalPersonal += Number(rep.personal_expenses || 0)
    totalMarketing1 += Number(rep.marketing_1_expenses || 0)
    totalMarketing2 += Number(rep.marketing_2_expenses || 0)
    totalMarketing3 += Number(rep.marketing_3_expenses || 0)
    totalTransfers += transfersSum
  })

  const totalExpenses = totalPersonal + totalMarketing1 + totalMarketing2 + totalMarketing3 + totalTransfers

  // 3. Filtered money requests (all-time for custody, only selected agents)
  const filteredMoneyRequests = moneyRequests.filter((r) => {
    if (isAgentFiltered) {
      return selectedAgents.includes(r.agent_id)
    }
    return true
  })

  // Custody Calculations for selected agents (all-time)
  let totalReceived = 0
  let totalPending = 0
  let pendingCount = 0

  filteredMoneyRequests.forEach((req) => {
    const amount = Number(req.amount || 0)
    if (req.status === 'approved') {
      totalReceived += amount
    } else if (req.status === 'pending') {
      totalPending += amount
      pendingCount++
    }
  })

  // Spent Expenses (all-time, filtered by agent)
  let totalSpentAllTime = 0
  let totalOutgoingTransfersAllTime = 0

  const allTimeReportsForSelectedAgents = reports.filter((r) => {
    if (isAgentFiltered) {
      return selectedAgents.includes(r.agent_id)
    }
    return true
  })

  allTimeReportsForSelectedAgents.forEach((rep) => {
    const transfersSum = rep.transfers && Array.isArray(rep.transfers)
      ? rep.transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0)
      : 0
    
    totalOutgoingTransfersAllTime += transfersSum
    
    const detailedSum = Number(rep.personal_expenses || 0) +
      Number(rep.marketing_1_expenses || 0) +
      Number(rep.marketing_2_expenses || 0) +
      Number(rep.marketing_3_expenses || 0) +
      transfersSum
      
    totalSpentAllTime += detailedSum
  })

  // Incoming Transfers (all-time, matching target agent in selected agents list)
  let totalIncomingTransfers = 0
  reports.forEach((rep) => {
    if (rep.transfers && Array.isArray(rep.transfers)) {
      rep.transfers.forEach((t) => {
        const isTargetMatch = isAgentFiltered 
          ? selectedAgents.includes(t.target_agent_id)
          : agents.some((a) => a.id === t.target_agent_id)
        if (isTargetMatch) {
          totalIncomingTransfers += Number(t.amount || 0)
        }
      })
    }
  })

  const totalReceivedCustody = totalReceived + totalIncomingTransfers
  const currentCustody = totalReceivedCustody - totalSpentAllTime
  const actualExpensesAllTime = totalSpentAllTime - totalOutgoingTransfersAllTime

  // Dropdown Label compute
  const getDropdownLabel = () => {
    if (selectedAgents.length === 0 || selectedAgents.length === agents.length) {
      return 'الكل (جميع الموظفين)'
    }
    if (selectedAgents.length === 1) {
      const match = agents.find((a) => a.id === selectedAgents[0])
      return match?.full_name || 'موظف واحد'
    }
    return `${selectedAgents.length} موظفين`
  }

  const roleLabel =
    userRole === 'admin' || userRole === 'owner'
      ? 'مدير النظام'
      : userRole === 'leader'
      ? 'قائد الفريق'
      : 'المحاسب'

  // Prepare chart daily timeline data (all days between startDate and endDate)
  const dailyData = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const dataMap: Record<string, { total: number; personal: number; sys1: number; sys2: number; sys3: number; transfers: number }> = {}
    
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || diffDays > 366 || diffDays <= 0) {
      return []
    }
    
    for (let i = 0; i < diffDays; i++) {
      const nextDate = new Date(start)
      nextDate.setDate(start.getDate() + i)
      const dateStr = nextDate.toISOString().split('T')[0]
      dataMap[dateStr] = { total: 0, personal: 0, sys1: 0, sys2: 0, sys3: 0, transfers: 0 }
    }
    
    filteredReports.forEach((rep) => {
      const dateStr = rep.report_date
      if (dataMap[dateStr]) {
        const transfersSum = rep.transfers && Array.isArray(rep.transfers)
          ? rep.transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0)
          : 0
        
        const detailedSum = Number(rep.personal_expenses || 0) +
          Number(rep.marketing_1_expenses || 0) +
          Number(rep.marketing_2_expenses || 0) +
          Number(rep.marketing_3_expenses || 0) +
          transfersSum
          
        dataMap[dateStr].total += detailedSum
        dataMap[dateStr].personal += Number(rep.personal_expenses || 0)
        dataMap[dateStr].sys1 += Number(rep.marketing_1_expenses || 0)
        dataMap[dateStr].sys2 += Number(rep.marketing_2_expenses || 0)
        dataMap[dateStr].sys3 += Number(rep.marketing_3_expenses || 0)
        dataMap[dateStr].transfers += transfersSum
      }
    })
    
    return Object.entries(dataMap)
      .map(([date, val]) => ({
        date,
        day: Number(date.split('-')[2]),
        label: date.substring(5), // "MM-DD"
        ...val,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredReports, startDate, endDate])

  // Chart rendering properties
  const chartProps = useMemo(() => {
    if (dailyData.length === 0) return null
    const w = 650
    const h = 220
    const paddingX = 45
    const paddingY = 25
    const innerWidth = w - 2 * paddingX
    const innerHeight = h - 2 * paddingY
    const maxVal = Math.max(...dailyData.map((d) => d.total), 100)

    const points = dailyData.map((d, index) => {
      const x = paddingX + (index / (dailyData.length - 1 || 1)) * innerWidth
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

  const labelIndexes = useMemo(() => {
    if (dailyData.length <= 4) {
      return dailyData.map((_, i) => i)
    }
    return [
      0,
      Math.floor(dailyData.length * 0.33),
      Math.floor(dailyData.length * 0.66),
      dailyData.length - 1
    ]
  }, [dailyData])

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Welcome & Dashboard header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <PieChart className="h-7 w-7 text-brand-accent animate-pulse" />
            <span>لوحة المعلومات الرئيسية (God Mode Overview)</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            مرحباً بك، <span className="text-white font-semibold">{profileName}</span> ({roleLabel}). استعرض البيانات المالية والمحافظ ومصاريف الموظفين بشكل مجمع ولحظي.
          </p>
        </div>
      </div>

      {/* Elegant Filters Bar */}
      <div className="w-full p-5 rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl shadow-lg flex flex-col gap-5 text-right relative z-20">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-brand-dim flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-ping" />
            <span>خيارات التصفية والبحث للموظفين والتواريخ</span>
          </span>
          {(selectedAgents.length > 0 || startDate !== firstDayOfMonth || endDate !== todayLocal) && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-error bg-brand-error/10 hover:bg-brand-error/20 border border-brand-error/15 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>مسح الفلاتر</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Agent Selector Dropdown */}
          <div className="space-y-2" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-brand-dim">الموظفين (Agents)</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 px-4 text-white focus:border-brand-accent focus:outline-none transition-all text-sm cursor-pointer text-right"
              >
                <span className="truncate pl-2">{getDropdownLabel()}</span>
                <ChevronDown className={`h-4.5 w-4.5 text-white/40 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 left-0 mt-2 z-30 max-h-60 overflow-y-auto rounded-xl bg-brand-bg border border-brand-border shadow-2xl p-2 animate-fade-in text-right">
                  {/* Select All */}
                  <div
                    onClick={toggleAll}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-white hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <span className="font-bold">تحديد الكل (Select All)</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      selectedAgents.length === agents.length
                        ? 'bg-brand-accent border-brand-accent text-white'
                        : 'border-white/20'
                    }`}>
                      {selectedAgents.length === agents.length && <Check className="h-3 w-3" />}
                    </div>
                  </div>

                  <div className="h-px bg-brand-border/60 my-1.5" />

                  {/* Individual Agents */}
                  {agents.length === 0 ? (
                    <div className="p-3 text-center text-xs text-brand-dim">لا يوجد موظفون مضافون</div>
                  ) : (
                    agents.map((agent) => {
                      const isSelected = selectedAgents.includes(agent.id)
                      return (
                        <div
                          key={agent.id}
                          onClick={() => toggleAgent(agent.id)}
                          className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <span>{agent.full_name || 'موظف بدون اسم'}</span>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-brand-accent border-brand-accent text-white'
                              : 'border-white/20'
                          }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date Picker Start */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-brand-dim">تاريخ البدء (From)</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 px-4 text-white focus:border-brand-accent focus:outline-none transition-all text-sm text-right dir-rtl [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Date Picker End */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-brand-dim">تاريخ الانتهاء (To)</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 px-4 text-white focus:border-brand-accent focus:outline-none transition-all text-sm text-right dir-rtl [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Total Expenses (Filtered range) */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-border text-brand-accent group-hover:scale-105 transition-transform duration-300">
              <Receipt className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">المصاريف الكلية للفترة</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">إجمالي المصروفات</h3>
          
          {isCalculating ? (
            <div className="mt-2 space-y-2">
              <div className="h-8 w-36 bg-white/5 rounded-lg animate-pulse" />
              <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight font-mono">
                {totalExpenses.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim font-sans">ج.م</span>
              </p>
              <p className="mt-1 text-xs text-brand-dim/80">مصروفات الموظفين المحددين في الفترة المصفاة</p>
            </>
          )}

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-3">
            {isCalculating ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                  <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
                  <div className="h-4.5 w-16 bg-white/5 rounded-full animate-pulse" />
                </div>
              ))
            ) : (
              <>
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
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border" style={{ color: '#818cf8', borderColor: '#818cf820', backgroundColor: '#818cf810' }}>
                    ماركتنج 1
                  </span>
                </div>

                {/* Marketing 2 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
                  <span className="text-sm font-bold text-white font-mono">
                    {totalMarketing2.toLocaleString('en-US')} ج.م
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border" style={{ color: '#4ade80', borderColor: '#4ade8020', backgroundColor: '#4ade8010' }}>
                    ماركتنج 2
                  </span>
                </div>

                {/* Marketing 3 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
                  <span className="text-sm font-bold text-white font-mono">
                    {totalMarketing3.toLocaleString('en-US')} ج.م
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border" style={{ color: '#c084fc', borderColor: '#c084fc20', backgroundColor: '#c084fc10' }}>
                    ماركتنج 3
                  </span>
                </div>

                {/* Sent Transfers */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
                  <span className="text-sm font-bold text-white font-mono">
                    {totalTransfers.toLocaleString('en-US')} ج.م
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-pink-400 bg-pink-400/10 border-pink-500/20">
                    تحويل عهدة لزميل
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Current Custody Balance (All-Time) */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-emerald-500/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-brand-border text-emerald-400 group-hover:scale-105 transition-transform duration-300">
              <Briefcase className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">العهدة المجمعة للموظفين</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">إجمالي العهدة الحالية</h3>
          
          {isCalculating ? (
            <div className="mt-2 space-y-2">
              <div className="h-8 w-36 bg-white/5 rounded-lg animate-pulse" />
              <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight font-mono">
                {currentCustody.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim font-sans">ج.م</span>
              </p>
              <p className="mt-1 text-xs text-brand-dim/80">الرصيد المالي الإجمالي المتبقي بعهدة الموظفين المحددين</p>
            </>
          )}

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-2.5">
            {isCalculating ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                  <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-white/5 rounded-full animate-pulse" />
                </div>
              ))
            ) : (
              <>
                {/* Approved Requests */}
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
              </>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/40 text-center">
            <span className="text-[10px] text-brand-dim block font-mono">
              (إجمالي المستلم: {totalReceivedCustody.toLocaleString('en-US')} ج.م | إجمالي المنصرف: {totalSpentAllTime.toLocaleString('en-US')} ج.م)
            </span>
          </div>
        </div>

        {/* Card 3: Combined Wallet Balance */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-border text-brand-accent group-hover:scale-105 transition-transform duration-300">
              <Wallet className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">محافظ الكاش المجمعة للموظفين</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">الكاش المجمع في المحافظ</h3>

          {isCalculating ? (
            <div className="mt-2 space-y-2">
              <div className="h-8 w-36 bg-white/5 rounded-lg animate-pulse" />
              <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight font-mono">
                {totalWalletBalance.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim font-sans">ج.م</span>
              </p>
              <p className="mt-1 text-xs text-brand-dim/80">
                موزعة على ({activeWallets.length}) محافظ نشطة للموظفين المحددين
              </p>
            </>
          )}

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
            {isCalculating ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                  <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
                  <div className="h-4.5 w-16 bg-white/5 rounded-full animate-pulse" />
                </div>
              ))
            ) : activeWallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-brand-dim">
                <ShieldAlert className="h-8 w-8 opacity-40 mb-2" />
                <span className="text-xs">لا توجد محافظ نشطة للموظفين المحددين</span>
              </div>
            ) : (
              activeWallets.map((wallet, index) => {
                const colorClass = WALLET_COLORS[index % WALLET_COLORS.length]
                const agentProfile = agents.find((a) => a.id === wallet.agent_id)
                const agentName = agentProfile?.full_name || 'موظف'
                return (
                  <div
                    key={wallet.id}
                    className="flex items-center justify-between gap-2.5 py-1 px-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.06] transition-all duration-300"
                  >
                    <span className="text-xs font-extrabold text-white font-mono whitespace-nowrap">
                      {Number(wallet.current_balance || 0).toLocaleString('en-US')} ج.م
                    </span>
                    
                    <div className="flex items-center gap-2 text-right">
                      <Smartphone className="h-3.5 w-3.5 text-brand-accent" />
                      <span className="text-[17px] font-bold text-white font-mono tracking-wide">
                        {wallet.phone_number || 'غير معروف'}
                      </span>
                      <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-lg text-[9px] font-bold border whitespace-nowrap ${colorClass}`}>
                        {agentName}
                      </span>
                    </div>
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
            <p className="text-xs text-brand-dim mb-4">حجم المصروفات اليومية المسجلة للموظفين خلال الفترة المحددة</p>
          </div>

          {/* Interactive HTML Tooltip inside relative container */}
          {chartProps && (
            <div className="relative w-full h-[180px] mt-2">
              <div className="absolute top-0 left-0 bg-brand-card/95 border border-brand-border/60 rounded-xl p-3 shadow-lg pointer-events-none text-right min-w-[170px] z-20">
                {hoveredPoint ? (
                  <div className="space-y-1">
                    <div className="text-[10px] text-brand-dim flex items-center gap-1 justify-end font-medium">
                      <span>{hoveredPoint.date}</span>
                      <Calendar className="h-3 w-3" />
                    </div>
                    <div className="text-base font-extrabold text-white font-mono">
                      {hoveredPoint.total.toLocaleString('en-US')} ج.م
                    </div>
                    <div className="text-[10px] text-brand-dim mt-1 space-y-0.5 border-t border-brand-border/30 pt-1 font-sans">
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
                  <linearGradient id="admin-area-gradient" x1="0" y1="0" x2="0" y2="1">
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
                  <path d={chartProps.areaPath} fill="url(#admin-area-gradient)" />
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
                    {(() => {
                      const idx = dailyData.findIndex((d) => d.date === hoveredPoint.date)
                      const x = chartProps.paddingX + (idx / (dailyData.length - 1 || 1)) * chartProps.innerWidth
                      const y = chartProps.paddingY + chartProps.innerHeight - (hoveredPoint.total / chartProps.maxVal) * chartProps.innerHeight
                      return (
                        <>
                          <line
                            x1={x}
                            y1={chartProps.paddingY}
                            x2={x}
                            y2={chartProps.paddingY + chartProps.innerHeight}
                            stroke="rgba(139,92,246,0.3)"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                          <circle cx={x} cy={y} r="6" fill="rgba(139,92,246,0.4)" />
                          <circle cx={x} cy={y} r="3.5" fill="#8b5cf6" stroke="#ffffff" strokeWidth="1.5" />
                        </>
                      )
                    })()}
                  </>
                )}

                {/* Interactive transparent rectangles for mouse tracking */}
                {chartProps.points.map((pt, index) => {
                  const widthPerDay = chartProps.innerWidth / (dailyData.length - 1 || 1)
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

                {/* X axis labels (evenly spaced based on dates) */}
                {labelIndexes.map((idx) => {
                  const item = dailyData[idx]
                  if (!item) return null
                  const x = chartProps.paddingX + (idx / (dailyData.length - 1 || 1)) * chartProps.innerWidth
                  return (
                    <text
                      key={item.date}
                      x={x}
                      y={chartProps.h - 6}
                      fill="rgba(255,255,255,0.4)"
                      fontSize="9"
                      textAnchor="middle"
                    >
                      {item.label}
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
            <p className="text-xs text-brand-dim mb-4">نسب الصرف حسب التصنيف خلال الفترة المحددة</p>
          </div>

          {totalExpenses === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-brand-dim flex-1">
              <ShieldAlert className="h-8 w-8 opacity-40 mb-2" />
              <span className="text-xs">لا توجد مصروفات مسجلة للموظفين المحددين في هذه الفترة</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center">
              {/* Stacked Percentage Bar */}
              <div className="h-5 w-full rounded-full bg-brand-border/40 overflow-hidden flex mb-6 shadow-inner">
                {totalPersonal > 0 && (
                  <div
                    style={{ width: `${(totalPersonal / totalExpenses) * 100}%` }}
                    className="bg-blue-500 h-full transition-all duration-300 hover:opacity-90"
                    title={`شخصي: ${((totalPersonal / totalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
                {totalMarketing1 > 0 && (
                  <div
                    className="h-full transition-all duration-300 hover:opacity-90"
                    style={{ width: `${(totalMarketing1 / totalExpenses) * 100}%`, backgroundColor: '#818cf8' }}
                    title={`سيستم 1: ${((totalMarketing1 / totalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
                {totalMarketing2 > 0 && (
                  <div
                    className="h-full transition-all duration-300 hover:opacity-90"
                    style={{ width: `${(totalMarketing2 / totalExpenses) * 100}%`, backgroundColor: '#22c55e' }}
                    title={`سيستم 2: ${((totalMarketing2 / totalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
                {totalMarketing3 > 0 && (
                  <div
                    className="h-full transition-all duration-300 hover:opacity-90"
                    style={{ width: `${(totalMarketing3 / totalExpenses) * 100}%`, backgroundColor: '#a855f7' }}
                    title={`سيستم 3: ${((totalMarketing3 / totalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
                {totalTransfers > 0 && (
                  <div
                    style={{ width: `${(totalTransfers / totalExpenses) * 100}%` }}
                    className="bg-pink-500 h-full transition-all duration-300 hover:opacity-90"
                    title={`تحويلات: ${((totalTransfers / totalExpenses) * 100).toFixed(1)}%`}
                  />
                )}
              </div>

              {/* Legends & Details */}
              <div className="space-y-3">
                {/* Personal Expenses */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-blue-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-brand-dim">مصروف شخصي</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{totalPersonal.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((totalPersonal / totalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Sys 1 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: '#818cf8' }} />
                    <span className="text-xs font-semibold text-brand-dim">ماركتنج 1 (Sys 1)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{totalMarketing1.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((totalMarketing1 / totalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Sys 2 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
                    <span className="text-xs font-semibold text-brand-dim">ماركتنج 2 (Sys 2)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{totalMarketing2.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((totalMarketing2 / totalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Sys 3 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: '#a855f7' }} />
                    <span className="text-xs font-semibold text-brand-dim">ماركتنج 3 (Sys 3)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{totalMarketing3.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((totalMarketing3 / totalExpenses) * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Outgoing transfers */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-md bg-pink-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-brand-dim">تحويل عهدة لزميل</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-extrabold text-white">{totalTransfers.toLocaleString('en-US')} ج.م</span>
                    <span className="text-[9px] text-brand-dim mr-1.5">({((totalTransfers / totalExpenses) * 100).toFixed(1)}%)</span>
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
