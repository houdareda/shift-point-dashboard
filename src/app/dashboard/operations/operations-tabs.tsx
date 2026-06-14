'use client'

import { useState } from 'react'
import MoneyRequestForm from './money-request-form'
import ExpensesForm from './expenses-form'
import EditExpensesForm from './edit-expenses-form'
import { Send, Receipt, Edit3 } from 'lucide-react'

interface OperationsTabsProps {
  wallets: Array<{ id: string; phone_number: string; current_balance: number }>
  agents: Array<{ id: string; full_name: string }>
  currentAgentId: string
}

type TabType = 'money-request' | 'expenses' | 'edit-expenses'

export default function OperationsTabs({ wallets, agents, currentAgentId }: OperationsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('money-request')

  const tabs = [
    {
      id: 'money-request' as TabType,
      name: 'طلب أموال',
      icon: Send,
    },
    {
      id: 'expenses' as TabType,
      name: 'المصاريف والتحويلات اليومية',
      icon: Receipt,
    },
    {
      id: 'edit-expenses' as TabType,
      name: 'تعديل المصاريف',
      icon: Edit3,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Tabs Selector Bar */}
      <div className="flex border-b border-brand-border bg-brand-card/10 backdrop-blur-md p-1.5 rounded-2xl gap-2 w-full max-w-3xl mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-white bg-gradient-to-r from-brand-accent to-brand-accent-dark shadow-[0_4px_15px_rgba(139,92,246,0.2)]'
                  : 'text-brand-dim hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div className="w-full max-w-4xl mx-auto animate-fade-in" key={activeTab}>
        {activeTab === 'money-request' && (
          <MoneyRequestForm wallets={wallets} currentAgentId={currentAgentId} />
        )}
        
        {activeTab === 'expenses' && (
          <ExpensesForm agents={agents} wallets={wallets} />
        )}

        {activeTab === 'edit-expenses' && (
          <EditExpensesForm agents={agents} currentAgentId={currentAgentId} />
        )}
      </div>
    </div>
  )
}
