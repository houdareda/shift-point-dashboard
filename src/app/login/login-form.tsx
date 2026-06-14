'use client'

import { useActionState, useState } from 'react'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { signInAction } from '@/app/actions/auth'

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, null)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="w-full max-w-[440px] px-4">
      {/* Glow effect in background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-brand-accent/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full rounded-[24px] bg-brand-card border border-brand-border backdrop-blur-xl p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight text-center flex items-center justify-center gap-1.5 mt-2">
          <span className="text-white">Shift</span>
          <span className="text-brand-accent">Point</span>
        </h1>

        <p className="mt-3 text-sm text-center text-brand-dim leading-relaxed">
          أدخل بيانات الاعتماد الخاصة بك للوصول إلى لوحة التحكم
        </p>

        {/* Form */}
        <form action={formAction} className="mt-8 space-y-6">
          {/* General Error Message */}
          {state?.errors?.form && (
            <div className="p-3.5 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm text-right">
              {state.errors.form[0]}
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-brand-dim text-right">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                type="email"
                name="email"
                id="email"
                dir="ltr"
                required
                placeholder="name@company.com"
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-4 pr-11 text-white placeholder:text-white/20 text-left dir-ltr focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300"
                suppressHydrationWarning
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <Mail className="h-5 w-5" />
              </div>
            </div>
            {state?.errors?.email && (
              <p className="text-xs text-brand-error text-right mt-1">
                {state.errors.email[0]}
              </p>
            )}
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-brand-dim text-right">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                id="password"
                dir="ltr"
                required
                placeholder="أدخل كلمة المرور الخاصة بك"
                className="block w-full rounded-xl bg-white/[0.02] border border-white/[0.08] py-3.5 pl-11 pr-11 text-white placeholder:text-white/20 text-left placeholder:text-right dir-ltr focus:border-brand-accent focus:ring-2 focus:ring-brand-glow/30 focus:outline-none transition-all duration-300"
                suppressHydrationWarning
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-white/30">
                <Lock className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-white/30 hover:text-white/60 transition-colors"
                suppressHydrationWarning
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {state?.errors?.password && (
              <p className="text-xs text-brand-error text-right mt-1">
                {state.errors.password[0]}
              </p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                className="h-4.5 w-4.5 rounded border-white/10 bg-white/5 text-brand-accent focus:ring-brand-accent focus:ring-offset-brand-bg accent-brand-accent cursor-pointer"
              />
              <label htmlFor="remember" className="text-brand-dim cursor-pointer select-none">
                تذكرني
              </label>
            </div>

            <div>
              <a href="#" className="text-brand-dim hover:text-white transition-colors">
                نسيت كلمة المرور؟
              </a>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={pending}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark hover:from-brand-accent-dark hover:to-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent shadow-[0_0_20px_rgba(139,92,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              suppressHydrationWarning
            >
              {pending ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>جاري تسجيل الدخول...</span>
                </div>
              ) : (
                'تسجيل الدخول إلى لوحة التحكم'
              )}
            </button>
          </div>
        </form>

        {/* Register Footer */}
        <div className="text-center text-sm text-brand-dim mt-8">
          <span>جديد في شيفت بوينت؟ </span>
          <a href="#" className="font-semibold text-brand-accent hover:text-brand-accent-dark transition-colors">
            طلب انضمام
          </a>
        </div>
      </div>
    </div>
  )
}
