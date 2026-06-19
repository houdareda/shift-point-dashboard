'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  Settings,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Link2,
  Hash,
  Database,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import type { AnalysisSheetConfig } from './page'

interface AnalysisSettingsClientProps {
  initialConfigs: AnalysisSheetConfig[]
  profileName: string
}

type ToastType = 'success' | 'error'

interface Toast {
  id: number
  type: ToastType
  message: string
}

// Colour palette per system
const SYSTEM_THEME: Record<string, {
  accent: string
  border: string
  bg: string
  glow: string
  badge: string
}> = {
  sys1: {
    accent: 'text-[#3451b2]',
    border: 'border-[#3451b2]/30',
    bg: 'bg-[#3451b2]/10',
    glow: 'shadow-[0_0_20px_rgba(52,81,178,0.15)]',
    badge: 'bg-[#3451b2]/20 text-[#748fe0] border-[#3451b2]/30',
  },
  sys2: {
    accent: 'text-[#437c28]',
    border: 'border-[#437c28]/30',
    bg: 'bg-[#437c28]/10',
    glow: 'shadow-[0_0_20px_rgba(67,124,40,0.15)]',
    badge: 'bg-[#437c28]/20 text-[#7cb960] border-[#437c28]/30',
  },
  sys3: {
    accent: 'text-[#7c5cbf]',
    border: 'border-[#7c5cbf]/30',
    bg: 'bg-[#7c5cbf]/10',
    glow: 'shadow-[0_0_20px_rgba(124,92,191,0.15)]',
    badge: 'bg-[#7c5cbf]/20 text-[#b49de0] border-[#7c5cbf]/30',
  },
}

const DEFAULT_THEME = {
  accent: 'text-brand-accent',
  border: 'border-brand-accent/30',
  bg: 'bg-brand-accent/10',
  glow: 'shadow-[0_0_20px_rgba(139,92,246,0.15)]',
  badge: 'bg-brand-accent/20 text-brand-accent border-brand-accent/30',
}

const FIELD_META: Array<{
  key: keyof AnalysisSheetConfig
  label: string
  placeholder: string
  icon: React.ComponentType<{ className?: string }>
  fullWidth?: boolean
}> = [
  {
    key: 'base_url',
    label: 'رابط الشيت الأساسي (base_url)',
    placeholder: 'https://docs.google.com/spreadsheets/d/e/...',
    icon: Link2,
    fullWidth: true,
  },
  {
    key: 'monthly_gid',
    label: 'معرّف التقرير الشهري (monthly_gid)',
    placeholder: 'مثال: 1002850612',
    icon: Hash,
  },
  {
    key: 'daily_gid',
    label: 'معرّف الأداء اليومي (daily_gid)',
    placeholder: 'مثال: 443367812',
    icon: Hash,
  },
  {
    key: 'last_month_gid',
    label: 'معرّف الشهر الماضي (last_month_gid)',
    placeholder: 'مثال: 1015706660',
    icon: Hash,
  },
]

let toastCounter = 0

