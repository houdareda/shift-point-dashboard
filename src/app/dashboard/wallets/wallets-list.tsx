'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import WalletCard from './wallet-card'
import { Wallet as WalletIcon } from 'lucide-react'

interface Wallet {
  id: string
  phone_number: string
  current_balance: number
  starting_balance: number
  is_active: boolean
  current_month_total: number
  created_at: string
}

interface WalletsListProps {
  initialWallets: Wallet[]
  currentAgentId: string
}

export default function WalletsList({ initialWallets, currentAgentId }: WalletsListProps) {
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets)

  useEffect(() => {
    setWallets(initialWallets)
  }, [initialWallets])

  useEffect(() => {
    if (!currentAgentId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`agent-wallets-list-${currentAgentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wallets',
          filter: `agent_id=eq.${currentAgentId}`
        },
        (payload) => {
          console.log('Realtime wallets list INSERT received:', payload.new)
          setWallets((prev) => {
            if (prev.some((w) => w.id === payload.new.id)) return prev
            return [payload.new as Wallet, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `agent_id=eq.${currentAgentId}`
        },
        (payload) => {
          console.log('Realtime wallets list UPDATE received:', payload.new)
          setWallets((prev) =>
            prev.map((w) => (w.id === payload.new.id ? { ...w, ...payload.new } : w))
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'wallets'
        },
        (payload) => {
          console.log('Realtime wallets list DELETE received:', payload.old)
          setWallets((prev) => prev.filter((w) => w.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentAgentId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent font-mono">
          {wallets.length} محفظة مضافة
        </span>
        <h3 className="text-base font-bold text-white text-right">قائمة المحافظ الحالية</h3>
      </div>

      {wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[24px] bg-brand-card/30 border border-brand-border/50 border-dashed p-12 text-center relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand-accent/5 rounded-full blur-[40px] pointer-events-none" />
          <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.06] text-white/30 mb-5">
            <WalletIcon className="h-8 w-8" />
          </div>
          <h4 className="text-base font-bold text-white mb-2">لا توجد محافظ مضافة حالياً</h4>
          <p className="text-xs text-brand-dim max-w-sm leading-relaxed">
            لم تقم بإضافة أي محفظة كاش حتى الآن. استخدم النموذج الموجود لإضافة رقم محفظتك الأولى لبدء المعاملات.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} />
          ))}
        </div>
      )}
    </div>
  )
}
