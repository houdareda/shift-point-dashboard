/* eslint-disable */
'use server'

import { z } from 'zod'
import { createClient, checkUserSuspension } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const cplReportSchema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  totalCash: z.coerce.number().min(0, 'يجب أن يكون إجمالي الكاش صفر أو أكثر'),
  personalExpenses: z.coerce.number().min(0, 'يجب أن تكون المصاريف الشخصية صفر أو أكثر'),
  recipientMoney: z.coerce.number().min(0, 'يجب أن يكون المستلم صفر أو أكثر'),
  campaignMoney: z.coerce.number().min(0, 'يجب أن تكون الحملة صفر أو أكثر'),
  sys2Amount: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر'),
  sys3Amount: z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر'),
  totalLeads: z.coerce.number().int().min(0, 'يجب أن يكون إجمالي اللييدات صفر أو أكثر'),
  sys1Count: z.coerce.number().int().min(0, 'يجب أن يكون العدد صفر أو أكثر'),
  sys2Count: z.coerce.number().int().min(0, 'يجب أن يكون العدد صفر أو أكثر'),
  sys3Count: z.coerce.number().int().min(0, 'يجب أن يكون العدد صفر أو أكثر'),
  sys1Cpl: z.coerce.number().min(0),
  sys2Cpl: z.coerce.number().min(0),
  sys3Cpl: z.coerce.number().min(0),
  wallets: z.any(),
})

export type CplReportState = {
  success?: boolean
  error?: string
  errors?: {
    date?: string[]
    totalCash?: string[]
    personalExpenses?: string[]
    recipientMoney?: string[]
    campaignMoney?: string[]
    sys2Amount?: string[]
    sys3Amount?: string[]
    totalLeads?: string[]
    sys1Count?: string[]
    sys2Count?: string[]
    sys3Count?: string[]
    sys1Cpl?: string[]
    sys2Cpl?: string[]
    sys3Cpl?: string[]
    wallets?: string[]
  }
}

export async function saveCplReportAction(
  prevState: CplReportState | null,
  formData: FormData
): Promise<CplReportState> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  const date = formData.get('date') as string
  const totalCash = formData.get('totalCash') as string
  const personalExpenses = formData.get('personalExpenses') as string
  const recipientMoney = formData.get('recipientMoney') as string
  const campaignMoney = formData.get('campaignMoney') as string
  const sys2Amount = formData.get('sys2Amount') as string
  const sys3Amount = formData.get('sys3Amount') as string
  const totalLeads = formData.get('totalLeads') as string
  const sys1Count = formData.get('sys1Count') as string
  const sys2Count = formData.get('sys2Count') as string
  const sys3Count = formData.get('sys3Count') as string
  const sys1Cpl = formData.get('sys1Cpl') as string
  const sys2Cpl = formData.get('sys2Cpl') as string
  const sys3Cpl = formData.get('sys3Cpl') as string
  const walletsJson = formData.get('wallets') as string

  let walletsData: any = null
  try {
    walletsData = walletsJson ? JSON.parse(walletsJson) : null
  } catch {
    return {
      success: false,
      error: 'حدث خطأ أثناء قراءة تفاصيل المحافظ، يرجى المحاولة مجدداً.',
    }
  }

  // 1. Validate inputs on server side
  const validation = cplReportSchema.safeParse({
    date,
    totalCash,
    personalExpenses,
    recipientMoney,
    campaignMoney,
    sys2Amount,
    sys3Amount,
    totalLeads,
    sys1Count,
    sys2Count,
    sys3Count,
    sys1Cpl,
    sys2Cpl,
    sys3Cpl,
    wallets: walletsData,
  })

  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors as any,
    }
  }

  const data = validation.data

  try {
    const supabase = await createClient()

    // 2. Get current authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'انتهت جلستك، يرجى تسجيل الدخول مجدداً.',
      }
    }

    // 3. Mathematical Calculations
    const B2 = data.totalCash
    const B5 = data.personalExpenses
    const B6 = data.recipientMoney
    const B7 = data.campaignMoney
    const B10 = data.sys2Amount
    const B11 = data.sys3Amount

    const B3 = B2 - B5 - B6

    // Support both old array format and new object format containing { wallets, counts }
    let walletsArray: any[] = []
    if (Array.isArray(data.wallets)) {
      walletsArray = data.wallets
    } else if (data.wallets && Array.isArray(data.wallets.wallets)) {
      walletsArray = data.wallets.wallets
    }

    const sumWallets = walletsArray.reduce((sum, w) => sum + (Number(w.amount) || 0), 0)
    const B13 = sumWallets + B7
    const B9 = B3 - B10 - B11 - B13 - B7
    const B4 = B5 + B6 + B9 + B10 + B11
    const B14 = B2 - B4 - B7

    // 4. Insert into database table cpl_reports
    const { error: insertError } = await supabase
      .from('cpl_reports')
      .insert({
        user_id: user.id,
        report_date: data.date,
        total_cash: B2,
        personal_expenses: B5,
        recipient_money: B6,
        campaign_money: B7,
        sys1_amount: B9,
        sys2_amount: B10,
        sys3_amount: B11,
        total_leads: data.totalLeads,
        wallets_details: data.wallets,
        calc_total_expenses: B4,
        calc_total_wallets: B13,
        calc_remaining_cash: B14,
        sys1_count: data.sys1Count,
        sys2_count: data.sys2Count,
        sys3_count: data.sys3Count,
        sys1_cpl: data.sys1Cpl,
        sys2_cpl: data.sys2Cpl,
        sys3_cpl: data.sys3Cpl,
      })

    if (insertError) {
      console.error('Error inserting CPL report:', insertError)

      // Handle unique constraint violation (user_id, report_date)
      if (insertError.code === '23505') {
        return {
          success: false,
          error: 'لقد قمت بتسجيل تقرير لهذا التاريخ بالفعل. لا يمكنك تكرار الحفظ لنفس اليوم.',
        }
      }

      // Handle check constraints
      if (insertError.code === '23514') {
        return {
          success: false,
          error: 'فشل الحفظ: يرجى التحقق من صحة المبالغ والبيانات المدخلة.',
        }
      }

      return {
        success: false,
        error: insertError.message || 'حدث خطأ أثناء حفظ التقرير في قاعدة البيانات.',
      }
    }

    revalidatePath('/dashboard/cpl-calculator')
    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Cpl save exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
    }
  }
}