export default function AnalysisSettingsClient({
  initialConfigs,
  profileName,
}: AnalysisSettingsClientProps) {
  // Local editable copy of configs
  const [configs, setConfigs] = useState<AnalysisSheetConfig[]>(initialConfigs)
  // Tracks the last-saved snapshot — updated after each successful save
  const [savedConfigs, setSavedConfigs] = useState<AnalysisSheetConfig[]>(initialConfigs)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const handleFieldChange = (systemKey: string, field: keyof AnalysisSheetConfig, value: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.system_key === systemKey ? { ...c, [field]: value } : c))
    )
  }

  const handleSave = async (config: AnalysisSheetConfig) => {
    setSaving((prev) => ({ ...prev, [config.system_key]: true }))
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('analysis_sheets_config')
        .update({
          base_url: config.base_url,
          monthly_gid: config.monthly_gid,
          daily_gid: config.daily_gid,
          last_month_gid: config.last_month_gid,
        })
        .eq('system_key', config.system_key)

      if (error) {
        console.error('[AnalysisSettings] Supabase update error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        throw error
      }

      // ✅ Update the saved snapshot so isDirty resets immediately
      setSavedConfigs((prev) =>
        prev.map((c) => (c.system_key === config.system_key ? { ...config } : c))
      )
      addToast('success', `✅ تم حفظ إعدادات ${config.system_label} بنجاح!`)
    } catch (err: unknown) {
      console.error('[AnalysisSettings] handleSave caught:', err)
      let msg = 'حدث خطأ غير متوقع'
      if (err instanceof Error) {
        msg = err.message
      } else if (err && typeof err === 'object' && 'message' in err) {
        msg = String((err as { message: unknown }).message)
      }
      addToast('error', `❌ فشل الحفظ: ${msg}`)
    } finally {
      setSaving((prev) => ({ ...prev, [config.system_key]: false }))
    }
  }

  const handleSaveAll = async () => {
    for (const config of configs) {
      await handleSave(config)
    }
  }

  const getPreviewUrl = (config: AnalysisSheetConfig) => {
    if (!config.base_url || !config.monthly_gid) return null
    return `${config.base_url}?single=true&widget=false&headers=false&chrome=false&gid=${config.monthly_gid}`
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto relative z-10 animate-fade-in text-right" dir="rtl">

      {/* Toast Notifications */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none" style={{ minWidth: 320 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl pointer-events-auto transition-all duration-500 animate-fade-in ${
              toast.type === 'success'
                ? 'bg-emerald-900/80 border-emerald-500/30 text-emerald-300'
                : 'bg-red-900/80 border-red-500/30 text-red-300'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0 text-red-400" />
            )}
            <p className="text-sm font-semibold flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5">
            <Settings className="h-7 w-7 text-brand-accent animate-pulse" />
            <span>إعدادات شيتات التحليل</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            مرحباً <span className="text-white font-semibold">{profileName}</span>، قم بتعديل روابط ومعرّفات Google Sheets لكل نظام تسويقي بشكل مستقل.
          </p>
        </div>

        {/* Save All Button */}
        {configs.length > 0 && (
          <button
            onClick={handleSaveAll}
            disabled={Object.values(saving).some(Boolean)}
            className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark border border-brand-accent/30 shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {Object.values(saving).some(Boolean) ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <RefreshCw className="h-4.5 w-4.5" />
            )}
            <span>حفظ الكل دفعة واحدة</span>
          </button>
        )}
      </div>

      {/* No Data State */}
      {configs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-accent/10 border border-brand-border flex items-center justify-center mb-4">
            <Database className="h-8 w-8 text-brand-accent/60" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">لا توجد بيانات</h2>
          <p className="text-sm text-brand-dim max-w-sm">
            لم يتم العثور على أي سجلات في جدول <code className="text-brand-accent font-mono">analysis_sheets_config</code>. يُرجى إضافة البيانات عبر Supabase أولاً.
          </p>
        </div>
      )}

      {/* Config Cards */}
      <div className="space-y-8">
        {configs.map((config, index) => {
          const theme = SYSTEM_THEME[config.system_key] ?? DEFAULT_THEME
          const isSaving = saving[config.system_key] ?? false
          const previewUrl = getPreviewUrl(config)
          const originalConfig = savedConfigs.find((c) => c.system_key === config.system_key)
          const isDirty = JSON.stringify(config) !== JSON.stringify(originalConfig)

          return (
            <div
              key={config.system_key}
              className={`relative group rounded-[28px] bg-brand-card border ${theme.border} backdrop-blur-xl p-7 md:p-8 transition-all duration-300 ${theme.glow} overflow-hidden`}
            >
              {/* Decorative blur blob */}
              <div
                className={`absolute -top-20 -right-20 w-48 h-48 ${theme.bg} rounded-full blur-[60px] pointer-events-none opacity-60 transition-opacity duration-500 group-hover:opacity-100`}
              />

              {/* Card Header */}
              <div className="flex items-center justify-between mb-7 relative">
                <div className="flex items-center gap-4">
                  {/* Index Badge */}
                  <div className={`flex items-center justify-center w-11 h-11 rounded-2xl border text-lg font-extrabold ${theme.bg} ${theme.border} ${theme.accent}`}>
                    {index + 1}
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-white leading-tight">
                      {config.system_label || config.system_key}
                    </h2>
                    <span className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${theme.badge}`}>
                      {config.system_key}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Dirty Indicator */}
                  {isDirty && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-500/20 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      تغييرات غير محفوظة
                    </span>
                  )}

                  {/* Preview Link */}
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="فتح الشيت في نافذة جديدة"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-brand-dim hover:text-white bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-all duration-200 cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>معاينة</span>
                    </a>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={() => handleSave(config)}
                    disabled={isSaving}
                    id={`save-btn-${config.system_key}`}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white border transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      isDirty
                        ? `${theme.bg} ${theme.border} hover:scale-[1.03] active:scale-[0.97]`
                        : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                  </button>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative">
                {FIELD_META.map((field) => (
                  <div
                    key={`${config.system_key}-${field.key}`}
                    className={`space-y-2 ${field.fullWidth ? 'md:col-span-2' : ''}`}
                  >
                    <label
                      htmlFor={`${config.system_key}-${field.key}`}
                      className="block text-xs font-semibold text-brand-dim"
                    >
                      {field.label}
                    </label>
                    <div className="relative">
                      <field.icon className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-dim/60 pointer-events-none" />
                      <input
                        id={`${config.system_key}-${field.key}`}
                        type="text"
                        dir="ltr"
                        value={(config[field.key] as string) || ''}
                        onChange={(e) =>
                          handleFieldChange(config.system_key, field.key, e.target.value)
                        }
                        placeholder={field.placeholder}
                        className={`block w-full rounded-xl bg-white/[0.02] border border-white/[0.07] py-3.5 pr-10 pl-4 text-white text-sm placeholder:text-white/20 focus:outline-none transition-all duration-200 font-mono ${
                          isDirty && (config[field.key] !== originalConfig?.[field.key])
                            ? 'border-amber-500/20 focus:border-amber-500/50'
                            : `focus:${theme.border}`
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom CTA */}
      {configs.length > 1 && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleSaveAll}
            disabled={Object.values(saving).some(Boolean)}
            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark border border-brand-accent/30 shadow-[0_0_30px_rgba(139,92,246,0.2)] hover:shadow-[0_0_45px_rgba(139,92,246,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {Object.values(saving).some(Boolean) ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            <span>حفظ جميع التعديلات ({configs.length} أنظمة)</span>
          </button>
        </div>
      )}
    </div>
  )
}
