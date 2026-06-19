'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Loader2,
  Calendar,
  FileSpreadsheet,
  Clock,
  Database,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────── */

type TabType = 'monthly' | 'daily' | 'lastMonth'

interface SheetConfig {
  id: string
  system_key: string
  system_label: string
  base_url: string
  monthly_gid: string
  daily_gid: string
  last_month_gid: string
}

/* ─── Per-system colour tokens ───────────────────────────── */

const SYSTEM_COLORS: Record<string, {
  gradient: string
  borderActive: string
  glow: string
  borderIframe: string
  blurBg: string
  spinnerColor: string
  textActive: string
}> = {
  sys1: {
    gradient:      'from-[#3451b2] to-[#284196]',
    borderActive:  'border-[#3451b2]/40',
    glow:          'shadow-[0_0_14px_rgba(52,81,178,0.45)]',
    borderIframe:  'border-[#3451b2]/25',
    blurBg:        'bg-[#3451b2]/10',
    spinnerColor:  'text-[#748fe0]',
    textActive:    'text-white',
  },
  sys2: {
    gradient:      'from-[#437c28] to-[#32611c]',
    borderActive:  'border-[#437c28]/40',
    glow:          'shadow-[0_0_14px_rgba(67,124,40,0.45)]',
    borderIframe:  'border-[#437c28]/25',
    blurBg:        'bg-[#437c28]/10',
    spinnerColor:  'text-[#7cb960]',
    textActive:    'text-white',
  },
  sys3: {
    gradient:      'from-[#6d3fc0] to-[#4e2a9a]',
    borderActive:  'border-[#6d3fc0]/40',
    glow:          'shadow-[0_0_14px_rgba(109,63,192,0.45)]',
    borderIframe:  'border-[#6d3fc0]/25',
    blurBg:        'bg-[#6d3fc0]/10',
    spinnerColor:  'text-[#b49de0]',
    textActive:    'text-white',
  },
}

const FALLBACK_COLORS = {
  gradient:      'from-brand-accent to-brand-accent-dark',
  borderActive:  'border-brand-accent/40',
  glow:          'shadow-[0_0_14px_rgba(139,92,246,0.45)]',
  borderIframe:  'border-brand-accent/25',
  blurBg:        'bg-brand-accent/10',
  spinnerColor:  'text-brand-accent',
  textActive:    'text-white',
}

/* ─── Tab metadata ───────────────────────────────────────── */

const TABS: { key: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'monthly',   label: 'شهري',         icon: Calendar },
  { key: 'daily',     label: 'يومي',          icon: FileSpreadsheet },
  { key: 'lastMonth', label: 'الشهر الماضي', icon: Clock },
]

/* ─── Component ──────────────────────────────────────────── */

