'use client'

import { useTransition } from 'react'
import { toggleWalletStatusAction } from '@/app/actions/wallets'
import { Loader2 } from 'lucide-react'

interface WalletToggleProps {
  walletId: string
  isActive: boolean
  disabled?: boolean
}

export default function WalletToggle({ walletId, isActive, disabled = false }: WalletToggleProps) {
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    if (disabled) return
    startTransition(async () => {
      const result = await toggleWalletStatusAction(walletId, isActive)
      if (!result.success) {
        alert(result.error || 'حدث خطأ أثناء تغيير حالة المحفظة.')
      }
    })
  }

  return (
    <div className="flex items-center gap-2.5">
      {/* Status Label */}
      <span className={`text-[10px] font-bold tracking-wide transition-colors duration-300 ${
        isActive ? 'text-emerald-400' : 'text-brand-dim'
      }`}>
        {isActive ? 'نشطة' : 'موقوفة'}
      </span>

      {/* Switch Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending || disabled}
        dir="ltr"
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-brand-glow/30 focus:ring-offset-1 focus:ring-offset-brand-bg disabled:opacity-50 ${
          disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
        } ${
          isActive ? 'bg-brand-accent' : 'bg-white/10'
        }`}
      >
        <span className="sr-only">تغيير حالة المحفظة</span>
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-all duration-300 flex items-center justify-center ${
            isActive ? 'translate-x-6' : 'translate-x-1'
          }`}
        >
          {isPending && <Loader2 className="h-2.5 w-2.5 animate-spin text-brand-accent" />}
        </span>
      </button>
    </div>
  )
}