export async function updateCplReportAction(
  prevState: CplReportState | null,
  formData: FormData
): Promise<CplReportState> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  const date = formData.get('date') as string
  const totalCash = formData.get('totalCash') as string
  const personalExpenses = formData.get('personalExpenses') as string
  const recipientMoney = formData.get('recipientMoney') as string
  const campaignMoney = formData.get('campaignMoney') as string
  const sys2Amount = formData.get('sys2Amount') as string
  const sys3Amount = formData.get('sys3Amount') as string
  const totalLeads = formData.get('totalLeads') as string
  const sys1Count = formData.get('sys1Count') as string
  const sys2Count = formData.get('sys2Count') as string
  const sys3Count = formData.get('sys3Count') as string
  const sys1Cpl = formData.get('sys1Cpl') as string
  const sys2Cpl = formData.get('sys2Cpl') as string
  const sys3Cpl = formData.get('sys3Cpl') as string
  const walletsJson = formData.get('wallets') as string

  let walletsData: any = null
  try {
    walletsData = walletsJson ? JSON.parse(walletsJson) : null
  } catch {
    return {
      success: false,
      error: 'حدث خطأ أثناء قراءة تفاصيل المحافظ، يرجى المحاولة مجدداً.',
    }
  }

  // 1. Validate inputs on server side
  const validation = cplReportSchema.safeParse({
    date,
    totalCash,
    personalExpenses,
    recipientMoney,
    campaignMoney,
    sys2Amount,
    sys3Amount,
    totalLeads,
    sys1Count,
    sys2Count,
    sys3Count,
    sys1Cpl,
    sys2Cpl,
    sys3Cpl,
    wallets: walletsData,
  })

  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors as any,
    }
  }

  const data = validation.data

  try {
    const supabase = await createClient()

    // 2. Get current authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'انتهت جلستك، يرجى تسجيل الدخول مجدداً.',
      }
    }

    // 3. Mathematical Calculations
    const B2 = data.totalCash
    const B5 = data.personalExpenses
    const B6 = data.recipientMoney
    const B7 = data.campaignMoney
    const B10 = data.sys2Amount
    const B11 = data.sys3Amount

    const B3 = B2 - B5 - B6

    // Support both old array format and new object format containing { wallets, counts }
    let walletsArray: any[] = []
    if (Array.isArray(data.wallets)) {
      walletsArray = data.wallets
    } else if (data.wallets && Array.isArray(data.wallets.wallets)) {
      walletsArray = data.wallets.wallets
    }

    const sumWallets = walletsArray.reduce((sum, w) => sum + (Number(w.amount) || 0), 0)
    const B13 = sumWallets + B7
    const B9 = B3 - B10 - B11 - B13 - B7
    const B4 = B5 + B6 + B9 + B10 + B11
    const B14 = B2 - B4 - B7

    // 4. Update the database table cpl_reports
    const { error: updateError } = await supabase
      .from('cpl_reports')
      .update({
        total_cash: B2,
        personal_expenses: B5,
        recipient_money: B6,
        campaign_money: B7,
        sys1_amount: B9,
        sys2_amount: B10,
        sys3_amount: B11,
        total_leads: data.totalLeads,
        wallets_details: data.wallets,
        calc_total_expenses: B4,
        calc_total_wallets: B13,
        calc_remaining_cash: B14,
        sys1_count: data.sys1Count,
        sys2_count: data.sys2Count,
        sys3_count: data.sys3Count,
        sys1_cpl: data.sys1Cpl,
        sys2_cpl: data.sys2Cpl,
        sys3_cpl: data.sys3Cpl,
      })
      .eq('user_id', user.id)
      .eq('report_date', data.date)

    if (updateError) {
      console.error('Error updating CPL report:', updateError)
      return {
        success: false,
        error: updateError.message || 'حدث خطأ أثناء تحديث التقرير في قاعدة البيانات.',
      }
    }

    revalidatePath('/dashboard/cpl-calculator')
    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Cpl update exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
    }
  }
}
