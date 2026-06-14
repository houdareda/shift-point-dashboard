'use client'

import { useState, useTransition } from 'react'
import { auditWalletsAction } from '@/app/actions/operations'
import { Wallet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface AuditModalProps {
  isOpen: boolean
  wallets: Array<{ id: string; phone_number: string }>
  onSuccess: () => void
}

export default function AuditModal({ isOpen, wallets, onSuccess }: AuditModalProps) {
  const [isPending, startTransition] = useTransition()
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleInputChange = (walletId: string, val: string) => {
    setBalances((prev) => ({
      ...prev,
      [walletId]: val,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate all wallets have an input
    const balanceInputs = wallets.map((w) => {
      const val = balances[w.id]
      return {
        walletId: w.id,
        balance: val === '' || val === undefined ? 0 : parseFloat(val),
      }
    })

    startTransition(async () => {
      const res = await auditWalletsAction(balanceInputs)
      if (res.success) {
        onSuccess()
      } else {
        setError(res.error || 'حدث خطأ أثناء حفظ أرصدة المحافظ.')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-brand-card border border-brand-border rounded-[28px] p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden text-right">
        <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-white/[0.06]">
          <div className="w-10 h-10 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">التدقيق المالي الشهري للمحافظ</h3>
            <span className="text-[10px] text-brand-dim mt-0.5 block">يرجى تحديث أرصدة محافظك الحالية لإتمام العملية.</span>
          </div>
        </div>

        <p className="text-xs text-brand-dim leading-relaxed mb-6">
          قواعد النظام المالي تتطلب تدقيق أرصدة جميع المحافظ النشطة في بداية كل شهر جديد. يرجى إدخال الرصيد الفعلي الحالي في كل محفظة من المحافظ التالية لتتمكن من متابعة عملياتك اليومية:
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/25 text-brand-error text-xs font-semibold flex items-center gap-2 animate-pulse">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
            {wallets.map((w) => (
              <div key={w.id} className="space-y-2">
                <label htmlFor={`balance-${w.id}`} className="block text-xs font-bold text-brand-dim">
                  الرصيد الفعلي لمحفظة <span className="text-white direction-ltr inline-block">{w.phone_number}</span> (ج.م)
                </label>
                <input
                  type="number"
                  id={`balance-${w.id}`}
                  dir="ltr"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={balances[w.id] || ''}
                  onChange={(e) => handleInputChange(w.id, e.target.value)}
                  disabled={isPending}
                  className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3 px-4 text-white placeholder:text-white/20 focus:border-brand-accent focus:ring-1 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-xs dir-ltr text-left"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري حفظ وتأكيد الأرصدة...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>حفظ وتأكيد أرصدة المحافظ</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
