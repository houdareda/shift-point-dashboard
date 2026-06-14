'use client'

import { useEffect, useState, startTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import { BarChart3, Calendar, ArrowDownLeft, ArrowUpRight, Coins, Loader2, AlertCircle } from 'lucide-react'

interface AgentOverview {
  agent_name: string
  total_in: number
  total_out: number
  net_balance: number
}

export default function OverviewPage() {
  const supabase = createClient()

  // Calculate default dates for the current local month
  const tzOffset = new Date().getTimezoneOffset() * 60000
  const today = new Date(Date.now() - tzOffset)
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const firstDayStr = new Date(firstDay.getTime() - tzOffset).toISOString().split('T')[0]
  const lastDayStr = new Date(lastDay.getTime() - tzOffset).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(firstDayStr)
  const [endDate, setEndDate] = useState(lastDayStr)
  const [data, setData] = useState<AgentOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (start: string, end: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data: res, error: err } = await supabase.rpc('get_agents_overview', {
        p_start_date: start,
        p_end_date: end,
      })

      if (err) {
        console.error('Error executing get_agents_overview RPC:', err)
        if (err.message?.includes('approved_amount')) {
          setError(
            'حدث خطأ في قاعدة البيانات: الحقل approved_amount غير موجود بجدول الطلبات. يرجى تطبيق كود التحديث (SQL patch) الموضح في خطة العمل لتصحيح الدالة get_agents_overview.'
          )
        } else {
          setError(err.message || 'حدث خطأ غير متوقع أثناء جلب البيانات.')
        }
        setData([])
      } else {
        setData(res || [])
      }
    } catch (e: any) {
      setError(e.message || 'حدث خطأ أثناء الاتصال بالخادم.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(startDate, endDate)
  }, [])

  const handleFilterChange = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(startDate, endDate)
  }

  // Calculate aggregates
  const sumIn = data.reduce((acc, curr) => acc + Number(curr.total_in || 0), 0)
  const sumOut = data.reduce((acc, curr) => acc + Number(curr.total_out || 0), 0)
  const sumNet = data.reduce((acc, curr) => acc + Number(curr.net_balance || 0), 0)

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in text-right">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <BarChart3 className="h-7 w-7 text-brand-accent" />
            <span>التقرير المالي المجمع</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            متابعة إجمالي التدفقات الواردة والمنصرفة، والعهدة الحالية المتبقية لكافة الموظفين خلال الفترة المحددة.
          </p>
        </div>
      </div>

      {/* Date Range Picker Filters */}
      <form onSubmit={handleFilterChange} className="p-5 rounded-[20px] bg-brand-card border border-brand-border backdrop-blur-xl flex flex-col sm:flex-row items-end justify-end gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        {/* End Date */}
        <div className="w-full sm:w-auto space-y-1.5">
          <label htmlFor="endDate" className="block text-xs font-semibold text-brand-dim">
            إلى تاريخ
          </label>
          <div className="relative">
            <input
              type="date"
              id="endDate"
              dir="ltr"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full sm:w-48 rounded-xl bg-white/[0.02] border border-white/[0.08] py-2.5 pl-4 pr-10 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs dir-ltr text-left"
            />
            <Calendar className="absolute inset-y-0 right-3 my-auto h-4 w-4 text-white/30" />
          </div>
        </div>

        {/* Start Date */}
        <div className="w-full sm:w-auto space-y-1.5">
          <label htmlFor="startDate" className="block text-xs font-semibold text-brand-dim">
            من تاريخ
          </label>
          <div className="relative">
            <input
              type="date"
              id="startDate"
              dir="ltr"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full sm:w-48 rounded-xl bg-white/[0.02] border border-white/[0.08] py-2.5 pl-4 pr-10 text-white focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs dir-ltr text-left"
            />
            <Calendar className="absolute inset-y-0 right-3 my-auto h-4 w-4 text-white/30" />
          </div>
        </div>

        {/* Search button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto flex justify-center items-center gap-2 py-2.5 px-6 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent shadow-[0_0_15px_rgba(139,92,246,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>عرض التقرير</span>
        </button>
      </form>

      {/* Aggregate Cards Overview */}
      {!loading && !error && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Card 1: Total In */}
          <div className="p-5 rounded-2xl bg-brand-card border border-brand-border backdrop-blur-xl flex items-center justify-between shadow-sm">
            <div className="text-right">
              <span className="text-[10px] font-semibold text-brand-dim">إجمالي الوارد</span>
              <p className="text-lg font-bold text-emerald-400 mt-1 font-mono">
                {sumIn.toLocaleString('en-US')} ج.م
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2: Total Out */}
          <div className="p-5 rounded-2xl bg-brand-card border border-brand-border backdrop-blur-xl flex items-center justify-between shadow-sm">
            <div className="text-right">
              <span className="text-[10px] font-semibold text-brand-dim">إجمالي المنصرف</span>
              <p className="text-lg font-bold text-red-400 mt-1 font-mono">
                {sumOut.toLocaleString('en-US')} ج.م
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3: Net Balance */}
          <div className="p-5 rounded-2xl bg-brand-card border border-brand-border backdrop-blur-xl flex items-center justify-between shadow-sm">
            <div className="text-right">
              <span className="text-[10px] font-semibold text-brand-dim">صافي العهدة الكلية</span>
              <p className={`text-lg font-bold mt-1 font-mono ${
                sumNet > 0 ? 'text-emerald-400' : sumNet < 0 ? 'text-red-400' : 'text-brand-dim'
              }`}>
                {sumNet.toLocaleString('en-US')} ج.م
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-accent/10 border border-brand-border flex items-center justify-center text-brand-accent">
              <Coins className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden">
        <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-brand-dim">
            <Loader2 className="h-10 w-10 animate-spin text-brand-accent mb-4" />
            <span className="text-xs">جاري تحميل وتجميع البيانات...</span>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-10 text-center max-w-lg mx-auto">
            <AlertCircle className="h-12 w-12 text-brand-error mb-4 animate-bounce" />
            <h4 className="text-base font-bold text-white mb-2">فشل جلب التقرير المالي</h4>
            <p className="text-xs text-brand-dim leading-relaxed mb-4">{error}</p>
            <button
              onClick={() => fetchData(startDate, endDate)}
              className="px-4 py-2 text-xs font-bold text-white bg-white/5 border border-brand-border hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-brand-dim">
            <AlertCircle className="h-10 w-10 opacity-30 mb-3" />
            <span className="text-sm font-semibold text-white mb-1">لا توجد بيانات متاحة</span>
            <span className="text-xs max-w-xs leading-relaxed">لم يتم العثور على أي موظف (Agent) لديه عمليات مالية مسجلة خلال هذه الفترة.</span>
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && data.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/[0.04] bg-white/[0.005]">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-brand-border bg-white/[0.01] text-xs text-brand-dim">
                  <th className="px-6 py-4.5 font-bold">اسم الموظف</th>
                  <th className="px-6 py-4.5 font-bold">إجمالي الوارد</th>
                  <th className="px-6 py-4.5 font-bold">إجمالي المنصرف</th>
                  <th className="px-6 py-4.5 font-bold">الرصيد المتبقي (العهدة)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {data.map((row, index) => {
                  const netVal = Number(row.net_balance || 0)
                  return (
                    <tr
                      key={index}
                      className="hover:bg-white/[0.01] transition-colors group"
                    >
                      {/* Name */}
                      <td className="px-6 py-4.5 font-semibold text-white group-hover:text-brand-accent transition-colors">
                        {row.agent_name}
                      </td>

                      {/* Total In */}
                      <td className="px-6 py-4.5 font-mono text-white/90">
                        {Number(row.total_in || 0).toLocaleString('en-US')} ج.م
                      </td>

                      {/* Total Out */}
                      <td className="px-6 py-4.5 font-mono text-white/90">
                        {Number(row.total_out || 0).toLocaleString('en-US')} ج.م
                      </td>

                      {/* Net Balance */}
                      <td className="px-6 py-4.5 font-mono">
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg border font-bold ${
                          netVal > 0 
                            ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15'
                            : netVal < 0 
                            ? 'text-red-400 bg-red-500/5 border-red-500/15'
                            : 'text-brand-dim bg-white/[0.01] border-brand-border'
                        }`}>
                          {netVal.toLocaleString('en-US')} ج.م
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
    </div>
  )
}
