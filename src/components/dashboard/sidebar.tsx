'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from '@/app/actions/auth'
import {
  LayoutDashboard,
  Users,
  Target,
  Wallet,
  Receipt,
  Settings,
  LogOut,
  X,
  User,
  Shield,
  Briefcase,
  Award,
  ClipboardList,
  CheckSquare,
  BarChart3,
  LineChart,
  TrendingUp,
  History
} from 'lucide-react'

interface Profile {
  full_name: string
  role: string
  email: string
}

interface SidebarProps {
  profile: Profile
  isOpen: boolean
  onClose: () => void
}

const ROLE_DISPLAY: Record<string, { label: string; icon: any; color: string }> = {
  admin: { label: 'مدير النظام', icon: Shield, color: 'text-red-400 bg-red-400/10' },
  owner: { label: 'مدير النظام', icon: Shield, color: 'text-red-400 bg-red-400/10' },
  leader: { label: 'قائد فريق', icon: Award, color: 'text-amber-400 bg-amber-400/10' },
  agent: { label: 'موظف', icon: User, color: 'text-blue-400 bg-blue-400/10' },
  accountant: { label: 'محاسب', icon: Briefcase, color: 'text-emerald-400 bg-emerald-400/10' },
}

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<any>
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'الرئيسية',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'owner', 'leader', 'agent', 'accountant'],
  },
  {
    name: 'الموظفين (Agents)',
    href: '/dashboard/agents',
    icon: Users,
    roles: ['admin', 'owner', 'leader'],
  },
  {
    name: 'إدارة المحافظ',
    href: '/dashboard/wallets',
    icon: Wallet,
    roles: ['accountant', 'agent'],
  },
  {
    name: 'العمليات اليومية',
    href: '/dashboard/operations',
    icon: ClipboardList,
    roles: ['agent', 'leader'],
  },
  {
    name: 'تقريري المالي',
    href: '/dashboard/my-report',
    icon: LineChart,
    roles: ['agent', 'employee'],
  },
  {
    name: 'طلبات الموافقة',
    href: '/admin/approvals',
    icon: CheckSquare,
    roles: ['admin', 'owner', 'leader', 'accountant'],
  },
  {
    name: 'التقرير المالي المجمع',
    href: '/admin/overview',
    icon: BarChart3,
    roles: ['admin', 'owner', 'leader', 'accountant'],
  },
  {
    name: 'تحليل الأداء',
    href: '/dashboard/performance',
    icon: TrendingUp,
    roles: ['admin', 'owner', 'leader', 'agent', 'accountant', 'employee'],
  },
  {
    name: 'سجل العمليات',
    href: '/dashboard/transactions',
    icon: History,
    roles: ['admin', 'owner', 'leader', 'agent', 'accountant', 'employee'],
  },
]

export default function Sidebar({ profile, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const userRole = (profile?.role?.toLowerCase() || 'agent') as string
  const roleDetails = ROLE_DISPLAY[userRole] || ROLE_DISPLAY.agent
  const RoleIcon = roleDetails.icon

  // Filter items based on the user's role
  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-70 flex-col bg-brand-card border-l border-brand-border backdrop-blur-xl transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header Logo */}
        <div className="flex h-18 items-center justify-between px-6 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white tracking-tight">
              Shift<span className="text-brand-accent">Point</span>
            </span>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-dim hover:bg-white/5 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group ${
                  isActive
                    ? 'text-white bg-gradient-to-r from-brand-accent/20 to-brand-accent-dark/5 border border-brand-accent/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                    : 'text-brand-dim hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 ${
                    isActive ? 'text-brand-accent' : 'text-brand-dim group-hover:text-white'
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer profile card and logout */}
        <div className="p-4 border-t border-brand-border bg-white/[0.005]">
          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-accent/10 border border-brand-border">
              <RoleIcon className="h-5 w-5 text-brand-accent" />
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="text-sm font-semibold text-white truncate">
                {profile.full_name}
              </p>
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleDetails.color}`}>
                {roleDetails.label}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-brand-dim hover:text-white hover:bg-brand-error/10 hover:border-brand-error/20 border border-transparent transition-all duration-300 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
