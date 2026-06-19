/* eslint-disable */
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import WalletCard from './wallet-card'
import { Wallet as WalletIcon, ChevronDown, ChevronUp } from 'lucide-react'

interface Wallet {
  id: string
  phone_number: string
  current_balance: number
  starting_balance: number
  is_active: boolean
  current_month_total: number
  created_at: string
  is_archived?: boolean
}

interface WalletsListProps {
  initialWallets: Wallet[]
  currentAgentId: string
}

export default function WalletsList({ initialWallets, currentAgentId }: WalletsListProps) {
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets)
  const [showArchived, setShowArchived] = useState(false)

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
            const newW = payload.new as Wallet
            if (prev.some((w) => w.id === newW.id)) return prev
            return [newW, ...prev]
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

  const activeWallets = wallets.filter((w) => !w.is_archived)
  const archivedWallets = wallets.filter((w) => w.is_archived)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent font-mono">
          {activeWallets.length} محفظة مضافة
        </span>
        <h3 className="text-base font-bold text-white text-right">قائمة المحافظ الحالية</h3>
      </div>

      {activeWallets.length === 0 ? (
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
          {activeWallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} />
          ))}
        </div>
      )}

      {/* Collapsible Archived Wallets Section */}
      <div className="mt-8 pt-6 border-t border-brand-border/40 text-right">
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          className="w-full flex items-center justify-between py-3.5 px-5 rounded-2xl bg-white/[0.01] border border-white/[0.05] hover:bg-white/[0.03] transition-all duration-300 font-bold text-sm text-brand-dim hover:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            {showArchived ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-white/5 border border-white/[0.04]">
              {archivedWallets.length}
            </span>
          </div>
          <span className="flex items-center gap-2">المحافظ المؤرشفة 🗄️</span>
        </button>

        {showArchived && (
          <div className="mt-5 animate-fade-in">
            {archivedWallets.length === 0 ? (
              <div className="text-center py-8 text-xs text-brand-dim rounded-2xl bg-white/[0.01] border border-dashed border-white/[0.04]">
                لا توجد محافظ مؤرشفة حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {archivedWallets.map((wallet) => (
                  <WalletCard key={wallet.id} wallet={wallet} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
