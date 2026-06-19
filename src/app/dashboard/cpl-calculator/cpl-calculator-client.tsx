'use client'

import React, { useState, useMemo, useTransition, useEffect } from 'react'
import { saveCplReportAction, updateCplReportAction } from '@/app/actions/cpl'
import {
  Calculator,
  History,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  Coins,
  ShieldCheck,
  Smartphone,
  Edit,
  User,
  Filter
} from 'lucide-react'

interface WalletDetail {
  phone: string
  amount: number
}

interface CplReport {
  id: string
  user_id: string
  report_date: string
  total_cash: number
  personal_expenses: number
  recipient_money: number
  campaign_money: number
  sys1_amount: number
  sys2_amount: number
  sys3_amount: number
  sys1_count?: number
  sys2_count?: number
  sys3_count?: number
  sys1_cpl?: number
  sys2_cpl?: number
  sys3_cpl?: number
  total_leads: number
  wallets_details: any // can be array or object
  calc_total_expenses: number
  calc_total_wallets: number
  calc_remaining_cash: number
  created_at: string
  agent?: {
    id: string
    full_name: string
    role: string
  }
}

interface ActiveWallet {
  id: string
  phone_number: string
  current_balance: number
}

interface CplCalculatorClientProps {
  initialReports: any[]
  profileName: string
  activeWallets: ActiveWallet[]
  latestReport: CplReport | null
  userRole: string
  allAgents: { id: string; full_name: string; role: string }[]
}

