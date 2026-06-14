'use client'

import { usePathname } from 'next/navigation'
import { Menu, Bell } from 'lucide-react'

interface NavbarProps {
  onMenuToggle: () => void
  userName: string
}

const ROUTE_NAMES: Record<string, string> = {
  '/dashboard': 'الرئيسية',
  '/dashboard/agents': 'إدارة الموظفين (Agents)',
  '/dashboard/leads': 'متابعة الليدز (Leads)',
  '/dashboard/wallets': 'إدارة المحافظ',
  '/dashboard/my-wallet': 'محفظتي',
  '/dashboard/expenses': 'إدارة المصروفات',
  '/dashboard/my-expenses': 'طلب أموال ومصروفات',
  '/dashboard/operations': 'العمليات اليومية',
  '/dashboard/my-report': 'تقريري المالي',
  '/dashboard/settings': 'الإعدادات',
  '/admin/overview': 'التقرير المالي المجمع',
  '/admin/approvals': 'طلبات الموافقات',
}

export default function Navbar({ onMenuToggle, userName }: NavbarProps) {
  const pathname = usePathname()
  const pageTitle = ROUTE_NAMES[pathname] || 'لوحة التحكم'

  return (
    <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-brand-border bg-brand-bg/50 backdrop-blur-md px-6 shadow-sm">
      {/* Right side: Mobile Menu Button & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-brand-dim hover:bg-white/5 hover:text-white md:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold text-white md:text-xl">
          {pageTitle}
        </h2>
      </div>

      {/* Left side: Notifications */}
      <div className="flex items-center gap-4">
        {/* Notifications Icon */}
        <button className="relative rounded-xl p-2.5 bg-white/[0.02] border border-white/[0.08] text-brand-dim hover:text-white hover:bg-white/5 transition-all duration-300 cursor-pointer">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 left-2 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
          </span>
        </button>

        {/* User Greeting (Desktop) */}
        <div className="hidden md:block text-left text-xs border-r border-brand-border pr-4">
          <span className="text-brand-dim">مرحباً بك، </span>
          <span className="font-semibold text-white">{userName}</span>
        </div>
      </div>
    </header>
  )
}
