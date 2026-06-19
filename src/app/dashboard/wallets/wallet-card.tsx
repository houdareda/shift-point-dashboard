/* eslint-disable */
'use client'

import { useState, useEffect, useTransition } from 'react'
import { Calendar, PhoneCall, TrendingUp, Edit2, Loader2, X, CheckCircle2, AlertCircle, Archive, Eye, EyeOff, ArchiveRestore } from 'lucide-react'
import WalletToggle from './wallet-toggle'
import { updateWalletBalanceAction, archiveWalletAction, restoreWalletAction } from '@/app/actions/wallets'
import { createClient } from '@/utils/supabase/client'

interface WalletCardProps {
  wallet: {
    id: string
    phone_number: string
    current_balance: number
    starting_balance: number
    is_active: boolean
    current_month_total: number
    created_at: string
    is_archived?: boolean
  }
}

export default function WalletCard({ wallet }: WalletCardProps) {
  const [localWallet, setLocalWallet] = useState(wallet)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [balanceInput, setBalanceInput] = useState(String(wallet.starting_balance || 0))
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isArchiving, setIsArchiving] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  // States for custom Archive Confirmation Modal
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [archivePassword, setArchivePassword] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [showArchivePassword, setShowArchivePassword] = useState(false)

  useEffect(() => {
    setLocalWallet(wallet)
    setBalanceInput(String(wallet.starting_balance || 0))
  }, [wallet])

  useEffect(() => {
    if (!wallet.id) return

    const supabase = createClient()

    const channel = supabase
      .channel(`wallet-updates-${wallet.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `id=eq.${wallet.id}`
        },
        (payload) => {
          console.log('Realtime wallet update received:', payload.new)
          const updated = payload.new
          setLocalWallet((prev) => ({
            ...prev,
            current_balance: Number(updated.current_balance),
            starting_balance: Number(updated.starting_balance),
            is_active: updated.is_active,
            is_archived: updated.is_archived,
          }))
          setBalanceInput(String(updated.starting_balance || 0))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [wallet.id])

  const addedDate = new Date(wallet.created_at).toLocaleDateString('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleUpdateBalance = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const val = parseFloat(balanceInput)
    if (isNaN(val) || val < 0) {
      setError('يرجى إدخال مبلغ صحيح (0 أو أكثر)')
      return
    }

    if (val > 200000) {
      setError('تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)')
      return
    }

    startTransition(async () => {
      const result = await updateWalletBalanceAction(localWallet.id, val)
      if (result.success) {
        setIsEditOpen(false)
      } else {
        setError(result.error || 'حدث خطأ أثناء تحديث الرصيد.')
      }
    })
  }

  const handleOpenArchiveModal = () => {
    setArchivePassword('')
    setArchiveError('')
    setShowArchivePassword(false)
    setIsArchiveModalOpen(true)
  }

  const handleArchiveSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setArchiveError('')

    if (!archivePassword) {
      setArchiveError('يرجى إدخال كلمة المرور لتأكيد الأرشفة.')
      return
    }

    setIsArchiving(true)
    startTransition(async () => {
      const res = await archiveWalletAction(localWallet.id, archivePassword)
      setIsArchiving(false)
      if (res.success) {
        setIsArchiveModalOpen(false)
      } else {
        setArchiveError(res.error || 'حدث خطأ أثناء أرشفة المحفظة.')
      }
    })
  }

  const handleRestore = () => {
    setIsRestoring(true)
    startTransition(async () => {
      const res = await restoreWalletAction(localWallet.id)
      setIsRestoring(false)
      if (!res.success) {
        alert(res.error || "حدث خطأ أثناء استعادة المحفظة.")
      }
    })
  }

  return (
    <>
      <div
        className={`group relative rounded-[20px] bg-brand-card border border-brand-border p-5 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.2)] overflow-hidden ${
          localWallet.is_archived
            ? 'opacity-40 grayscale pointer-events-auto hover:opacity-70'
            : localWallet.is_active === false
            ? 'opacity-50 hover:opacity-90 hover:border-brand-accent/30 hover:shadow-[0_4px_24px_rgba(139,92,246,0.08)]'
            : 'hover:border-brand-accent/30 hover:shadow-[0_4px_24px_rgba(139,92,246,0.08)]'
        }`}
      >
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-brand-accent/5 rounded-full blur-[20px] pointer-events-none group-hover:bg-brand-accent/10 transition-colors duration-300" />
        
        <div className="flex items-start justify-between gap-4">
          {/* Interactive Status Toggle and Archive/Restore button */}
          <div className="flex items-center gap-2">
            <WalletToggle 
              walletId={localWallet.id} 
              isActive={localWallet.is_active !== false} 
              disabled={localWallet.is_archived === true} 
            />
            {localWallet.is_archived ? (
              <button
                type="button"
                onClick={handleRestore}
                className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-brand-dim hover:text-emerald-400 transition-all duration-300 cursor-pointer"
                title="استعادة المحفظة"
                disabled={isRestoring || isPending}
              >
                {isRestoring ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenArchiveModal}
                className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-red-500/10 hover:border-red-500/30 text-brand-dim hover:text-red-400 transition-all duration-300 cursor-pointer"
                title="أرشفة المحفظة"
                disabled={isArchiving || isPending}
              >
                {isArchiving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end mb-1">
                <button
                  onClick={() => {
                    if (localWallet.is_archived) return
                    setBalanceInput(String(localWallet.starting_balance || 0))
                    setError('')
                    setIsEditOpen(true)
                  }}
                  disabled={localWallet.is_archived}
                  className={`p-1 rounded-md bg-white/[0.02] border border-white/[0.05] hover:bg-brand-accent/15 hover:border-brand-accent/30 text-brand-dim hover:text-white transition-all duration-300 ${
                    localWallet.is_archived ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                  }`}
                  title="تعديل رصيد أول الشهر"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <p className="text-xs font-semibold text-brand-dim">رقم المحفظة</p>
              </div>
              <p className="text-base font-bold text-white font-mono tracking-wider dir-ltr select-all">
                {localWallet.phone_number}
              </p>
            </div>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.06] text-brand-accent group-hover:bg-brand-accent/10 transition-colors duration-300">
              <PhoneCall className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Display Starting Balance Prominently */}
        <div className="my-4 py-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
          <span className="text-sm font-bold text-brand-accent font-mono">
            {Number(localWallet.starting_balance || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ج.م
          </span>
          <span className="text-xs font-semibold text-brand-dim">رصيد أول الشهر</span>
        </div>

        <div className="mt-4 pt-4 border-t border-brand-border flex items-center justify-between text-[11px] text-brand-dim">
          {/* Date */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{addedDate}</span>
          </div>

          {/* Current Balance */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/15">
              {Number(localWallet.current_balance || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ج.م
            </span>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span>الرصيد الحالي</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Balance Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-brand-card border border-brand-border rounded-[28px] p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden text-right">
            <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="p-1 rounded-lg hover:bg-white/5 text-brand-dim hover:text-white transition-all cursor-pointer"
                disabled={isPending}
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-base font-bold text-white">تعديل رصيد أول الشهر</h3>
            </div>

            <p className="text-xs text-brand-dim leading-relaxed mb-6">
              تحديث رصيد أول الشهر لمحفظة كاش ذات الرقم <span className="text-white font-mono">{localWallet.phone_number}</span>.
            </p>

            <form onSubmit={handleUpdateBalance} className="space-y-5">
              {error && (
                <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/25 text-brand-error text-xs font-semibold flex items-center gap-2 animate-pulse justify-end">
                  <span>{error}</span>
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="modalBalanceInput" className="block text-xs font-bold text-brand-dim">
                  رصيد أول الشهر (ج.م)
                </label>
                <input
                  type="number"
                  id="modalBalanceInput"
                  dir="ltr"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  disabled={isPending}
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 px-4 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left font-mono"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>حفظ التعديل</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Archive Wallet Modal */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in text-right">
          <div className="w-full max-w-sm bg-brand-card border border-brand-border rounded-[28px] p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-red-500/5 rounded-full blur-[50px] pointer-events-none" />

            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06] dir-rtl">
              <button
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/5 text-brand-dim hover:text-white transition-all cursor-pointer"
                disabled={isArchiving || isPending}
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-base font-bold text-white">أرشفة المحفظة الكاش</h3>
            </div>

            <p className="text-xs text-brand-dim leading-relaxed mb-6">
              هل أنت متأكد من أرشفة محفظة الكاش ذات الرقم <span className="text-white font-mono">{localWallet.phone_number}</span>؟
              <br />
              <span className="text-brand-error/90 block mt-2 font-semibold text-[11px]">
                تنبيه: بعد الأرشفة، لن تظهر هذه المحفظة مجدداً في خياراتك.
              </span>
            </p>

            <form onSubmit={handleArchiveSubmit} className="space-y-5">
              {archiveError && (
                <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/25 text-brand-error text-xs font-semibold flex items-center gap-2 animate-pulse justify-end">
                  <span>{archiveError}</span>
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="archivePasswordInput" className="block text-xs font-bold text-brand-dim">
                  كلمة مرور الحساب لتأكيد الأرشفة
                </label>
                <div className="relative">
                  <input
                    type={showArchivePassword ? 'text' : 'password'}
                    id="archivePasswordInput"
                    dir="ltr"
                    required
                    placeholder="أدخل كلمة المرور الخاصة بك"
                    value={archivePassword}
                    onChange={(e) => setArchivePassword(e.target.value)}
                    disabled={isArchiving || isPending}
                    className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-11 pr-4 text-white placeholder:text-white/20 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 focus:outline-none transition-all duration-300 text-sm dir-ltr text-left placeholder:text-right"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowArchivePassword(!showArchivePassword)}
                    className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/30 hover:text-white/60 transition-colors"
                    disabled={isArchiving || isPending}
                  >
                    {showArchivePassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isArchiving || isPending}
                  className="flex-1 flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isArchiving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جاري الأرشفة...</span>
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      <span>تأكيد الأرشفة</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  disabled={isArchiving || isPending}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-brand-dim bg-white/[0.02] border border-white/[0.06] hover:bg-white/5 hover:text-white transition-all duration-300 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