export default function CplCalculatorClient({
  initialReports,
  profileName,
  activeWallets,
  latestReport,
  userRole,
  allAgents
}: CplCalculatorClientProps) {
  const [activeTab, setActiveTab] = useState<'new-entry' | 'edit-report' | 'history'>('new-entry')
  const [reports, setReports] = useState<CplReport[]>(initialReports as CplReport[])
  const [filterDate, setFilterDate] = useState<string>('')
  const [isPending, startSaveTransition] = useTransition()
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [editReportDate, setEditReportDate] = useState<string>('')

  // --- Admin/Owner God Mode states & calculations ---
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner'
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [adminStartDate, setAdminStartDate] = useState<string>('')
  const [adminEndDate, setAdminEndDate] = useState<string>('')

  // Filter agents list to show only agents
  const agentsList = useMemo(() => {
    return allAgents ? allAgents.filter((agent) => agent.role === 'agent') : []
  }, [allAgents])

  // Filtered reports for admin view
  const adminFilteredReports = useMemo(() => {
    if (!isAdminOrOwner) return []
    return reports.filter((report) => {
      // 1. Filter by agent
      if (selectedAgent && report.user_id !== selectedAgent) {
        return false
      }
      // 2. Filter by date range
      if (adminStartDate && report.report_date < adminStartDate) {
        return false
      }
      if (adminEndDate && report.report_date > adminEndDate) {
        return false
      }
      return true
    })
  }, [reports, selectedAgent, adminStartDate, adminEndDate, isAdminOrOwner])

  // Stats calculation for admin view
  const adminStats = useMemo(() => {
    if (!isAdminOrOwner) {
      return { totalExpenses: 0, totalLeads: 0, averageCpl: 0 }
    }
    let totalExpenses = 0
    let totalLeads = 0
    let totalMarketingAmount = 0
    adminFilteredReports.forEach((report) => {
      totalExpenses += report.calc_total_expenses || 0
      totalLeads += report.total_leads || 0
      totalMarketingAmount +=
        (report.sys1_amount || 0) + (report.sys2_amount || 0) + (report.sys3_amount || 0)
    })
    const averageCpl = totalLeads > 0 ? totalMarketingAmount / totalLeads : 0
    return {
      totalExpenses,
      totalLeads,
      averageCpl
    }
  }, [adminFilteredReports, isAdminOrOwner])

  const filteredReports = useMemo(() => {
    if (!filterDate) return reports
    return reports.filter((r) => r.report_date === filterDate)
  }, [reports, filterDate])

  // --- Date setup ---
  const tzOffset = new Date().getTimezoneOffset() * 60000
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
  const yesterdayLocal = new Date(Date.now() - tzOffset - 86400000).toISOString().split('T')[0]
  const [reportDate, setReportDate] = useState(todayLocal)

  // --- Smart Defaults / Sticky Defaults Initialization ---
  const savedDetails = latestReport?.wallets_details as any

  const [totalCash, setTotalCash] = useState(
    latestReport ? String(latestReport.total_cash) : ''
  )
  const [personalExpenses, setPersonalExpenses] = useState(
    latestReport ? String(latestReport.personal_expenses) : ''
  )
  const [recipientMoney, setRecipientMoney] = useState(
    latestReport ? String(latestReport.recipient_money) : ''
  )
  const [campaignMoney, setCampaignMoney] = useState(
    latestReport ? String(latestReport.campaign_money) : ''
  )
  const [sys2Amount, setSys2Amount] = useState(
    latestReport?.sys2_amount !== undefined && latestReport?.sys2_amount !== null ? String(latestReport.sys2_amount) : ''
  )
  const [sys3Amount, setSys3Amount] = useState(
    latestReport?.sys3_amount !== undefined && latestReport?.sys3_amount !== null ? String(latestReport.sys3_amount) : ''
  )

  // Counts (D9, D10, D11)
  const [sys1Count, setSys1Count] = useState(
    latestReport?.sys1_count !== undefined && latestReport?.sys1_count !== null ? String(latestReport.sys1_count) : ''
  )
  const [sys2Count, setSys2Count] = useState(
    latestReport?.sys2_count !== undefined && latestReport?.sys2_count !== null ? String(latestReport.sys2_count) : ''
  )
  const [sys3Count, setSys3Count] = useState(
    latestReport?.sys3_count !== undefined && latestReport?.sys3_count !== null ? String(latestReport.sys3_count) : ''
  )

  // Map active wallets and resolve initial amount values from sticky latestReport
  const [walletAmounts, setWalletAmounts] = useState<Record<string, string>>(() => {
    const initialAmounts: Record<string, string> = {}
    activeWallets.forEach((w) => {
      let savedAmount = '0'
      if (savedDetails) {
        let savedWalletsList: any[] = []
        if (Array.isArray(savedDetails)) {
          savedWalletsList = savedDetails
        } else if (Array.isArray(savedDetails.wallets)) {
          savedWalletsList = savedDetails.wallets
        }
        const match = savedWalletsList.find((sw: any) => sw.phone === w.phone_number)
        if (match) {
          savedAmount = String(match.amount)
        }
      }
      initialAmounts[w.phone_number] = savedAmount
    })
    return initialAmounts
  })

  // --- UI Toast & Message States ---
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({
    show: false,
    message: '',
    type: 'success'
  })
  const [formError, setFormError] = useState('')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  // Sync reports
  useEffect(() => {
    setReports(initialReports as CplReport[])
  }, [initialReports])

  const triggerToast = (message: string, type: 'success' | 'error') => {
    setToast({
      show: true,
      message,
      type
    })
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }))
    }, 5000)
  }

  // --- Real-time Reactive Mathematics (useMemo) ---
  const math = useMemo(() => {
    const B2 = parseFloat(totalCash) || 0
    const B5 = parseFloat(personalExpenses) || 0
    const B6 = parseFloat(recipientMoney) || 0
    const B7 = parseFloat(campaignMoney) || 0
    const B10 = parseFloat(sys2Amount) || 0
    const B11 = parseFloat(sys3Amount) || 0

    // Product Counts
    const D9 = parseInt(sys1Count) || 0
    const D10 = parseInt(sys2Count) || 0
    const D11 = parseInt(sys3Count) || 0

    // Sum Wallets Array Amounts
    const sumWallets = activeWallets.reduce(
      (sum, w) => sum + (parseFloat(walletAmounts[w.phone_number]) || 0),
      0
    )

    // Equations
    const B3 = B2 - B5 - B6 // Cash after transfers/personal
    const B13 = sumWallets + B7 // Total cash in wallets + campaign
    const B9 = B3 - B10 - B11 - B13 - B7 // Sys 1 amount spent
    const B4 = B5 + B6 + B9 + B10 + B11 // Total expenses
    const B14 = B2 - B4 - B7 // Remaining final cash
    const B12 = D9 + D10 + D11 // Total leads

    // CPL calculations (prevent division by zero)
    const C9 = D9 > 0 ? (B9 / D9).toFixed(2) : 'Add count First'
    const C10 = D10 > 0 ? (B10 / D10).toFixed(2) : 'Add count First'
    const C11 = D11 > 0 ? (B11 / D11).toFixed(2) : 'Add count First'

    return {
      B3,
      B13,
      B9,
      B4,
      B14,
      B12,
      C9,
      C10,
      C11,
      D9,
      D10,
      D11
    }
  }, [
    totalCash,
    personalExpenses,
    recipientMoney,
    campaignMoney,
    sys2Amount,
    sys3Amount,
    sys1Count,
    sys2Count,
    sys3Count,
    walletAmounts,
    activeWallets
  ])

  const handleWalletAmountChange = (phone: string, val: string) => {
    setWalletAmounts((prev) => ({
      ...prev,
      [phone]: val
    }))
  }

  // Populate form with specific report values
  const populateFormWithReport = (report: CplReport | null) => {
    if (report) {
      setTotalCash(String(report.total_cash))
      setPersonalExpenses(String(report.personal_expenses))
      setRecipientMoney(String(report.recipient_money))
      setCampaignMoney(String(report.campaign_money))
      setSys2Amount(String(report.sys2_amount))
      setSys3Amount(String(report.sys3_amount))
      setSys1Count(String(report.sys1_count ?? ''))
      setSys2Count(String(report.sys2_count ?? ''))
      setSys3Count(String(report.sys3_count ?? ''))

      const details = report.wallets_details
      const amounts: Record<string, string> = {}
      activeWallets.forEach((w) => {
        let amt = '0'
        if (details) {
          let list: any[] = []
          if (Array.isArray(details)) {
            list = details
          } else if (Array.isArray(details.wallets)) {
            list = details.wallets
          }
          const match = list.find((sw: any) => sw.phone === w.phone_number)
          if (match) {
            amt = String(match.amount)
          }
        }
        amounts[w.phone_number] = amt
      })
      setWalletAmounts(amounts)
    } else {
      setTotalCash('')
      setPersonalExpenses('')
      setRecipientMoney('')
      setCampaignMoney('')
      setSys2Amount('')
      setSys3Amount('')
      setSys1Count('')
      setSys2Count('')
      setSys3Count('')
      const defaultAmounts: Record<string, string> = {}
      activeWallets.forEach((w) => {
        defaultAmounts[w.phone_number] = '0'
      })
      setWalletAmounts(defaultAmounts)
    }
  }

  // Load sticky defaults on mount or when switching tabs
  const loadStickyDefaults = () => {
    if (latestReport) {
      setTotalCash(String(latestReport.total_cash))
      setPersonalExpenses(String(latestReport.personal_expenses))
      setRecipientMoney(String(latestReport.recipient_money))
      setCampaignMoney(String(latestReport.campaign_money))
      setSys2Amount(String(latestReport.sys2_amount))
      setSys3Amount(String(latestReport.sys3_amount))
      setSys1Count(String(latestReport.sys1_count ?? ''))
      setSys2Count(String(latestReport.sys2_count ?? ''))
      setSys3Count(String(latestReport.sys3_count ?? ''))

      const details = latestReport.wallets_details
      const amounts: Record<string, string> = {}
      activeWallets.forEach((w) => {
        let amt = '0'
        if (details) {
          let list: any[] = []
          if (Array.isArray(details)) {
            list = details
          } else if (Array.isArray(details.wallets)) {
            list = details.wallets
          }
          const match = list.find((sw: any) => sw.phone === w.phone_number)
          if (match) {
            amt = String(match.amount)
          }
        }
        amounts[w.phone_number] = amt
      })
      setWalletAmounts(amounts)
    } else {
      populateFormWithReport(null)
    }
  }

  useEffect(() => {
    if (activeTab === 'new-entry') {
      loadStickyDefaults()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'edit-report') {
      const match = reports.find((r) => r.report_date === editReportDate)
      populateFormWithReport(match || null)
    }
  }, [editReportDate, activeTab, reports])

  // --- Save / Update Report Trigger ---
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const dateToValidate = activeTab === 'new-entry' ? reportDate : editReportDate

    if (!dateToValidate) {
      setFormError('يرجى اختيار تاريخ التقرير.')
      return
    }

    if (dateToValidate !== todayLocal && dateToValidate !== yesterdayLocal) {
      setFormError('مسموح فقط باختيار تاريخ اليوم أو الأمس.')
      return
    }

    if (activeTab === 'new-entry') {
      const isDuplicate = reports.some((r) => r.report_date === dateToValidate)
      if (isDuplicate) {
        setFormError('يوجد تقرير مسجل لهذا اليوم بالفعل. يرجى الذهاب لتبويب التعديل.')
        triggerToast('يوجد تقرير مسجل لهذا اليوم بالفعل. يرجى الذهاب لتبويب التعديل.', 'error')
        return
      }
    } else if (activeTab === 'edit-report') {
      const exists = reports.some((r) => r.report_date === dateToValidate)
      if (!exists) {
        setFormError('لا يوجد تقرير مسجل في هذا التاريخ لتعديله.')
        return
      }
    }

    setShowConfirmModal(true)
  }

  const executeSave = async () => {
    setShowConfirmModal(false)
    setFormError('')

    const activeDate = activeTab === 'new-entry' ? reportDate : editReportDate

    // Format wallets as array of phone + amount
    const walletsList = activeWallets.map((w) => ({
      phone: w.phone_number,
      amount: parseFloat(walletAmounts[w.phone_number]) || 0
    }))

    // Pack both wallets and product counts into JSON to support smart defaults reloading
    const walletsDetailsJson = {
      wallets: walletsList,
      sys1_count: math.D9,
      sys2_count: math.D10,
      sys3_count: math.D11
    }

    const formData = new FormData()
    formData.append('date', activeDate)
    formData.append('totalCash', totalCash || '0')
    formData.append('personalExpenses', personalExpenses || '0')
    formData.append('recipientMoney', recipientMoney || '0')
    formData.append('campaignMoney', campaignMoney || '0')
    formData.append('sys2Amount', sys2Amount || '0')
    formData.append('sys3Amount', sys3Amount || '0')
    formData.append('sys1Count', String(math.D9))
    formData.append('sys2Count', String(math.D10))
    formData.append('sys3Count', String(math.D11))
    formData.append('sys1Cpl', String(math.C9 === 'Add count First' ? '0' : math.C9))
    formData.append('sys2Cpl', String(math.C10 === 'Add count First' ? '0' : math.C10))
    formData.append('sys3Cpl', String(math.C11 === 'Add count First' ? '0' : math.C11))
    formData.append('totalLeads', String(math.B12))
    formData.append('wallets', JSON.stringify(walletsDetailsJson))

    startSaveTransition(async () => {
      try {
        const action = activeTab === 'new-entry' ? saveCplReportAction : updateCplReportAction
        const res = await action(null, formData)
        
        if (res.success) {
          const successMessage =
            activeTab === 'new-entry'
              ? 'تم حفظ التقرير بنجاح وتحديث السجل المالي!'
              : 'تم تحديث التقرير بنجاح وتحديث السجل المالي!'
          triggerToast(successMessage, 'success')

          // Update local state to show saved data instantly
          setReports((prev) => {
            const newReportLocal: CplReport = {
              id: Math.random().toString(),
              user_id: '',
              report_date: activeDate,
              total_cash: parseFloat(totalCash) || 0,
              personal_expenses: parseFloat(personalExpenses) || 0,
              recipient_money: parseFloat(recipientMoney) || 0,
              campaign_money: parseFloat(campaignMoney) || 0,
              sys1_amount: math.B9,
              sys2_amount: parseFloat(sys2Amount) || 0,
              sys3_amount: parseFloat(sys3Amount) || 0,
              sys1_count: math.D9,
              sys2_count: math.D10,
              sys3_count: math.D11,
              sys1_cpl: math.C9 === 'Add count First' ? 0 : parseFloat(math.C9),
              sys2_cpl: math.C10 === 'Add count First' ? 0 : parseFloat(math.C10),
              sys3_cpl: math.C11 === 'Add count First' ? 0 : parseFloat(math.C11),
              total_leads: math.B12,
              wallets_details: walletsDetailsJson,
              calc_total_expenses: math.B4,
              calc_total_wallets: math.B13,
              calc_remaining_cash: math.B14,
              created_at: new Date().toISOString()
            }
            const filtered = prev.filter((r) => r.report_date !== activeDate)
            return [newReportLocal, ...filtered].sort(
              (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
            )
          })

          // Clear inputs if it was a New Entry
          if (activeTab === 'new-entry') {
            setTotalCash('')
            setPersonalExpenses('')
            setRecipientMoney('')
            setCampaignMoney('')
            setSys2Amount('')
            setSys3Amount('')
            setSys1Count('')
            setSys2Count('')
            setSys3Count('')
          }
          setActiveTab('history')
        } else {
          setFormError(res.error || 'فشل الحفظ، يرجى مراجعة المدخلات.')
          triggerToast(res.error || 'حدث خطأ أثناء الحفظ.', 'error')
        }
      } catch (err) {
        console.error(err)
        setFormError('حدث خطأ غير متوقع أثناء معالجة الطلب.')
        triggerToast('حدث خطأ غير متوقع.', 'error')
      }
    })
  }

  const toggleRowExpansion = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in pb-12">
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
            <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {isAdminOrOwner ? (
        <>
          {/* Admin Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border text-right">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5">
                <TrendingUp className="h-7 w-7 text-brand-accent animate-pulse" />
                <span>تقارير CPL وإغلاق الكاش للموظفين</span>
              </h1>
              <p className="mt-2 text-sm text-brand-dim leading-relaxed">
                مرحباً {profileName}. لوحة تحكم الإدارة لمراقبة تقارير الكاش وتكلفة العميل (CPL) المرفوعة من قبل الموظفين.
              </p>
            </div>
          </div>

          {/* Admin Filter Bar */}
          <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2 mb-4 text-white font-bold text-sm">
              <Filter className="h-4.5 w-4.5 text-brand-accent" />
              <span>فلاتر التصفية والمراقبة</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Agent selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-dim">اسم الموظف</label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="block w-full rounded-xl bg-brand-bg border border-white/[0.08] py-2.5 px-3 text-white text-sm focus:border-brand-accent focus:outline-none transition-all"
                >
                  <option value="">الكل (جميع الموظفين)</option>
                  {agentsList.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-dim">من تاريخ</label>
                <input
                  type="date"
                  value={adminStartDate}
                  onChange={(e) => setAdminStartDate(e.target.value)}
                  className="block w-full rounded-xl bg-brand-bg border border-white/[0.08] py-2.5 px-3 text-white text-sm focus:border-brand-accent focus:outline-none transition-all font-mono"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-dim">إلى تاريخ</label>
                <input
                  type="date"
                  value={adminEndDate}
                  onChange={(e) => setAdminEndDate(e.target.value)}
                  className="block w-full rounded-xl bg-brand-bg border border-white/[0.08] py-2.5 px-3 text-white text-sm focus:border-brand-accent focus:outline-none transition-all font-mono"
                />
              </div>
            </div>
          </div>

          {/* Admin Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Expenses */}
            <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-brand-dim">إجمالي المصروفات (للفلتر المحدد)</p>
                <p className="text-2xl font-extrabold text-white mt-1.5 font-mono">
                  {adminStats.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                </p>
              </div>
              <div className="p-3 bg-brand-accent/10 rounded-2xl">
                <Coins className="h-6 w-6 text-brand-accent" />
              </div>
            </div>

            {/* Total Leads */}
            <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-brand-dim">إجمالي عدد اللييدات</p>
                <p className="text-2xl font-extrabold text-white mt-1.5 font-mono">
                  {adminStats.totalLeads.toLocaleString('en-US')}
                </p>
              </div>
              <div className="p-3 bg-brand-accent/10 rounded-2xl">
                <User className="h-6 w-6 text-brand-accent" />
              </div>
            </div>

            {/* Average CPL */}
            <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-brand-dim">متوسط تكلفة العميل (Average CPL)</p>
                <p className="text-2xl font-extrabold text-brand-accent mt-1.5 font-mono">
                  {adminStats.averageCpl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                </p>
              </div>
              <div className="p-3 bg-brand-accent/10 rounded-2xl">
                <TrendingUp className="h-6 w-6 text-brand-accent" />
              </div>
            </div>
          </div>

          {/* Admin Table Layout */}
          <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-6">سجل تقارير الموظفين</h3>
            
            {adminFilteredReports.length === 0 ? (
              <div className="text-center py-12 text-brand-dim/50">
                لا توجد تقارير مطابقة للفلاتر المحددة حالياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-brand-border/60 text-xs font-bold text-brand-dim bg-white/[0.01]">
                      <th className="py-4 px-3 text-right">اسم الموظف</th>
                      <th className="py-4 px-3 text-right">التاريخ</th>
                      <th className="py-4 px-3 text-left">إجمالي الكاش المستلم</th>
                      <th className="py-4 px-3 text-left">أرصدة المحافظ</th>
                      <th className="py-4 px-3 text-left">Marketing Sys 1</th>
                      <th className="py-4 px-3 text-left">الكاش المتبقي</th>
                      <th className="py-4 px-3 text-left">إجمالي اللييدات</th>
                      <th className="py-4 px-3 text-center">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-xs font-medium text-white/95">
                    {adminFilteredReports.map((report) => (
                      <React.Fragment key={report.id}>
                        <tr className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-3 text-right font-bold text-brand-accent">
                            {report.agent?.full_name || '—'}
                          </td>
                          <td className="py-4 px-3 text-right font-mono font-semibold">
                            {report.report_date}
                          </td>
                          <td className="py-4 px-3 text-left font-mono font-bold">
                            {report.total_cash.toLocaleString('en-US')} ج.م
                          </td>
                          <td className="py-4 px-3 text-left font-mono text-brand-dim">
                            {report.calc_total_wallets.toLocaleString('en-US')} ج.م
                          </td>
                          <td className="py-4 px-3 text-left font-mono">
                            {report.sys1_amount.toLocaleString('en-US')} ج.م
                          </td>
                          <td className="py-4 px-3 text-left font-mono font-extrabold text-emerald-400">
                            {report.calc_remaining_cash.toLocaleString('en-US')} ج.م
                          </td>
                          <td className="py-4 px-3 text-left font-mono font-bold">
                            {report.total_leads}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <button
                              onClick={() => toggleRowExpansion(report.id)}
                              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-brand-accent/20 border border-white/[0.08] hover:border-brand-accent/30 text-white transition-all cursor-pointer"
                            >
                              {expandedRowId === report.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Details Drawer */}
                        {expandedRowId === report.id && (
                          <tr className="bg-white/[0.01]">
                            <td colSpan={8} className="py-4 px-6 border-b border-brand-border/60">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
                                {/* System CPL Details */}
                                <div className="space-y-2 bg-black/25 p-4 rounded-xl border border-white/[0.04]">
                                  <h4 className="text-xs font-bold text-brand-accent border-b border-white/[0.05] pb-1.5 mb-2">تفاصيل الأنظمة وتكلفة العميل (CPL)</h4>
                                  <div className="flex justify-between text-xs py-1">
                                    <span className="text-brand-dim">Marketing Sys 1:</span>
                                    <span className="font-mono font-bold">{report.sys1_amount.toLocaleString('en-US')} ج.م ({report.sys1_count ?? 0} ليد) [CPL: {report.sys1_cpl ?? 0}]</span>
                                  </div>
                                  <div className="flex justify-between text-xs py-1">
                                    <span className="text-brand-dim">Marketing Sys 2:</span>
                                    <span className="font-mono font-bold">{report.sys2_amount.toLocaleString('en-US')} ج.m ({report.sys2_count ?? 0} ليد) [CPL: {report.sys2_cpl ?? 0}]</span>
                                  </div>
                                  <div className="flex justify-between text-xs py-1">
                                    <span className="text-brand-dim">Marketing Sys 3:</span>
                                    <span className="font-mono font-bold">{report.sys3_amount.toLocaleString('en-US')} ج.م ({report.sys3_count ?? 0} ليد) [CPL: {report.sys3_cpl ?? 0}]</span>
                                  </div>
                                </div>

                                {/* Wallets Breakdown */}
                                <div className="space-y-2 bg-black/25 p-4 rounded-xl border border-white/[0.04]">
                                  <h4 className="text-xs font-bold text-brand-accent border-b border-white/[0.05] pb-1.5 mb-2">تفاصيل أرصدة المحافظ</h4>
                                  {(() => {
                                    const details = report.wallets_details
                                    let list: any[] = []
                                    if (details) {
                                      if (Array.isArray(details)) {
                                        list = details
                                      } else if (Array.isArray(details.wallets)) {
                                        list = details.wallets
                                      }
                                    }
                                    if (list.length === 0) {
                                      return <p className="text-xs text-brand-dim/50">لا توجد تفاصيل محافظ.</p>
                                    }
                                    return list.map((w: any, index: number) => (
                                      <div key={index} className="flex justify-between text-xs py-0.5">
                                        <span className="font-mono text-brand-dim">{w.phone}:</span>
                                        <span className="font-mono font-semibold">{w.amount.toLocaleString('en-US')} ج.م</span>
                                      </div>
                                    ))
                                  })()}
                                </div>

                                {/* Financials details */}
                                <div className="space-y-2 bg-black/25 p-4 rounded-xl border border-white/[0.04]">
                                  <h4 className="text-xs font-bold text-brand-accent border-b border-white/[0.05] pb-1.5 mb-2">حركة المصاريف والتحويلات</h4>
                                  <div className="flex justify-between text-xs py-1">
                                    <span className="text-brand-dim">مصاريف شخصية:</span>
                                    <span className="font-mono">{report.personal_expenses.toLocaleString('en-US')} ج.م</span>
                                  </div>
                                  <div className="flex justify-between text-xs py-1">
                                    <span className="text-brand-dim">تحويلات الزملاء:</span>
                                    <span className="font-mono">{report.recipient_money.toLocaleString('en-US')} ج.م</span>
                                  </div>
                                  <div className="flex justify-between text-xs py-1">
                                    <span className="text-brand-dim">مصاريف الحملة الإعلانية:</span>
                                    <span className="font-mono">{report.campaign_money.toLocaleString('en-US')} ج.م</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Page Header (Agent View) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border text-right">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5">
                <Calculator className="h-7 w-7 text-brand-accent animate-pulse" />
                <span>حسابات الـ CPL وإغلاق الكاش اليومي</span>
              </h1>
              <p className="mt-2 text-sm text-brand-dim leading-relaxed">
                مرحباً {profileName}. أداة الإغلاق المالي اليومي وحساب الـ CPL المباشر بنسق شيت الإكسيل المتكامل.
              </p>
            </div>
          </div>

          {/* Tabs Menu */}
          <div className="flex justify-start border-b border-brand-border/40 gap-1.5 p-1 bg-white/[0.02] border border-white/[0.04] rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('new-entry')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'new-entry'
                  ? 'text-white bg-gradient-to-r from-brand-accent/20 to-brand-accent-dark/5 border border-brand-accent/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                  : 'text-brand-dim hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              <Calculator className="h-4.5 w-4.5" />
              <span>إدخال جديد</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('edit-report')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'edit-report'
                  ? 'text-white bg-gradient-to-r from-brand-accent/20 to-brand-accent-dark/5 border border-brand-accent/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                  : 'text-brand-dim hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              <Edit className="h-4.5 w-4.5" />
              <span>تعديل تقرير</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'history'
                  ? 'text-white bg-gradient-to-r from-brand-accent/20 to-brand-accent-dark/5 border border-brand-accent/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                  : 'text-brand-dim hover:text-white hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              <History className="h-4.5 w-4.5" />
              <span>سجل التقارير اليومية</span>
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {formError && (
              <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-brand-error/10 border border-brand-error/25 text-brand-error text-sm font-bold animate-fade-in">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {activeTab === 'new-entry' && latestReport && (
              <div className="flex items-center gap-2.5 p-3 px-4 rounded-2xl bg-brand-accent/5 border border-brand-accent/10 text-brand-accent text-xs font-semibold w-fit">
                <ShieldCheck className="h-4.5 w-4.5" />
                <span>تم ملء الحقول تلقائياً ببيانات آخر تقرير محفوظ ({latestReport.report_date}) لتوفير الوقت.</span>
              </div>
            )}

            {/* Layout when filling a report (New Entry OR Edit Mode with date loaded) */}
            {(activeTab === 'new-entry' || activeTab === 'edit-report') && (
              <>
                {activeTab === 'edit-report' && (
                  <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-right space-y-4">
                    <h3 className="text-base font-bold text-white">اختر تاريخ التقرير المراد تعديله:</h3>
                    <div className="flex items-center gap-3">
                      <select
                        value={editReportDate}
                        onChange={(e) => setEditReportDate(e.target.value)}
                        className="bg-brand-bg border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition-colors font-mono"
                      >
                        <option value="">-- اختر تاريخاً --</option>
                        {reports.map((r) => (
                          <option key={r.id} value={r.report_date}>
                            {r.report_date}
                          </option>
                        ))}
                      </select>
                      {editReportDate && !reports.some(r => r.report_date === editReportDate) && (
                        <p className="text-xs text-brand-error">لا توجد بيانات مسجلة لهذا التاريخ.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Show inputs fields only when in new-entry, or if editing and a date is selected */}
                {(activeTab === 'new-entry' || (activeTab === 'edit-report' && editReportDate)) ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Financials & Calculator (7 Cols) */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Section 1: Financials */}
                      <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative">
                        <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/[0.04]">
                          <h3 className="text-lg font-bold text-white">1. المالية العامة وحركة الكاش</h3>
                          <div className="flex items-center gap-2 text-brand-dim">
                            <Calendar className="h-4.5 w-4.5 text-brand-accent" />
                            {activeTab === 'new-entry' ? (
                              <input
                                type="date"
                                value={reportDate}
                                min={yesterdayLocal}
                                max={todayLocal}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="bg-brand-bg border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-accent transition-colors font-mono"
                                required
                              />
                            ) : (
                              <span className="font-mono text-sm text-white font-bold">{editReportDate}</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-5">
                          {/* Row 1: B2, B5, B6 */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* B2: Total Cash */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold text-brand-dim">إجمالي الكاش المستلم</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={totalCash}
                                  onChange={(e) => setTotalCash(e.target.value)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-2.5 pl-3 pr-9 text-white placeholder:text-white/20 text-left dir-ltr focus:border-brand-accent focus:outline-none transition-all text-xs font-mono"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/30">
                                  <DollarSign className="h-4 w-4" />
                                </div>
                              </div>
                            </div>

                            {/* B5: Personal Expenses */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold text-brand-dim">مصاريف شخصية</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={personalExpenses}
                                  onChange={(e) => setPersonalExpenses(e.target.value)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-2.5 pl-3 pr-9 text-white placeholder:text-white/20 text-left dir-ltr focus:border-brand-accent focus:outline-none transition-all text-xs font-mono"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/30">
                                  <Coins className="h-4 w-4" />
                                </div>
                              </div>
                            </div>

                            {/* B6: Recipient Money */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold text-brand-dim">تحويلات الزملاء</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={recipientMoney}
                                  onChange={(e) => setRecipientMoney(e.target.value)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-2.5 pl-3 pr-9 text-white placeholder:text-white/20 text-left dir-ltr focus:border-brand-accent focus:outline-none transition-all text-xs font-mono"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/30">
                                  <DollarSign className="h-4 w-4" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* B3: Calculated Cash After Transfers */}
                          <div className="flex justify-between items-center py-2 px-4 rounded-xl bg-white/[0.01] border border-white/[0.03] text-xs">
                            <span className="text-brand-dim font-bold">صافي الكاش الفعلي للموظف:</span>
                            <span className="font-extrabold font-mono text-white">
                              {math.B3.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Marketing CPL SpreadSheet Grid */}
                      <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                        <h3 className="text-lg font-bold text-white mb-6 pb-3 border-b border-white/[0.04]">2. حاسبة تكلفة العميل (CPL Calculator)</h3>

                        <div className="overflow-x-auto">
                          <table className="w-full text-right border-collapse min-w-[550px]">
                            <thead>
                              <tr className="border-b border-white/[0.05] text-[10px] font-extrabold text-brand-dim">
                                <th className="py-2.5 pr-3">النظام الإعلاني</th>
                                <th className="py-2.5">المبلغ المصروف</th>
                                <th className="py-2.5">عدد اللييدات</th>
                                <th className="py-2.5 pl-3 text-left">التكلفة الفعلية (CPL)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03] text-xs text-white">
                              {/* Marketing Sys 1 */}
                              <tr className="hover:bg-white/[0.01] transition-colors">
                                <td className="py-3.5 font-sans font-bold pr-3">Marketing Sys 1</td>
                                <td className="py-3.5 pl-2 font-mono font-bold text-brand-accent">
                                  {math.B9.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                                  <span className="block text-[8px] text-brand-dim/40 font-normal mt-0.5">معادلة تلقائية</span>
                                </td>
                                <td className="py-3.5 pl-2">
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={sys1Count}
                                    onChange={(e) => setSys1Count(e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-24 bg-white/[0.02] border border-white/[0.08] rounded-lg py-1 px-2 text-xs text-white text-left focus:outline-none focus:border-brand-accent transition-colors font-mono"
                                  />
                                </td>
                                <td className="py-3.5 text-left font-sans font-bold text-brand-accent pl-3">
                                  {math.C9 === 'Add count First' ? (
                                    <span className="text-[10px] text-brand-dim/40 font-normal italic">أدخل العدد أولاً</span>
                                  ) : (
                                    `${parseFloat(math.C9).toLocaleString('en-US')} ج.م`
                                  )}
                                </td>
                              </tr>

                              {/* Marketing Sys 2 */}
                              <tr className="hover:bg-white/[0.01] transition-colors">
                                <td className="py-3.5 font-sans font-bold pr-3">Marketing Sys 2</td>
                                <td className="py-3.5 pl-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={sys2Amount}
                                    onChange={(e) => setSys2Amount(e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-32 bg-white/[0.02] border border-white/[0.08] rounded-lg py-1 px-2 text-xs text-white text-left focus:outline-none focus:border-brand-accent transition-colors font-mono"
                                  />
                                </td>
                                <td className="py-3.5 pl-2">
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={sys2Count}
                                    onChange={(e) => setSys2Count(e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-24 bg-white/[0.02] border border-white/[0.08] rounded-lg py-1 px-2 text-xs text-white text-left focus:outline-none focus:border-brand-accent transition-colors font-mono"
                                  />
                                </td>
                                <td className="py-3.5 text-left font-sans font-bold text-white pl-3">
                                  {math.C10 === 'Add count First' ? (
                                    <span className="text-[10px] text-brand-dim/40 font-normal italic">أدخل العدد أولاً</span>
                                  ) : (
                                    `${parseFloat(math.C10).toLocaleString('en-US')} ج.م`
                                  )}
                                </td>
                              </tr>

                              {/* Marketing Sys 3 */}
                              <tr className="hover:bg-white/[0.01] transition-colors">
                                <td className="py-3.5 font-sans font-bold pr-3">Marketing Sys 3</td>
                                <td className="py-3.5 pl-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={sys3Amount}
                                    onChange={(e) => setSys3Amount(e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-32 bg-white/[0.02] border border-white/[0.08] rounded-lg py-1 px-2 text-xs text-white text-left focus:outline-none focus:border-brand-accent transition-colors font-mono"
                                  />
                                </td>
                                <td className="py-3.5 pl-2">
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={sys3Count}
                                    onChange={(e) => setSys3Count(e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-24 bg-white/[0.02] border border-white/[0.08] rounded-lg py-1 px-2 text-xs text-white text-left focus:outline-none focus:border-brand-accent transition-colors font-mono"
                                  />
                                </td>
                                <td className="py-3.5 text-left font-sans font-bold text-white pl-3">
                                  {math.C11 === 'Add count First' ? (
                                    <span className="text-[10px] text-brand-dim/40 font-normal italic">أدخل العدد أولاً</span>
                                  ) : (
                                    `${parseFloat(math.C11).toLocaleString('en-US')} ج.م`
                                  )}
                                </td>
                              </tr>

                              {/* Summary Row */}
                              <tr className="bg-white/[0.01] border-t border-brand-border/60">
                                <td className="py-3.5 font-sans font-extrabold pr-3 text-right">إجمالي عدد اللييدز</td>
                                <td className="py-3.5 text-right text-brand-dim font-sans text-[10px] pl-2">—</td>
                                <td className="py-3.5 pl-2 text-left font-extrabold text-white font-mono text-sm pr-2">
                                  {math.B12}
                                </td>
                                <td className="py-3.5 text-left text-brand-dim font-sans text-[10px]">—</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Section 4: Total Summary Panel */}
                      <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-4">
                        <h3 className="text-base font-extrabold text-white pb-2 border-b border-white/[0.04]">4. التلخيص المالي النهائي</h3>
                        
                        {/* B4: Total Expenses */}
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-brand-dim">إجمالي المصروفات:</span>
                            <span className="text-[9px] text-brand-dim/40 font-mono">B5 + B6 + B9 + B10 + B11</span>
                          </div>
                          <span className="font-bold font-mono text-white">
                            {math.B4.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                          </span>
                        </div>

                        {/* B13: Total Wallets Cash */}
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-brand-dim">إجمالي أرصدة المحافظ النشطة:</span>
                            <span className="text-[9px] text-brand-dim/40 font-mono">المحافظ + B7</span>
                          </div>
                          <span className="font-bold font-mono text-white">
                            {math.B13.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                          </span>
                        </div>

                        {/* B14: Remaining final cash */}
                        <div className="flex justify-between items-center pt-3 border-t border-white/[0.04] text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-white">الكاش النهائي المتبقي عجز/زيادة:</span>
                            <span className="text-[9px] text-brand-dim/40 font-mono">B2 - B4 - B7</span>
                          </div>
                          <span className="font-extrabold font-mono text-brand-accent text-base">
                            {math.B14.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م
                          </span>
                        </div>
                      </div>

                      {/* Big Submit Button */}
                      <div>
                        <button
                          type="submit"
                          disabled={isPending}
                          className="w-full bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent/90 hover:to-brand-accent-dark/95 border border-brand-accent/20 rounded-2xl py-4 text-sm font-extrabold text-white shadow-[0_4px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_4px_25px_rgba(139,92,246,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin text-white" />
                              <span>جاري إرسال وحفظ البيانات...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-5 w-5 text-white" />
                              <span>{activeTab === 'new-entry' ? 'حفظ وإغلاق التقرير اليومي' : 'تحديث وتعديل التقرير اليومي'}</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>

                    {/* Right Column: Wallets Inputs (5 Cols) */}
                    <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
                      
                      {/* Section 3: Active Wallets Input List */}
                      <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative flex flex-col justify-between min-h-[450px]">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-2 pb-3 border-b border-white/[0.04]">3. محافظ الكاش النشطة</h3>
                          <p className="text-xs text-brand-dim mb-4 leading-relaxed">
                            أرصدة محافظك المسجلة في النظام. أدخل المبلغ المتوفر في كل محفظة اليوم لإتمام عملية الإغلاق المالي.
                          </p>

                          {activeWallets.length === 0 ? (
                            <div className="text-center py-8 text-brand-dim/50 border border-dashed border-white/[0.05] rounded-2xl">
                              لا توجد محافظ نشطة مسجلة لك حالياً في لوحة التحكم.
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                              {activeWallets.map((wallet) => (
                                <div
                                  key={wallet.id}
                                  className="flex items-center justify-between gap-4 py-1 px-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-white/[0.06] transition-all duration-300"
                                >
                                  <div className="flex items-center gap-2 text-right">
                                    <Smartphone className="h-4 w-4 text-brand-accent" />
                                    {/* Mobile/Phone number rendered 4px larger (text-[17px]) with decreased vertical padding */}
                                    <span className="text-[17px] font-bold text-white font-mono tracking-wide">
                                      {wallet.phone_number}
                                    </span>
                                  </div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={walletAmounts[wallet.phone_number] === '0' ? '' : walletAmounts[wallet.phone_number] || ''}
                                    onChange={(e) => handleWalletAmountChange(wallet.phone_number, e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-32 bg-white/[0.02] border border-white/[0.08] rounded-xl py-1.5 px-3 text-xs text-white text-left focus:outline-none focus:border-brand-accent transition-colors font-mono"
                                    required
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Campaign and Total Wallets calculation row */}
                        <div className="mt-5 pt-4 border-t border-white/[0.04] space-y-4">
                          {/* Campaign Amount Input (B7) */}
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-brand-dim">مصاريف الحملة الإعلانية:</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={campaignMoney}
                              onChange={(e) => setCampaignMoney(e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="w-32 bg-white/[0.02] border border-white/[0.08] rounded-xl py-2 px-3 text-xs text-white text-left focus:outline-none focus:border-brand-accent transition-colors font-mono"
                            />
                          </div>

                          {/* Wallets Sum label */}
                          <div className="flex justify-between items-center text-xs bg-white/[0.01] p-3 rounded-xl border border-white/[0.04]">
                            <span className="font-bold text-brand-dim">إجمالي رصيد الكاش الفعلي بالمحافظ:</span>
                            <span className="font-bold font-mono text-white">
                              {activeWallets
                                .reduce(
                                  (sum, w) => sum + (parseFloat(walletAmounts[w.phone_number]) || 0),
                                  0
                                )
                                .toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                              ج.م
                            </span>
                          </div>
                        </div>

                      </div>

                    </div>

                  </div>
                ) : null}
              </>
            )}

            {/* Layout for History Tab */}
            {activeTab === 'history' && (
              <div className="rounded-[24px] bg-brand-card border border-brand-border p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-right">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-3 border-b border-white/[0.04]">
                  <h3 className="text-lg font-bold text-white">سجل الحسابات اليومية والتقارير</h3>
                  
                  <div className="flex items-center gap-2 text-brand-dim">
                    <Calendar className="h-4.5 w-4.5 text-brand-accent" />
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="bg-brand-bg border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-accent transition-colors font-mono"
                    />
                    {filterDate && (
                      <button
                        type="button"
                        onClick={() => setFilterDate('')}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/80 hover:text-white transition-all cursor-pointer border border-white/[0.05]"
                      >
                        إلغاء التصفية
                      </button>
                    )}
                  </div>
                </div>

                {reports.length === 0 ? (
                  <div className="text-center py-12 text-brand-dim/50">
                    لا توجد تقارير سابقة محفوظة حتى الآن في سجل حسابك.
                  </div>
                ) : (
                  <>
                    {filteredReports.length === 0 ? (
                      <div className="text-center py-12 text-brand-dim/60 space-y-3">
                        <p>لا توجد تقارير مطابقة للتاريخ المحدد ({filterDate}).</p>
                        <button
                          type="button"
                          onClick={() => setFilterDate('')}
                          className="px-4 py-2 rounded-xl bg-brand-accent/20 hover:bg-brand-accent/30 text-xs text-brand-accent font-bold transition-all cursor-pointer border border-brand-accent/30"
                        >
                          عرض جميع التقارير
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="border-b border-white/[0.05] text-[10px] font-extrabold text-brand-dim">
                              <th className="py-2.5 pr-3">التاريخ</th>
                              <th className="py-2.5">إجمالي الكاش المستلم</th>
                              <th className="py-2.5">أرصدة المحافظ</th>
                              <th className="py-2.5">Marketing Sys 1</th>
                              <th className="py-2.5">الكاش المتبقي</th>
                              <th className="py-2.5">إجمالي اللييدات</th>
                              <th className="py-2.5 pl-3 text-center">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.03] text-xs text-white">
                            {filteredReports.map((report) => (
                              <React.Fragment key={report.id}>
                                <tr className="hover:bg-white/[0.01] transition-colors">
                                  <td className="py-3.5 pr-3 font-mono font-semibold">{report.report_date}</td>
                                  <td className="py-3.5 font-mono">{report.total_cash.toLocaleString('en-US')} ج.م</td>
                                  <td className="py-3.5 font-mono text-brand-dim">
                                    {report.calc_total_wallets.toLocaleString('en-US')} ج.م
                                  </td>
                                  <td className="py-3.5 font-mono">{report.sys1_amount.toLocaleString('en-US')} ج.م</td>
                                  <td className="py-3.5 font-mono font-extrabold text-emerald-400">
                                    {report.calc_remaining_cash.toLocaleString('en-US')} ج.م
                                  </td>
                                  <td className="py-3.5 font-mono font-semibold">{report.total_leads}</td>
                                  <td className="py-3.5 pl-3">
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditReportDate(report.report_date)
                                          setActiveTab('edit-report')
                                        }}
                                        className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-brand-accent/20 border border-white/[0.08] hover:border-brand-accent/30 text-white transition-all cursor-pointer flex items-center gap-1 text-[10px]"
                                      >
                                        <Edit className="h-3.5 w-3.5 text-brand-accent" />
                                        <span>تعديل</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleRowExpansion(report.id)}
                                        className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-white transition-all cursor-pointer"
                                      >
                                        {expandedRowId === report.id ? (
                                          <ChevronUp className="h-3.5 w-3.5" />
                                        ) : (
                                          <ChevronDown className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* History Expandable Drawer */}
                                {expandedRowId === report.id && (
                                  <tr className="bg-white/[0.005]">
                                    <td colSpan={7} className="py-4 px-6 border-b border-brand-border/60">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
                                        
                                        {/* Systems CPL */}
                                        <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-white/[0.03]">
                                          <h4 className="text-xs font-bold text-brand-accent border-b border-white/[0.04] pb-1.5 mb-2">تفاصيل الأنظمة وتكلفة العميل (CPL)</h4>
                                          <div className="flex justify-between text-[11px] py-0.5">
                                            <span className="text-brand-dim">Marketing Sys 1:</span>
                                            <span className="font-mono">{report.sys1_amount.toLocaleString('en-US')} ج.م ({report.sys1_count ?? 0} ليد) [CPL: {report.sys1_cpl ?? 0}]</span>
                                          </div>
                                          <div className="flex justify-between text-[11px] py-0.5">
                                            <span className="text-brand-dim">Marketing Sys 2:</span>
                                            <span className="font-mono">{report.sys2_amount.toLocaleString('en-US')} ج.م ({report.sys2_count ?? 0} ليد) [CPL: {report.sys2_cpl ?? 0}]</span>
                                          </div>
                                          <div className="flex justify-between text-[11px] py-0.5">
                                            <span className="text-brand-dim">Marketing Sys 3:</span>
                                            <span className="font-mono">{report.sys3_amount.toLocaleString('en-US')} ج.م ({report.sys3_count ?? 0} ليد) [CPL: {report.sys3_cpl ?? 0}]</span>
                                          </div>
                                        </div>

                                        {/* Wallets */}
                                        <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-white/[0.03]">
                                          <h4 className="text-xs font-bold text-brand-accent border-b border-white/[0.04] pb-1.5 mb-2">أرصدة المحافظ في هذا اليوم</h4>
                                          {(() => {
                                            const details = report.wallets_details
                                            let list: any[] = []
                                            if (details) {
                                              if (Array.isArray(details)) {
                                                list = details
                                              } else if (Array.isArray(details.wallets)) {
                                                list = details.wallets
                                              }
                                            }
                                            if (list.length === 0) {
                                              return <p className="text-[11px] text-brand-dim/50">لا توجد تفاصيل.</p>
                                            }
                                            return list.map((w: any, idx: number) => (
                                              <div key={idx} className="flex justify-between text-[11px] py-0.5">
                                                <span className="font-mono text-brand-dim">{w.phone}:</span>
                                                <span className="font-mono">{w.amount.toLocaleString('en-US')} ج.م</span>
                                              </div>
                                            ))
                                          })()}
                                        </div>

                                        {/* Financials details */}
                                        <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-white/[0.03]">
                                          <h4 className="text-xs font-bold text-brand-accent border-b border-white/[0.04] pb-1.5 mb-2">حركة المصاريف والتحويلات</h4>
                                          <div className="flex justify-between text-[11px] py-0.5">
                                            <span className="text-brand-dim">مصاريف شخصية:</span>
                                            <span className="font-mono">{report.personal_expenses.toLocaleString('en-US')} ج.م</span>
                                          </div>
                                          <div className="flex justify-between text-[11px] py-0.5">
                                            <span className="text-brand-dim">تحويلات الزملاء:</span>
                                            <span className="font-mono">{report.recipient_money.toLocaleString('en-US')} ج.م</span>
                                          </div>
                                          <div className="flex justify-between text-[11px] py-0.5">
                                            <span className="text-brand-dim">مصاريف الحملة الإعلانية:</span>
                                            <span className="font-mono">{report.campaign_money.toLocaleString('en-US')} ج.م</span>
                                          </div>
                                        </div>

                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </form>
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="rounded-[28px] bg-[#0c0d19] border border-white/[0.08] p-6 max-w-md w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6 text-right animate-scale-up">
            <div className="flex items-center justify-start gap-3 border-b border-white/[0.04] pb-4">
              <AlertCircle className="h-6 w-6 text-brand-accent shrink-0" />
              <h3 className="text-lg font-bold text-white">تأكيد حفظ البيانات</h3>
            </div>
            
            <p className="text-sm text-brand-dim leading-relaxed">
              انتا متأكد انك عدلت الكاش اللي في المحافظ وكلو تمام ؟
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-brand-dim bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent/90 hover:to-brand-accent-dark/95 border border-brand-accent/20 shadow-[0_4px_12px_rgba(139,92,246,0.2)] transition-all cursor-pointer"
              >
                تأكيد وحفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}