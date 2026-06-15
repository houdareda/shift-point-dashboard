import TransactionsClient from './transactions-client'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'سجل العمليات - Shift Point',
  description: 'عرض وتصفية سجل العمليات والتقارير المالية السابقة الخاصة بك.',
}

export default async function TransactionsPage() {
  return <TransactionsClient />
}
