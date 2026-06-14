'use client'

import { useState } from 'react'
import Sidebar from './sidebar'
import Navbar from './navbar'

interface Profile {
  full_name: string
  role: string
  email: string
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
      <div className="flex-1 flex flex-col md:pr-70 transition-all duration-300 min-h-screen">
        {/* Navbar */}
        <Navbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          userName={profile.full_name}
        />

        {/* Main nested route views */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
