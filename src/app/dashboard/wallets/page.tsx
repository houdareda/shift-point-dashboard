/* eslint-disable */
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import WalletForm from './wallet-form'
import { Wallet as WalletIcon } from 'lucide-react'
import WalletsList from './wallets-list'

// Server Component for Wallets Management Page
export default async function WalletsPage() {
  const supabase = await createClient()

  // Retrieve current user details on the server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Retrieve current user's role to verify permissions
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role?.toLowerCase() || 'agent'
  if (userRole === 'accountant') {
    redirect('/dashboard')
  }

  const { data: wallets, error: walletsError } = await supabase
    .from('wallets')
    .select('*')
    .eq('agent_id', user.id)
    .order('created_at', { ascending: false })

  if (walletsError) {
    console.error('Error fetching wallets:', walletsError)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative z-10 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div className="text-right">
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-start gap-2.5">
            <WalletIcon className="h-7 w-7 text-brand-accent" />
            <span>إدارة المحافظ الإلكترونية</span>
          </h1>
          <p className="mt-2 text-sm text-brand-dim leading-relaxed">
            أضف وتابع أرقام محافظ الكاش الخاصة بك لمتابعة إيراداتك ومصروفاتك الشهرية.
          </p>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Right Column: Wallet Creation Form (Client Component) */}
        <div className="lg:col-span-1 lg:sticky lg:top-24">
          <WalletForm />
        </div>

        {/* Left Column: Wallets List */}
        <div className="lg:col-span-2 space-y-6">
          {walletsError ? (
            <div className="p-4 rounded-2xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm text-right">
              حدث خطأ أثناء جلب قائمة المحافظ الخاصة بك. يرجى إعادة تحميل الصفحة.
            </div>
          ) : (
            <WalletsList initialWallets={(wallets as any) || []} currentAgentId={user.id} />
          )}
        </div>
      </div>
    </div>
  )
}
