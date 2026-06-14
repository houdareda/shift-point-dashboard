'use client'

import { useActionState, useEffect, startTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addWalletAction } from '@/app/actions/wallets'
import { Plus, Loader2, Phone } from 'lucide-react'

// Zod Schema for client-side phone number and balance validation
const walletSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'رقم الهاتف مطلوب')
    .regex(/^01[0125]\d{8}$/, 'يجب أن يكون رقم هاتف مصري صحيح مكون من 11 رقماً ويبدأ بـ 01'),
  currentBalance: z.coerce
    .number()
    .min(0, 'يجب أن يكون الرصيد 0 أو أكثر'),
})

type WalletSchema = z.infer<typeof walletSchema>

export default function WalletForm() {
  const [state, dispatch, pending] = useActionState(addWalletAction, null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors: clientErrors },
  } = useForm<WalletSchema>({
    resolver: zodResolver(walletSchema) as any,
    defaultValues: {
      phoneNumber: '',
      currentBalance: '' as unknown as number,
    },
  })

  // Reset form upon successful wallet insertion or set server validation errors
  useEffect(() => {
    if (state?.success) {
      reset({
        phoneNumber: '',
        currentBalance: '' as unknown as number,
      })
    } else if (state?.errors?.phoneNumber) {
      setError('phoneNumber', {
        type: 'server',
        message: state.errors.phoneNumber[0],
      })
    } else if (state?.errors?.currentBalance) {
      setError('currentBalance', {
        type: 'server',
        message: state.errors.currentBalance[0],
      })
    }
  }, [state, reset, setError])

  const onSubmit = (data: WalletSchema) => {
    const formData = new FormData()
    formData.append('phoneNumber', data.phoneNumber)
    formData.append('currentBalance', String(data.currentBalance))
    startTransition(() => {
      dispatch(formData)
    })
  }

  return (
    <div className="w-full rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
      <div className="absolute -top-[100px] -right-[100px] w-[200px] h-[200px] bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />

      <h3 className="text-lg font-bold text-white mb-2 text-right">إضافة محفظة جديدة</h3>
      <p className="text-xs text-brand-dim mb-6 text-right leading-relaxed">
        أدخل رقم الهاتف المرتبط بالمحفظة الإلكترونية لإضافتها إلى قائمتك.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* General server error */}
        {state?.error && (
          <div className="p-3.5 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-xs text-right animate-pulse">
            {state.error}
          </div>
        )}

        {/* General success message */}
        {state?.success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-right">
            تمت إضافة المحفظة بنجاح!
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
          {/* Phone Number Field */}
          <div className="space-y-2">
            <label htmlFor="phoneNumber" className="block text-xs font-semibold text-brand-dim">
              رقم الهاتف للمحفظة
            </label>
            <div className="relative">
              <input
                type="text"
                id="phoneNumber"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 text-left dir-ltr focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm font-mono tracking-wider"
                {...register('phoneNumber')}
                disabled={pending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <Phone className="h-4.5 w-4.5" />
              </div>
            </div>
            {clientErrors.phoneNumber && (
              <p className="text-[11px] text-brand-error mt-1 font-medium animate-fade-in">
                {clientErrors.phoneNumber.message}
              </p>
            )}
          </div>

          {/* Current Balance Field */}
          <div className="space-y-2">
            <label htmlFor="currentBalance" className="block text-xs font-semibold text-brand-dim">
              الرصيد الحالي للمحفظة (ج.م)
            </label>
            <div className="relative">
              <input
                type="number"
                id="currentBalance"
                dir="ltr"
                step="0.01"
                required
                placeholder="0.00"
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 text-left dir-ltr focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300 text-sm font-mono"
                {...register('currentBalance')}
                disabled={pending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            {clientErrors.currentBalance && (
              <p className="text-[11px] text-brand-error mt-1 font-medium animate-fade-in">
                {clientErrors.currentBalance.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent shadow-[0_0_15px_rgba(139,92,246,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 cursor-pointer"
          >
            {pending ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>جاري الإضافة...</span>
              </>
            ) : (
              <>
                <Plus className="h-4.5 w-4.5" />
                <span>إضافة محفظة</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
