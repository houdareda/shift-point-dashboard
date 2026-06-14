import PerformanceClient from './performance-client'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'تحليل الأداء - Shift Point',
  description: 'عرض تقارير الأداء المالي والعمليات اليومية والشهري المدمجة مباشرة من Google Sheets.',
}

export default async function PerformancePage() {
  return <PerformanceClient />
}
