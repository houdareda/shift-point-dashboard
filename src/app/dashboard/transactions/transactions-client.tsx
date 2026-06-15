'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  History,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  X,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react'

// Interfaces
interface MoneyRequestItem {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  request_date: string
  created_at: string
  agent_id: string
  wallet?: {
    phone_number: string
  } | null
}

interface TransferItem {
  target_agent_id: string
  amount: number
}

interface DailyReportItem {
  id: string
  report_date: string
  personal_expenses: number
  marketing_1_expenses: number
  marketing_2_expenses: number
  marketing_3_expenses: number
  transfers: TransferItem[] | null
  agent_id: string
}

const STATUS_MAP = {
  pending: { label: 'معلق', icon: Clock, color: 'text-amber-400 bg-amber-400/10 border-amber-500/20' },
  approved: { label: 'تمت الموافقة', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rejected: { label: 'مرفوض', icon: XCircle, color: 'text-red-400 bg-red-400/10 border-red-500/20' },
}

export default function TransactionsClient() {
  const [userId, setUserId] = useState<string | null>(null)
  const [isManager, setIsManager] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Data states
  const [moneyRequests, setMoneyRequests] = useState<MoneyRequestItem[]>([])
  const [dailyReports, setDailyReports] = useState<DailyReportItem[]>([])
  const [agentNameMap, setAgentNameMap] = useState<Record<string, string>>({})
  const [profilesList, setProfilesList] = useState<{ id: string; full_name: string }[]>([])

  // UI state
  const [activeTab, setActiveTab] = useState<'requests' | 'reports'>('requests')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null)

  // Fetch all transactions and profiles data
  const fetchData = async (uid: string, managerRole: boolean) => {
    const supabase = createClient()
    try {
      // 1. Fetch profiles mapping
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, full_name')
      
      if (profilesErr) {
        console.error('Error fetching profiles:', {
          message: profilesErr.message,
          details: profilesErr.details,
          hint: profilesErr.hint,
          code: profilesErr.code,
        })
        throw profilesErr
      }
      
      const nameMap: Record<string, string> = {}
      if (profiles) {
        profiles.forEach((p) => {
          nameMap[p.id] = p.full_name
        })
      }
      setAgentNameMap(nameMap)
      setProfilesList(profiles || [])

      // 2. Fetch Money Requests
      let requestsQuery = supabase
        .from('money_requests')
        .select('id, amount, status, request_date, created_at, agent_id, wallet:wallets(phone_number)')
      
      if (!managerRole) {
        requestsQuery = requestsQuery.eq('agent_id', uid)
      }
      
      const { data: requests, error: requestsErr } = await requestsQuery
        .order('created_at', { ascending: false })

      if (requestsErr) {
        console.error('Error fetching money requests:', {
          message: requestsErr.message,
          details: requestsErr.details,
          hint: requestsErr.hint,
          code: requestsErr.code,
        })
        throw requestsErr
      }
      setMoneyRequests((requests as unknown as MoneyRequestItem[]) || [])

      // 3. Fetch Daily Reports
      let reportsQuery = supabase
        .from('daily_reports')
        .select('id, report_date, personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, transfers, agent_id')
      
      if (!managerRole) {
        reportsQuery = reportsQuery.eq('agent_id', uid)
      }

      const { data: reports, error: reportsErr } = await reportsQuery
        .order('report_date', { ascending: false })

      if (reportsErr) {
        console.error('Error fetching daily reports:', {
          message: reportsErr.message,
          details: reportsErr.details,
          hint: reportsErr.hint,
          code: reportsErr.code,
        })
        throw reportsErr
      }
      setDailyReports((reports as unknown as DailyReportItem[]) || [])

    } catch (err: unknown) {
      console.error('Error fetching transactions history caught:', err)
      const errMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل سجل العمليات.'
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  // Effect to authenticate and trigger fetch
  useEffect(() => {
    const supabase = createClient()
    const checkUserAndRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        
        // Fetch current user's profile to inspect role permissions
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        const role = profile?.role?.toLowerCase() || 'agent'
        const manager = ['admin', 'owner', 'leader', 'accountant'].includes(role)
        setIsManager(manager)
        
        fetchData(user.id, manager)
      } else {
        setLoading(false)
      }
    }
    checkUserAndRole()
  }, [])

  // Setup Real-time updates subscription depending on user role permissions
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const moneyFilter = isManager ? {} : { filter: `agent_id=eq.${userId}` }
    const reportsFilter = isManager ? {} : { filter: `agent_id=eq.${userId}` }

    const moneyChannel = supabase
      .channel('tx-history-money-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'money_requests', ...moneyFilter },
        () => { fetchData(userId, isManager) }
      )
      .subscribe()

    const reportsChannel = supabase
      .channel('tx-history-daily-reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_reports', ...reportsFilter },
        () => { fetchData(userId, isManager) }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(moneyChannel)
      supabase.removeChannel(reportsChannel)
    }
  }, [userId, isManager])

  // Clear filters handler
  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setStatusFilter('all')
    setAgentFilter('all')
  }

  // Date Formatting Helpers
  const formatDateArabic = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ar-EG-u-nu-latn', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTimeArabic = (dateTimeStr: string) => {
    if (!dateTimeStr) return '-'
    return new Date(dateTimeStr).toLocaleDateString('ar-EG-u-nu-latn', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filtering Logic
  const filteredMoneyRequests = moneyRequests.filter((item) => {
    // Date filter check
    if (startDate && item.request_date < startDate) return false
    if (endDate && item.request_date > endDate) return false
    // Status filter check
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    // Agent filter check (Managers only)
    if (isManager && agentFilter !== 'all' && item.agent_id !== agentFilter) return false
    return true
  })

  const filteredDailyReports = dailyReports.filter((item) => {
    // Date filter check
    if (startDate && item.report_date < startDate) return false
    if (endDate && item.report_date > endDate) return false
    // Agent filter check (Managers only)
    if (isManager && agentFilter !== 'all' && item.agent_id !== agentFilter) return false
    return true
  })

  // Calculate sum of transfers in report
  const calculateTransfersSum = (transfers: TransferItem[] | null) => {
    if (!transfers || !Array.isArray(transfers)) return 0
    return transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0)
  }

  return (
    <div className="space-y-6 w-full max-w-none relative z-10 animate-fade-in text-right">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <History className="h-7 w-7 text-brand-accent animate-pulse" />
            <span>سجل العمليات</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            {isManager 
              ? 'متابعة وتصفية كافة طلبات شحن الرصيد وتقارير المصاريف والتحويلات اليومية المرفوعة من جميع الموظفين.' 
              : 'استعرض كافة طلبات شحن الرصيد وتقارير المصاريف والتحويلات اليومية التي قمت برفعها، مع إمكانيات تصفية دقيقة.'}
          </p>
        </div>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Filters and Tabs Control Bar */}
        <div className="p-5 rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl flex flex-col gap-4 shadow-md">
          {/* Row 1: Tabs and Reset Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Page Tabs */}
            <div className="flex gap-2.5 p-1 rounded-xl bg-white/[0.01] border border-brand-border w-fit">
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'requests'
                    ? 'text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                    : 'text-brand-dim hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                طلبات الأموال (Money Requests)
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === 'reports'
                    ? 'text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                    : 'text-brand-dim hover:text-white hover:bg-white/[0.02]'
                }`}
              >
                المصاريف والتحويلات (Expenses & Transfers)
              </button>
            </div>

            {/* Clear Filters Button */}
            {(startDate || endDate || statusFilter !== 'all' || agentFilter !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-bold text-white bg-white/5 border border-brand-border hover:bg-brand-error/10 hover:border-brand-error/20 hover:text-red-400 transition-all duration-300 cursor-pointer w-fit"
              >
                <X className="h-4 w-4" />
                <span>مسح الفلاتر</span>
              </button>
            )}
          </div>

          {/* Row 2: Filters Fields */}
          <div className={`grid grid-cols-1 ${isManager ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4 items-end`}>
            
            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-brand-dim">من تاريخ</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-2.5 pl-4 pr-10 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs dir-ltr text-left"
                />
                <Calendar className="absolute inset-y-0 right-3 my-auto h-4 w-4 text-white/30" />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-brand-dim">إلى تاريخ</label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-2.5 pl-4 pr-10 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs dir-ltr text-left"
                />
                <Calendar className="absolute inset-y-0 right-3 my-auto h-4 w-4 text-white/30" />
              </div>
            </div>

            {/* Status Filter (Only shown when requests tab is active) */}
            <div className={`space-y-1.5 transition-opacity duration-300 ${activeTab === 'requests' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <label className="block text-[11px] font-bold text-brand-dim">الحالة</label>
              <div className="relative">
                <select
                  value={statusFilter}
                  disabled={activeTab !== 'requests'}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full rounded-xl bg-brand-bg border border-white/[0.08] py-2.5 pl-4 pr-10 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs appearance-none"
                >
                  <option value="all">الكل</option>
                  <option value="pending">معلق (Pending)</option>
                  <option value="approved">مقبول (Approved)</option>
                  <option value="rejected">مرفوض (Rejected)</option>
                </select>
                <Filter className="absolute inset-y-0 right-3 my-auto h-4 w-4 text-white/30 pointer-events-none" />
              </div>
            </div>

            {/* Agent Filter (Only shown for managers: admin, owner, leader, accountant) */}
            {isManager && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-brand-dim">الموظف (Agent)</label>
                <div className="relative">
                  <select
                    value={agentFilter}
                    onChange={(e) => setAgentFilter(e.target.value)}
                    className="block w-full rounded-xl bg-brand-bg border border-white/[0.08] py-2.5 pl-4 pr-10 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs appearance-none"
                  >
                    <option value="all">الكل</option>
                    {profilesList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                  <User className="absolute inset-y-0 right-3 my-auto h-4 w-4 text-white/30 pointer-events-none" />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Data Output Tables */}
        <div className="rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden min-h-[400px]">
          {/* Decorative blur circle */}
          <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

          {/* Loading Skeletons */}
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex flex-col gap-3 p-4.5 rounded-2xl bg-white/[0.01] border border-white/[0.04] animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-28 bg-white/10 rounded-md" />
                    <div className="h-5 w-16 bg-white/10 rounded-full" />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="h-3.5 w-44 bg-white/5 rounded-md" />
                    <div className="h-3.5 w-20 bg-white/5 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-20 text-center max-w-lg mx-auto">
              <XCircle className="h-12 w-12 text-brand-error mb-4 animate-bounce" />
              <h4 className="text-base font-bold text-white mb-2">فشل جلب سجل العمليات</h4>
              <p className="text-xs text-brand-dim leading-relaxed mb-5">{error}</p>
              <button
                onClick={() => userId && fetchData(userId, isManager)}
                className="px-5 py-2.5 text-xs font-bold text-white bg-white/5 border border-brand-border hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && (
            (activeTab === 'requests' && filteredMoneyRequests.length === 0) || 
            (activeTab === 'reports' && filteredDailyReports.length === 0)
          ) && (
            <div className="flex flex-col items-center justify-center py-24 text-center text-brand-dim">
              <History className="h-12 w-12 opacity-25 mb-4 animate-pulse" />
              <span className="text-sm font-semibold text-white mb-1">لا توجد عمليات مطابقة</span>
              <span className="text-xs max-w-xs leading-relaxed">لم يتم العثور على أي بيانات مسجلة مطابقة للفلاتر أو التاريخ المختار.</span>
            </div>
          )}

          {/* TAB 1: Money Requests Table */}
          {!loading && !error && activeTab === 'requests' && filteredMoneyRequests.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.04] bg-white/[0.005]">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-brand-border bg-white/[0.01] text-xs text-brand-dim">
                    {isManager && <th className="px-6 py-4.5 font-bold">الموظف</th>}
                    <th className="px-6 py-4.5 font-bold">تاريخ الطلب</th>
                    <th className="px-6 py-4.5 font-bold">المحفظة المستهدفة</th>
                    <th className="px-6 py-4.5 font-bold">المبلغ المطلوب</th>
                    <th className="px-6 py-4.5 font-bold">الحالة</th>
                    <th className="px-6 py-4.5 font-bold">تاريخ التحديث</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-xs">
                  {filteredMoneyRequests.map((req) => {
                    const statusConfig = STATUS_MAP[req.status] || STATUS_MAP.pending
                    const StatusIcon = statusConfig.icon
                    const agentName = agentNameMap[req.agent_id] || 'موظف غير معروف'

                    return (
                      <tr key={req.id} className="hover:bg-white/[0.01] transition-colors group">
                        {/* Agent Name (Manager only) */}
                        {isManager && (
                          <td className="px-6 py-4.5 font-semibold text-white group-hover:text-brand-accent transition-colors">
                            {agentName}
                          </td>
                        )}

                        {/* Request Date */}
                        <td className="px-6 py-4.5 text-white/95 font-semibold flex items-center gap-2 justify-end">
                          <span>{formatDateArabic(req.request_date)}</span>
                          <Calendar className="h-4 w-4 text-brand-dim" />
                        </td>

                        {/* Wallet number */}
                        <td className="px-6 py-4.5 font-mono text-white/90 text-left dir-ltr">
                          {req.wallet?.phone_number || 'محفظة غير معروفة'}
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4.5 font-bold text-white font-mono">
                          {Number(req.amount).toLocaleString('en-US')} ج.م
                        </td>

                        {/* Status badge */}
                        <td className="px-6 py-4.5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${statusConfig.color}`}>
                            <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                            {statusConfig.label}
                          </span>
                        </td>

                        {/* Updated at timestamp */}
                        <td className="px-6 py-4.5 text-brand-dim">
                          {formatDateTimeArabic(req.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Daily Reports Table */}
          {!loading && !error && activeTab === 'reports' && filteredDailyReports.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.04] bg-white/[0.005]">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-brand-border bg-white/[0.01] text-xs text-brand-dim">
                    {isManager && <th className="px-6 py-4.5 font-bold">الموظف</th>}
                    <th className="px-6 py-4.5 font-bold">تاريخ التقرير</th>
                    <th className="px-6 py-4.5 font-bold">مصاريف شخصية</th>
                    <th className="px-6 py-4.5 font-bold">تسويق 1</th>
                    <th className="px-6 py-4.5 font-bold">تسويق 2</th>
                    <th className="px-6 py-4.5 font-bold">تسويق 3</th>
                    <th className="px-6 py-4.5 font-bold">إجمالي التحويلات</th>
                    <th className="px-6 py-4.5 font-bold">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-xs">
                  {filteredDailyReports.map((report) => {
                    const transfersCount = report.transfers?.length || 0
                    const transfersSum = calculateTransfersSum(report.transfers)
                    const isExpanded = expandedReportId === report.id
                    const agentName = agentNameMap[report.agent_id] || 'موظف غير معروف'

                    return (
                      <>
                        <tr key={report.id} className="hover:bg-white/[0.01] transition-colors group">
                          {/* Agent Name (Manager only) */}
                          {isManager && (
                            <td className="px-6 py-4.5 font-semibold text-white group-hover:text-brand-accent transition-colors">
                              {agentName}
                            </td>
                          )}

                          {/* Report Date */}
                          <td className="px-6 py-4.5 text-white/95 font-semibold flex items-center gap-2 justify-end">
                            <span>{formatDateArabic(report.report_date)}</span>
                            <Calendar className="h-4 w-4 text-brand-dim" />
                          </td>

                          {/* Personal Expenses */}
                          <td className="px-6 py-4.5 font-mono text-white/80">
                            {Number(report.personal_expenses).toLocaleString('en-US')} ج.م
                          </td>

                          {/* Marketing 1 */}
                          <td className="px-6 py-4.5 font-mono text-white/80">
                            {Number(report.marketing_1_expenses).toLocaleString('en-US')} ج.م
                          </td>

                          {/* Marketing 2 */}
                          <td className="px-6 py-4.5 font-mono text-white/80">
                            {Number(report.marketing_2_expenses).toLocaleString('en-US')} ج.م
                          </td>

                          {/* Marketing 3 */}
                          <td className="px-6 py-4.5 font-mono text-white/80">
                            {Number(report.marketing_3_expenses).toLocaleString('en-US')} ج.م
                          </td>

                          {/* Total Transfers sum */}
                          <td className="px-6 py-4.5 font-mono text-brand-accent font-bold">
                            {transfersSum.toLocaleString('en-US')} ج.م
                            {transfersCount > 0 && (
                              <span className="text-[10px] text-brand-dim mr-1 bg-white/[0.04] px-1.5 py-0.5 rounded-full font-sans">
                                ({transfersCount} تحويل)
                              </span>
                            )}
                          </td>

                          {/* Action expand toggle */}
                          <td className="px-6 py-4.5">
                            {transfersCount > 0 ? (
                              <button
                                onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                className="flex items-center gap-1 text-brand-accent hover:text-white transition-colors cursor-pointer"
                              >
                                <span>{isExpanded ? 'إخفاء' : 'عرض'}</span>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            ) : (
                              <span className="text-white/20">-</span>
                            )}
                          </td>
                        </tr>

                        {/* Expander Transfers Detail Row */}
                        {isExpanded && transfersCount > 0 && report.transfers && (
                          <tr className="bg-white/[0.005] border-t border-white/[0.02]">
                            <td colSpan={isManager ? 8 : 7} className="px-8 py-4 text-right">
                              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.04] space-y-2">
                                <h4 className="text-[11px] font-bold text-brand-accent mb-2">تفاصيل التحويلات الداخلية:</h4>
                                <ul className="space-y-1.5 text-xs text-brand-dim list-inside text-right">
                                  {report.transfers.map((item, idx) => {
                                    const recipientName = agentNameMap[item.target_agent_id] || 'موظف غير معروف'
                                    return (
                                      <li key={idx} className="flex items-center justify-start gap-2 text-white/90">
                                        <ArrowUpRight className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                                        <span>تحويل بمبلغ </span>
                                        <strong className="text-white font-mono">{Number(item.amount).toLocaleString('en-US')} ج.م</strong>
                                        <span> إلى: </span>
                                        <strong className="text-brand-accent">{recipientName}</strong>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
