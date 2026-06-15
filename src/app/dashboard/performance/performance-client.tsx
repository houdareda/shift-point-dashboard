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

const systemColors: Record<SystemType, {
  bg: string
  border: string
  borderActive: string
  text: string
  glow: string
  gradient: string
  borderIframe: string
  blurBg: string
  spinnerColor: string
}> = {
  sys1: {
    bg: 'bg-[#3451b2]',
    border: 'border-[#3451b2]',
    borderActive: 'border-[#3451b2]/30',
    text: 'text-[#3451b2]',
    glow: 'shadow-[0_0_15px_rgba(52,81,178,0.4)]',
    gradient: 'from-[#3451b2] to-[#284196]',
    borderIframe: 'border-[#3451b2]/20',
    blurBg: 'bg-[#3451b2]/10',
    spinnerColor: 'text-[#3451b2]'
  },
  sys2: {
    bg: 'bg-[#437c28]',
    border: 'border-[#437c28]',
    borderActive: 'border-[#437c28]/30',
    text: 'text-[#437c28]',
    glow: 'shadow-[0_0_15px_rgba(67,124,40,0.4)]',
    gradient: 'from-[#437c28] to-[#32611c]',
    borderIframe: 'border-[#437c28]/20',
    blurBg: 'bg-[#437c28]/10',
    spinnerColor: 'text-[#437c28]'
  },
  sys3: {
    bg: 'bg-[#301a6b]',
    border: 'border-[#301a6b]',
    borderActive: 'border-[#301a6b]/30',
    text: 'text-[#301a6b]',
    glow: 'shadow-[0_0_15px_rgba(48,26,107,0.4)]',
    gradient: 'from-[#301a6b] to-[#221052]',
    borderIframe: 'border-[#301a6b]/20',
    blurBg: 'bg-[#301a6b]/10',
    spinnerColor: 'text-[#301a6b]'
  }
}

export default function PerformanceClient() {
  const [activeSystem, setActiveSystem] = useState<SystemType>('sys3')
  const [activeTab, setActiveTab] = useState<TabType>('monthly')
  const [isLoading, setIsLoading] = useState(true)

  const activeColors = systemColors[activeSystem]

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
            <TrendingUp className={`h-7 w-7 ${activeColors.text} animate-pulse transition-colors duration-300`} />
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
            <Database className={`h-4 w-4 ${activeColors.text} transition-colors duration-300`} />
            <span>نظام التسويق الرئيسي (Marketing System)</span>
          </span>
          <div className="flex flex-wrap gap-2.5 justify-start">
            {(Object.keys(SYSTEMS_CONFIG) as SystemType[]).map((sysKey) => {
              const sys = SYSTEMS_CONFIG[sysKey]
              const isActive = activeSystem === sysKey
              const colors = systemColors[sysKey]
              return (
                <button
                  key={sysKey}
                  onClick={() => handleSystemChange(sysKey)}
                  className={`px-5 py-3 rounded-xl text-xs font-extrabold transition-all duration-300 cursor-pointer border ${
                    isActive
                      ? `text-white bg-gradient-to-r ${colors.gradient} ${colors.borderActive} ${colors.glow}`
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
            <TrendingUp className={`h-4 w-4 ${activeColors.text} transition-colors duration-300`} />
            <span>نوع التقرير الفرعي (Report Type)</span>
          </span>
          <div className="flex flex-wrap gap-2.5 justify-start">
            {/* Monthly Tab Button */}
            <button
              onClick={() => handleTabChange('monthly')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer border ${
                activeTab === 'monthly'
                  ? `text-white bg-gradient-to-r ${activeColors.gradient} ${activeColors.borderActive} ${activeColors.glow}`
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
                  ? `text-white bg-gradient-to-r ${activeColors.gradient} ${activeColors.borderActive} ${activeColors.glow}`
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
                  ? `text-white bg-gradient-to-r ${activeColors.gradient} ${activeColors.borderActive} ${activeColors.glow}`
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
      <div className={`relative rounded-[24px] bg-brand-card border ${activeColors.borderIframe} backdrop-blur-xl p-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-300`}>
        {/* Decorative backdrop blur circle */}
        <div className={`absolute -top-[100px] -left-[100px] w-[200px] h-[200px] ${activeColors.blurBg} rounded-full blur-[50px] pointer-events-none transition-all duration-300`} />

        {/* Loading Spinner overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-brand-bg/85 backdrop-blur-md transition-opacity duration-300">
            <Loader2 className={`h-10 w-10 animate-spin ${activeColors.spinnerColor} mb-4 transition-colors duration-300`} />
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
