'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Receipt,
  Wallet,
  ChevronDown,
  Check,
  X,
  BarChart3,
  ShieldAlert
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

interface AgentProfile {
  id: string
  full_name: string | null
}

interface AdminDashboardClientProps {
  agents: AgentProfile[]
  initialWallets: WalletItem[]
  initialReports: ReportItem[]
  profileName: string
  userRole: string
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
  profileName,
  userRole,
}: AdminDashboardClientProps) {
  const [wallets, setWallets] = useState<WalletItem[]>(initialWallets)
  const [reports, setReports] = useState<ReportItem[]>(initialReports)

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    return () => {
      supabase.removeChannel(walletsChannel)
      supabase.removeChannel(reportsChannel)
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
        const next = prev.filter((id) => id !== agentId)
        return next
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
  const filteredWallets = wallets.filter((w) => {
    if (isAgentFiltered) {
      return selectedAgents.includes(w.agent_id)
    }
    return true
  })

  const filteredReports = reports.filter((r) => {
    const isWithinDate = r.report_date >= startDate && r.report_date <= endDate
    if (!isWithinDate) return false
    if (isAgentFiltered) {
      return selectedAgents.includes(r.agent_id)
    }
    return true
  })

  // Calculations
  const activeWallets = filteredWallets.filter((w) => w.is_active !== false)
  const totalWalletBalance = activeWallets.reduce((acc, curr) => acc + (curr.current_balance || 0), 0)

  let totalPersonal = 0
  let totalMarketing1 = 0
  let totalMarketing2 = 0
  let totalMarketing3 = 0
  let totalTransfers = 0

  filteredReports.forEach((rep) => {
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

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Welcome & Dashboard header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <BarChart3 className="h-7 w-7 text-brand-accent animate-pulse" />
            <span>لوحة التحكم الإدارية (God Mode Overview)</span>
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
            <span>خيارات التصفية والبحث</span>
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

      {/* Aggregated Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Total Expenses */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 md:p-8 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
          <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-border text-brand-accent group-hover:scale-105 transition-transform duration-300">
              <Receipt className="h-6 w-6" />
            </div>
            <span className="text-xs font-semibold text-brand-dim">إجمالي مصاريف الفترة المحددة</span>
          </div>

          <h3 className="text-sm font-medium text-brand-dim">إجمالي المصروفات</h3>

          {isCalculating ? (
            <div className="mt-2 space-y-2">
              <div className="h-8 w-36 bg-white/5 rounded-lg animate-pulse" />
              <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {totalExpenses.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim">ج.م</span>
              </p>
              <p className="mt-1 text-xs text-brand-dim/80">
                من تاريخ {new Date(startDate).toLocaleDateString('ar-EG')} إلى {new Date(endDate).toLocaleDateString('ar-EG')}
              </p>
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
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    ماركتنج 1 (Sys 1)
                  </span>
                </div>

                {/* Marketing 2 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
                  <span className="text-sm font-bold text-white font-mono">
                    {totalMarketing2.toLocaleString('en-US')} ج.م
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-purple-400 bg-purple-400/10 border-purple-500/20">
                    ماركتنج 2 (Sys 2)
                  </span>
                </div>

                {/* Marketing 3 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all">
                  <span className="text-sm font-bold text-white font-mono">
                    {totalMarketing3.toLocaleString('en-US')} ج.م
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border text-amber-400 bg-amber-400/10 border-amber-500/20">
                    ماركتنج 3 (Sys 3)
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

        {/* Card 2: Cash in Wallet */}
        <div className="group relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 md:p-8 hover:border-brand-accent/30 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.06)] overflow-hidden">
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
              <p className="mt-2 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {totalWalletBalance.toLocaleString('en-US')} <span className="text-xs font-normal text-brand-dim">ج.م</span>
              </p>
              <p className="mt-1 text-xs text-brand-dim/80">
                موزعة على ({activeWallets.length}) محافظ نشطة للموظفين المحددين
              </p>
            </>
          )}

          {/* Divider */}
          <div className="my-5 border-t border-brand-border/60" />

          {/* Breakdown List */}
          <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
            {isCalculating ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03]">
                  <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
                  <div className="h-4.5 w-16 bg-white/5 rounded-full animate-pulse" />
                </div>
              ))
            ) : activeWallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-brand-dim">
                <ShieldAlert className="h-8 w-8 opacity-40 mb-2" />
                <span className="text-xs">لا توجد محافظ نشطة للموظفين المحددين</span>
              </div>
            ) : (
              activeWallets.map((wallet, index) => {
                const colorClass = WALLET_COLORS[index % WALLET_COLORS.length]
                const last4Digits = wallet.phone_number ? wallet.phone_number.slice(-4) : 'غير معروف'
                const agentProfile = agents.find((a) => a.id === wallet.agent_id)
                const agentName = agentProfile?.full_name || 'موظف'
                return (
                  <div
                    key={wallet.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.08] transition-all"
                  >
                    <span className="text-sm font-bold text-white font-mono">
                      {Number(wallet.current_balance || 0).toLocaleString('en-US')} ج.م
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}>
                      {agentName} (..{last4Digits})
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