export default function PerformanceClient() {
  const [configs, setConfigs] = useState<SheetConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [activeSystemKey, setActiveSystemKey] = useState<string>('sys1')
  const [activeTab, setActiveTab] = useState<TabType>('monthly')
  const [iframeLoading, setIframeLoading] = useState(true)

  /* ── Fetch configs from Supabase ── */
  useEffect(() => {
    const fetchConfigs = async () => {
      setLoadingConfigs(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('analysis_sheets_config')
        .select('*')
        .order('system_key', { ascending: true })

      if (!error && data && data.length > 0) {
        setConfigs(data as SheetConfig[])
        // Default to first system returned
        setActiveSystemKey(data[0].system_key)
      }
      setLoadingConfigs(false)
    }
    fetchConfigs()
  }, [])

  /* ── Derived active config ── */
  const activeConfig = configs.find((c) => c.system_key === activeSystemKey) ?? configs[0]
  const activeColors = (activeConfig && SYSTEM_COLORS[activeConfig.system_key]) ?? FALLBACK_COLORS

  /* ── Build iframe URL ── */
  const getIframeUrl = () => {
    if (!activeConfig) return ''
    const gidMap: Record<TabType, string> = {
      monthly:   activeConfig.monthly_gid,
      daily:     activeConfig.daily_gid,
      lastMonth: activeConfig.last_month_gid,
    }
    const gid = gidMap[activeTab]
    return `${activeConfig.base_url}?single=true&widget=false&headers=false&chrome=false&gid=${gid}`
  }

  /* ── System change handler ── */
  const handleSystemChange = (key: string) => {
    if (key !== activeSystemKey) {
      setIframeLoading(true)
      setActiveSystemKey(key)
    }
  }

  /* ── Tab change handler ── */
  const handleTabChange = (tab: TabType) => {
    if (tab !== activeTab) {
      setIframeLoading(true)
      setActiveTab(tab)
    }
  }

  /* ── Safety timeout for iframe loader ── */
  useEffect(() => {
    const t = setTimeout(() => setIframeLoading(false), 12000)
    return () => clearTimeout(t)
  }, [activeSystemKey, activeTab])

  /* ──────────────────────────────────────────────────────── */
  /* Loading configs skeleton                                 */
  /* ──────────────────────────────────────────────────────── */
  if (loadingConfigs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-brand-accent/10 border border-brand-border flex items-center justify-center">
          <Database className="h-7 w-7 text-brand-accent animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-white">جاري تحميل إعدادات الأنظمة...</p>
        <p className="text-xs text-brand-dim">يتم جلب البيانات من قاعدة البيانات</p>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────── */
  /* No configs fallback                                      */
  /* ──────────────────────────────────────────────────────── */
  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-brand-error/10 border border-brand-error/20 flex items-center justify-center">
          <Database className="h-7 w-7 text-brand-error/60" />
        </div>
        <p className="text-sm font-semibold text-white">لا توجد إعدادات</p>
        <p className="text-xs text-brand-dim max-w-xs">
          لم يتم العثور على بيانات في جدول <code className="text-brand-accent font-mono">analysis_sheets_config</code>.
          يرجى إضافتها من صفحة الإعدادات.
        </p>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────── */
  /* Main render                                              */
  /* ──────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 w-full max-w-none relative z-10 animate-fade-in text-right">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5 dir-rtl">
            <FileSpreadsheet className="h-7 w-7 text-brand-accent" />
            <span>شيتات الانالسيز</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            عرض مباشر لشيتات تحليل الأداء المستوردة من Google Sheets لكافة الأنظمة.
          </p>
        </div>
      </div>

      {/* ── Unified Toolbar ── */}
      <div
        className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-brand-card border ${activeColors.borderActive} backdrop-blur-xl transition-all duration-300`}
      >
        {/* System pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {configs.map((cfg, idx) => {
            const colors = SYSTEM_COLORS[cfg.system_key] ?? FALLBACK_COLORS
            const isActive = cfg.system_key === activeSystemKey
            // Friendly short label: use system_label from DB, fallback to "System N"
            const shortLabel = cfg.system_label || `System ${idx + 1}`
            return (
              <button
                key={cfg.system_key}
                onClick={() => handleSystemChange(cfg.system_key)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all duration-250 cursor-pointer border whitespace-nowrap ${
                  isActive
                    ? `text-white bg-gradient-to-r ${colors.gradient} ${colors.borderActive} ${colors.glow} scale-[1.03]`
                    : 'text-white/70 bg-white/[0.04] hover:text-white hover:bg-white/[0.08] border-white/[0.12]'
                }`}
              >
                {shortLabel}
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-brand-border/50 mx-1 hidden sm:block" />

        {/* Tab pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-250 cursor-pointer border whitespace-nowrap ${
                  isActive
                    ? `text-white bg-gradient-to-r ${activeColors.gradient} ${activeColors.borderActive} ${activeColors.glow} scale-[1.03]`
                    : 'text-white/70 bg-white/[0.04] hover:text-white hover:bg-white/[0.08] border-white/[0.12]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Iframe Container ── */}
      <div
        className={`relative rounded-[20px] bg-brand-card border ${activeColors.borderIframe} backdrop-blur-xl p-1 shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-300`}
      >
        {/* Decorative glow blob */}
        <div
          className={`absolute -top-24 -left-24 w-52 h-52 ${activeColors.blurBg} rounded-full blur-[60px] pointer-events-none transition-all duration-300`}
        />

        {/* Loading overlay */}
        {iframeLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-brand-bg/85 backdrop-blur-md transition-opacity duration-300">
            <Loader2 className={`h-9 w-9 animate-spin ${activeColors.spinnerColor} mb-3 transition-colors duration-300`} />
            <p className="text-sm font-semibold text-white">جاري تحميل تقرير Google Sheets...</p>
            <p className="text-xs text-brand-dim mt-1">يرجى الانتظار لبضع ثوانٍ</p>
          </div>
        )}

        {/* Iframe */}
        <div className="w-full rounded-xl overflow-hidden bg-white relative">
          <iframe
            key={`${activeSystemKey}-${activeTab}`}
            src={getIframeUrl()}
            onLoad={() => setIframeLoading(false)}
            className="w-full h-[820px] border-0 rounded-lg shadow-sm bg-white block"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}
