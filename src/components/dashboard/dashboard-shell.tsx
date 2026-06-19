'use client'

import { useState } from 'react'
import Sidebar from './sidebar'
import { Menu } from 'lucide-react'

interface Profile {
  full_name: string
  role: string
  email: string
  agent_sheets?: Record<string, string> | null
}

interface DashboardShellProps {
  profile: Profile
  children: React.ReactNode
}

export default function DashboardShell({ profile, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-brand-bg flex text-brand-text relative overflow-x-hidden">
      {/* Dynamic Sidebar */}
      <Sidebar
        profile={profile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pr-70 transition-all duration-300 min-h-screen relative">
        {/* Mobile Menu Toggle Button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 right-4 z-40 rounded-xl p-2.5 bg-brand-card/80 border border-brand-border/60 text-brand-dim hover:text-white hover:bg-white/10 shadow-lg backdrop-blur-md md:hidden cursor-pointer transition-all duration-300"
          aria-label="القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Main nested route views */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
