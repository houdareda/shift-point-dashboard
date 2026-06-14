'use client'

import { AlertOctagon, LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SuspendedPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-4 relative overflow-hidden text-right font-cairo">
      {/* Decorative gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-brand-error/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-brand-error/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[460px] px-4 z-10">
        <div className="relative w-full rounded-[24px] bg-brand-card border border-brand-border/60 backdrop-blur-xl p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col items-center text-center">
          
          {/* Warning Icon Badge */}
          <div className="w-16 h-16 rounded-[20px] bg-brand-error/10 border border-brand-error/25 flex items-center justify-center mb-6 text-brand-error animate-bounce">
            <AlertOctagon className="h-8 w-8" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-black text-white tracking-tight">
            تم إيقاف الحساب مؤقتاً
          </h1>

          {/* Description */}
          <p className="mt-4 text-sm text-brand-dim leading-relaxed max-w-sm">
            حسابك الشخصي موقوف حالياً بقرار من إدارة النظام. لا يمكنك تصفح لوحة التحكم أو إرسال وتلقي أي طلبات في الوقت الحالي.
          </p>

          <p className="mt-2 text-xs text-brand-dim/80 leading-relaxed border-t border-white/[0.04] pt-4 w-full">
            إذا كنت تعتقد أن هذا الإيقاف تم بالخطأ، يرجى التواصل مع المدير المسؤول عن المنصة لإعادة تفعيل الحساب.
          </p>

          {/* Action Button */}
          <button
            onClick={handleLogout}
            disabled={loading}
            className="mt-8 w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-white/[0.06] rounded-xl text-sm font-bold text-white bg-white/[0.02] hover:bg-white/[0.06] hover:text-brand-error hover:border-brand-error/20 transition-all duration-300 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <>
                <LogOut className="h-4.5 w-4.5" />
                <span>تسجيل الخروج والعودة</span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  )
}
