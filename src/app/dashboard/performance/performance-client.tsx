'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Loader2, Calendar, FileSpreadsheet, Clock, Database } from 'lucide-react'

type SystemType = 'sys1' | 'sys2' | 'sys3'
type TabType = 'monthly' | 'daily' | 'lastMonth'

const SYSTEMS_CONFIG: Record<SystemType, { 
  name: string 
  baseUrl: string 
  gids: Record<TabType, string> 
}> = {
  sys1: {
    name: 'Marketing Analysis Sys 1',
    baseUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQUERY1nx8cc6MRJQAYPTAMpEXEYc7rCtHZA1tparMUyBJDghwFFiCdZetQuEPoBd0j47MvxO1VxPCS/pubhtml',
    gids: { monthly: '1202130473', daily: '2002744130', lastMonth: '1721346589' }
  },
  sys2: {
    name: 'Marketing Analysis Sys 2',
    baseUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTtqh1ofNxamQzH8RHfmzZgdwgNRKSx6HyjXvcb83yHJED2R_UiIO7CHxNF-ZppZxrrPo84uO9gk7Dg/pubhtml',
    gids: { monthly: '633527915', daily: '229280379', lastMonth: '1948397058' }
  },
  sys3: {
    name: 'Marketing Analysis Sys 3',
    baseUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS5uS-NaitW2y52acPznrEjtqWtJ4HCXH5BixH1u3eRY7_vNBoxvKJszgw586b34l2l9WVc-BrRxN7u/pubhtml',
    gids: { monthly: '1002850612', daily: '443367812', lastMonth: '1015706660' }
  }
}

export default function PerformanceClient() {
  const [activeSystem, setActiveSystem] = useState<SystemType>('sys3')
  const [activeTab, setActiveTab] = useState<TabType>('monthly')
  const [isLoading, setIsLoading] = useState(true)

  // Construct iframe URLs dynamically based on current system and tab selection
  const getIframeUrl = (systemKey: SystemType, tabKey: TabType) => {
    const system = SYSTEMS_CONFIG[systemKey]
    const gid = system.gids[tabKey]
    return `${system.baseUrl}?single=true&widget=false&headers=false&chrome=false&gid=${gid}`
  }

  // Handle system switches, activating loader spinner
  const handleSystemChange = (systemKey: SystemType) => {
    if (systemKey !== activeSystem) {
      setIsLoading(true)
      setActiveSystem(systemKey)
    }
  }

  // Handle sub-tab switches, activating loader spinner
  const handleTabChange = (tabKey: TabType) => {
    if (tabKey !== activeTab) {
      setIsLoading(true)
      setActiveTab(tabKey)
    }
  }

  // Automatic loading indicator safety timeout of 10s
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 10000)
    return () => clearTimeout(timer)
  }, [activeSystem, activeTab])

  return (
    <div className="space-y-6 w-full max-w-none relative z-10 animate-fade-in text-right">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <TrendingUp className="h-7 w-7 text-brand-accent animate-pulse" />
            <span>تحليل الأداء</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            عرض مباشر لتقارير ومؤشرات الأداء المالي والعمليات اليومية والشهرية المستوردة من Google Sheets لكافة الأنظمة.
          </p>
        </div>
      </div>

      {/* Two-Level Selection Controls Panel */}
      <div className="flex flex-col gap-5 p-5 rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl shadow-sm">
        {/* Level 1: System Selection */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold text-brand-dim flex items-center gap-1.5 justify-start">
            <Database className="h-4 w-4 text-brand-accent" />
            <span>نظام التسويق الرئيسي (Marketing System)</span>
          </span>
          <div className="flex flex-wrap gap-2.5 justify-start">
            {(Object.keys(SYSTEMS_CONFIG) as SystemType[]).map((sysKey) => {
              const sys = SYSTEMS_CONFIG[sysKey]
              const isActive = activeSystem === sysKey
              return (
                <button
                  key={sysKey}
                  onClick={() => handleSystemChange(sysKey)}
                  className={`px-5 py-3 rounded-xl text-xs font-extrabold transition-all duration-300 cursor-pointer border ${
                    isActive
                      ? 'text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark border-brand-accent/30 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                      : 'text-brand-dim bg-white/[0.01] hover:text-white hover:bg-white/[0.03] border-white/[0.08]'
                  }`}
                >
                  {sys.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Horizontal Divider */}
        <div className="h-px bg-brand-border w-full" />

        {/* Level 2: Sub-Tabs Selection */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold text-brand-dim flex items-center gap-1.5 justify-start">
            <TrendingUp className="h-4 w-4 text-brand-accent" />
            <span>نوع التقرير الفرعي (Report Type)</span>
          </span>
          <div className="flex flex-wrap gap-2.5 justify-start">
            {/* Monthly Tab Button */}
            <button
              onClick={() => handleTabChange('monthly')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer border ${
                activeTab === 'monthly'
                  ? 'text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark border-brand-accent/30 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                  : 'text-brand-dim bg-white/[0.01] hover:text-white hover:bg-white/[0.03] border-white/[0.08]'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>التقرير الشهري (Monthly)</span>
            </button>

            {/* Daily Performance Tab Button */}
            <button
              onClick={() => handleTabChange('daily')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer border ${
                activeTab === 'daily'
                  ? 'text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark border-brand-accent/30 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                  : 'text-brand-dim bg-white/[0.01] hover:text-white hover:bg-white/[0.03] border-white/[0.08]'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>الأداء اليومي (Daily Performance)</span>
            </button>

            {/* Last Month Tab Button */}
            <button
              onClick={() => handleTabChange('lastMonth')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer border ${
                activeTab === 'lastMonth'
                  ? 'text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark border-brand-accent/30 shadow-[0_0_15px_rgba(139,92,246,0.25)]'
                  : 'text-brand-dim bg-white/[0.01] hover:text-white hover:bg-white/[0.03] border-white/[0.08]'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>الشهر الماضي (Last Month)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Iframe Viewer Container */}
      <div className="relative rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
        {/* Decorative backdrop blur circle */}
        <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

        {/* Loading Spinner overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-brand-bg/85 backdrop-blur-md transition-opacity duration-300">
            <Loader2 className="h-10 w-10 animate-spin text-brand-accent mb-4" />
            <p className="text-sm font-semibold text-white">جاري تحميل تقرير Google Sheets...</p>
            <p className="text-xs text-brand-dim mt-1.5">يرجى الانتظار لبضع ثوانٍ</p>
          </div>
        )}

        {/* The Embed Iframe */}
        <div className="w-full rounded-xl overflow-hidden bg-white relative">
          <iframe
            key={`${activeSystem}-${activeTab}`} // Forces re-render of iframe on tab/system switch to show loader immediately
            src={getIframeUrl(activeSystem, activeTab)}
            onLoad={() => setIsLoading(false)}
            className="w-full h-[800px] border-0 rounded-lg shadow-sm bg-white block"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}
