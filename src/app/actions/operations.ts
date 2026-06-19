/* eslint-disable */
'use server'

import { z } from 'zod'
import { createClient, createAdminClient, checkUserSuspension } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// ----------------------------------------------------
// 1. Money Request Schema & Action
// ----------------------------------------------------

const moneyRequestSchema = z.object({
  date: z.string().refine((val) => {
    // Temporarily allow all dates for backfilling historical data
    return true
  }, 'يجب أن يكون التاريخ اليوم أو الأمس فقط'),
  amount: z.coerce.number().positive('يجب أن يكون المبلغ أكبر من صفر'),
  walletId: z.string().uuid('المحفظة المحددة غير صالحة'),
  password: z.string().min(1, 'كلمة المرور مطلوبة للتأكيد'),
})

export type MoneyRequestState = {
  success?: boolean
  error?: string
  id?: string
  errors?: {
    date?: string[]
    amount?: string[]
    walletId?: string[]
    password?: string[]
  }
}

export async function addMoneyRequestAction(
  prevState: MoneyRequestState | null,
  formData: FormData
): Promise<MoneyRequestState> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  const date = formData.get('date') as string
  const amountStr = formData.get('amount') as string
  const walletId = formData.get('walletId') as string
  const password = formData.get('password') as string

  // 1. Validate inputs
  const validation = moneyRequestSchema.safeParse({
    date,
    amount: amountStr,
    walletId,
    password,
  })

  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors,
    }
  }

  const { amount } = validation.data

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

    // 3. Verify user password
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    })

    if (passwordError) {
      return {
        success: false,
        error: 'كلمة المرور غير صحيحة. يرجى إدخال كلمة المرور الخاصة بك لتأكيد الطلب.',
      }
    }

    // Verify wallets last audit month
    const tzOffset = new Date().getTimezoneOffset() * 60000
    const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
    const currentMonthStr = todayLocal.substring(0, 7) // Format: "YYYY-MM"

    const { data: activeWallets, error: activeWalletsError } = await supabase
      .from('wallets')
      .select('*')
      .eq('agent_id', user.id)
      .eq('is_active', true)
      .neq('is_archived', true)

    if (activeWalletsError) {
      console.error('Error fetching wallets for audit check:', activeWalletsError)
    }

    const needsAudit = activeWallets?.some((w) => !w.last_audit_month || w.last_audit_month !== currentMonthStr)
    if (needsAudit) {
      return {
        success: false,
        error: 'ERR_AUDIT_REQUIRED',
      }
    }

    // Validate request amount constraint against available monthly limit
    const selectedWallet = activeWallets?.find((w) => w.id === walletId)
    if (!selectedWallet) {
      return {
        success: false,
        error: 'المحفظة المحددة غير صالحة أو غير نشطة.',
      }
    }

    if (Number(selectedWallet.current_balance || 0) >= 200000) {
      return {
        success: false,
        error: 'عذراً، هذه المحفظة وصلت للحد الأقصى للرصيد (200 ألف ج.م أو أكثر) ولا يمكن طلب شحن رصيد لها.',
      }
    }

    const startingBalance = Number(selectedWallet.starting_balance || 0)
    const approvedMonthlyRequests = Number(selectedWallet.approved_monthly_requests || 0)
    const totalConsumed = startingBalance + approvedMonthlyRequests
    const available = 200000 - totalConsumed

    if (amount > available) {
      return {
        success: false,
        error: `لا يمكنك طلب (${amount}). المتاح لك هذا الشهر هو (${available}) ج.م فقط بناءً على رصيدك الافتتاحي وطلباتك السابقة.`,
      }
    }

    // Verify number of existing money requests for this date (limit: max 2, excluding rejected requests)
    const { count, error: countError } = await supabase
      .from('money_requests')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', user.id)
      .eq('request_date', date)
      .neq('status', 'rejected')

    if (countError) {
      console.error('Error counting money requests:', countError)
      return {
        success: false,
        error: 'حدث خطأ أثناء التحقق من عدد الطلبات السابقة لهذا اليوم.',
      }
    }

    if (count !== null && count >= 2) {
      return {
        success: false,
        error: 'لقد استنفدت الحد الأقصى للمحاولات (مرتين) لهذا التاريخ.',
      }
    }

    // 4. Insert money request into public.money_requests
    const { data: insertData, error: insertError } = await supabase
      .from('money_requests')
      .insert({
        agent_id: user.id,
        wallet_id: walletId,
        amount,
        request_date: date,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error inserting money request:', insertError)
      if (insertError.code === '23514') {
        return {
          success: false,
          error: 'تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)',
        }
      }
      return {
        success: false,
        error: insertError.message || 'حدث خطأ أثناء إرسال طلب الأموال لقاعدة البيانات.',
      }
    }

    revalidatePath('/dashboard/operations')
    return {
      success: true,
      id: insertData?.id,
    }
  } catch (error: any) {
    console.error('Money request exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
    }
  }
}

// ----------------------------------------------------
// 2. Daily Expenses & Transfers Unified Schemas & Action
// ----------------------------------------------------

const transferItemSchema = z.object({
  targetAgentId: z.string().uuid('يرجى اختيار موظف صالح'),
  amount: z.coerce.number().positive('يجب أن يكون مبلغ التحويل أكبر من صفر'),
})

const dailyExpensesSchema = z.object({
  date: z.string().refine((val) => {
    // Temporarily allow all dates for backfilling historical data
    return true
  }, 'يجب أن يكون التاريخ اليوم أو الأمس فقط'),
  personalExpenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0)
  ),
  marketing1Expenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0)
  ),
  marketing2Expenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0)
  ),
  marketing3Expenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0)
  ),
  transfers: z.array(transferItemSchema).default([]),
  password: z.string().min(1, 'كلمة المرور مطلوبة للتأكيد'),
})

export type DailyExpensesState = {
  success?: boolean
  error?: string
  errors?: {
    date?: string[]
    personalExpenses?: string[]
    marketing1Expenses?: string[]
    marketing2Expenses?: string[]
    marketing3Expenses?: string[]
    totalExpenses?: string[]
    transfers?: string[]
    password?: string[]
  }
}

export async function addDailyExpensesAction(
  prevState: DailyExpensesState | null,
  formData: FormData
): Promise<DailyExpensesState> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  const date = formData.get('date') as string
  const personalExpenses = formData.get('personalExpenses') as string
  const marketing1Expenses = formData.get('marketing1Expenses') as string
  const marketing2Expenses = formData.get('marketing2Expenses') as string
  const marketing3Expenses = formData.get('marketing3Expenses') as string
  const transfersJson = formData.get('transfers') as string
  const password = formData.get('password') as string
  const totalAmountStr = formData.get('totalAmount') as string

  let transfersList: any[] = []
  try {
    transfersList = transfersJson ? JSON.parse(transfersJson) : []
  } catch {
    return {
      success: false,
      error: 'حدث خطأ أثناء قراءة بيانات التحويلات، يرجى المحاولة مجدداً.',
    }
  }

  // 1. Validate inputs on server side
  const validation = dailyExpensesSchema.safeParse({
    date,
    personalExpenses,
    marketing1Expenses,
    marketing2Expenses,
    marketing3Expenses,
    transfers: transfersList,
    password,
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

    // 2. Get current authenticated user session
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

    // 3. Verify user password
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: data.password,
    })

    if (passwordError) {
      return {
        success: false,
        error: 'كلمة المرور غير صحيحة. يرجى إدخال كلمة المرور الخاصة بك لتأكيد عملية الإغلاق.',
      }
    }

    // Verify wallets last audit month
    const tzOffset = new Date().getTimezoneOffset() * 60000
    const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
    const currentMonthStr = todayLocal.substring(0, 7) // Format: "YYYY-MM"

    const { data: activeWallets, error: activeWalletsError } = await supabase
      .from('wallets')
      .select('*')
      .eq('agent_id', user.id)
      .eq('is_active', true)

    if (activeWalletsError) {
      console.error('Error fetching wallets for audit check:', activeWalletsError)
    }

    const needsAudit = activeWallets?.some((w) => !w.last_audit_month || w.last_audit_month !== currentMonthStr)
    if (needsAudit) {
      return {
        success: false,
        error: 'ERR_AUDIT_REQUIRED',
      }
    }

    // Validate request amount constraints
    if (
      data.personalExpenses > 200000 ||
      data.marketing1Expenses > 200000 ||
      data.marketing2Expenses > 200000 ||
      data.marketing3Expenses > 200000 ||
      data.transfers.some((t) => t.amount > 200000)
    ) {
      return {
        success: false,
        error: 'تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)',
      }
    }

    // Verify number of existing submissions for this date (limit: max 2)
    const { count, error: countError } = await supabase
      .from('daily_reports')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', user.id)
      .eq('report_date', data.date)

    if (countError) {
      console.error('Error counting daily reports:', countError)
      return {
        success: false,
        error: 'حدث خطأ أثناء فحص محاولات تسجيل التقرير السابقة.',
      }
    }

    if (count !== null && count >= 2) {
      return {
        success: false,
        error: 'لقد استنفدت الحد الأقصى للمحاولات (مرتين) لهذا التاريخ. لا يمكنك تسجيل المزيد.',
      }
    }

    // Map transfers structure to match database JSON format
    const dbTransfers = data.transfers.map((item) => ({
      target_agent_id: item.targetAgentId,
      amount: item.amount,
    }))

    // Calculate total amount to store in database
    const transfersSum = data.transfers.reduce((sum, item) => sum + item.amount, 0)
    const computedTotal = data.personalExpenses + data.marketing1Expenses + data.marketing2Expenses + data.marketing3Expenses + transfersSum
    const totalAmount = totalAmountStr ? Number(totalAmountStr) : computedTotal

    // 4. Insert daily expenses & transfers into public.daily_reports (strict insertion, fails if duplicate date)
    const { error: insertError } = await supabase
      .from('daily_reports')
      .insert({
        agent_id: user.id,
        report_date: data.date,
        personal_expenses: data.personalExpenses,
        marketing_1_expenses: data.marketing1Expenses,
        marketing_2_expenses: data.marketing2Expenses,
        marketing_3_expenses: data.marketing3Expenses,
        transfers: dbTransfers,
        total_amount: totalAmount,
      })

    if (insertError) {
      console.error('Error inserting daily expenses & transfers report:', insertError)
      
      // Handle unique constraint violation (agent_id, report_date)
      if (insertError.code === '23505') {
        return {
          success: false,
          error: 'لقد قمت بتسجيل تقرير هذا اليوم بالفعل. يرجى استخدام قسم (تعديل المصاريف) لطلب أي تغيير.',
        }
      }

      if (insertError.code === '23514') {
        return {
          success: false,
          error: 'تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)',
        }
      }

      return {
        success: false,
        error: insertError.message || 'حدث خطأ أثناء حفظ التقرير في قاعدة البيانات.',
      }
    }

    revalidatePath('/dashboard/operations')
    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Daily close report exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
    }
  }
}

// ----------------------------------------------------
// 3. Expense Edit Requests logic
// ----------------------------------------------------

export type FetchDailyReportResult = {
  success: boolean
  error?: string
  hasPendingRequest?: boolean
  data?: {
    id: string
    report_date: string
    personal_expenses: number
    marketing_1_expenses: number
    marketing_2_expenses: number
    marketing_3_expenses: number
    transfers: Array<{ target_agent_id: string; amount: number }> | null
    total_amount: number | null
  } | null
}

export async function fetchDailyReportAction(dateStr: string): Promise<FetchDailyReportResult> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  try {
    const supabase = await createClient()

    // 1. Get current authenticated user session
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

    // 2. Check for any pending edit request for this date and user
    const { data: pendingReq, error: pendingError } = await supabase
      .from('expense_edit_requests')
      .select('id')
      .eq('agent_id', user.id)
      .eq('report_date', dateStr)
      .eq('status', 'pending')
      .maybeSingle()

    if (pendingError) {
      console.error('Error checking pending edit request:', pendingError)
      return {
        success: false,
        error: 'حدث خطأ أثناء فحص الطلبات المعلقة في قاعدة البيانات.',
      }
    }

    if (pendingReq) {
      return {
        success: true,
        hasPendingRequest: true,
        data: null,
      }
    }

    // 3. Fetch daily report for this user and date
    const { data, error } = await supabase
      .from('daily_reports')
      .select('id, report_date, personal_expenses, marketing_1_expenses, marketing_2_expenses, marketing_3_expenses, transfers, total_amount')
      .eq('agent_id', user.id)
      .eq('report_date', dateStr)
      .maybeSingle()

    if (error) {
      console.error('Error fetching daily report for editing:', error)
      return {
        success: false,
        error: 'حدث خطأ أثناء فحص البيانات من قاعدة البيانات.',
      }
    }

    return {
      success: true,
      hasPendingRequest: false,
      data: data as any,
    }
  } catch (error: any) {
    console.error('Fetch daily report exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
    }
  }
}

const expenseEditRequestSchema = z.object({
  reportId: z.string().uuid('معرف التقرير غير صالح'),
  reportDate: z.string().refine((val) => {
    const tzOffset = new Date().getTimezoneOffset() * 60000
    const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
    const tenDaysAgoLocal = new Date(Date.now() - tzOffset - 10 * 86400000).toISOString().split('T')[0]
    return val >= tenDaysAgoLocal && val <= todayLocal
  }, 'يجب أن يكون تاريخ التعديل خلال آخر 10 أيام فقط وحتى اليوم'),
  personalExpenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0)
  ),
  marketing1Expenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0)
  ),
  marketing2Expenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0)
  ),
  marketing3Expenses: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 0 : val),
    z.coerce.number().min(0, 'يجب أن يكون المبلغ صفر أو أكثر').default(0)
  ),
  transfers: z.array(transferItemSchema).default([]),
})

export type ExpenseEditRequestState = {
  success?: boolean
  error?: string
  id?: string
  errors?: {
    reportId?: string[]
    reportDate?: string[]
    personalExpenses?: string[]
    marketing1Expenses?: string[]
    marketing2Expenses?: string[]
    marketing3Expenses?: string[]
    totalExpenses?: string[]
    transfers?: string[]
  }
}

export async function submitExpenseEditRequestAction(
  prevState: ExpenseEditRequestState | null,
  formData: FormData
): Promise<ExpenseEditRequestState> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  const reportId = formData.get('reportId') as string
  const reportDate = formData.get('reportDate') as string
  const personalExpenses = formData.get('personalExpenses') as string
  const marketing1Expenses = formData.get('marketing1Expenses') as string
  const marketing2Expenses = formData.get('marketing2Expenses') as string
  const marketing3Expenses = formData.get('marketing3Expenses') as string
  const transfersJson = formData.get('transfers') as string

  let transfersList: any[] = []
  try {
    transfersList = transfersJson ? JSON.parse(transfersJson) : []
  } catch {
    return {
      success: false,
      error: 'حدث خطأ أثناء قراءة بيانات التحويلات، يرجى المحاولة مجدداً.',
    }
  }

  // 1. Validate inputs on server side
  const validation = expenseEditRequestSchema.safeParse({
    reportId,
    reportDate,
    personalExpenses,
    marketing1Expenses,
    marketing2Expenses,
    marketing3Expenses,
    transfers: transfersList,
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

    // 2. Get current authenticated user session
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

    const dbTransfers = data.transfers.map((item) => ({
      target_agent_id: item.targetAgentId,
      amount: item.amount,
    }))

    // 3. Insert edit request into public.expense_edit_requests
    const { data: insertData, error: insertError } = await supabase
      .from('expense_edit_requests')
      .insert({
        agent_id: user.id,
        report_id: data.reportId,
        report_date: data.reportDate,
        new_personal_expenses: data.personalExpenses,
        new_marketing_1_expenses: data.marketing1Expenses,
        new_marketing_2_expenses: data.marketing2Expenses,
        new_marketing_3_expenses: data.marketing3Expenses,
        new_transfers: dbTransfers,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error inserting expense edit request:', insertError)
      return {
        success: false,
        error: insertError.message || 'حدث خطأ أثناء إرسال طلب التعديل لقاعدة البيانات.',
      }
    }

    revalidatePath('/dashboard/operations')
    return {
      success: true,
      id: insertData?.id,
    }
  } catch (error: any) {
    console.error('Expense edit request exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
    }
  }
}

export type AuditBalancesInput = Array<{ walletId: string; balance: number }>

export async function auditWalletsAction(
  balances: AuditBalancesInput
): Promise<{ success: boolean; error?: string }> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  try {
    const supabase = await createClient()

    // 1. Get current authenticated user
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

    const tzOffset = new Date().getTimezoneOffset() * 60000
    const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
    const currentMonthStr = todayLocal.substring(0, 7) // Format: "YYYY-MM"

    // 2. Update each wallet starting balance, current balance, reset approved requests and set last_audit_month
    for (const item of balances) {
      // Security check: ensure the wallet belongs to the user
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          starting_balance: item.balance,
          current_balance: item.balance,
          approved_monthly_requests: 0,
          last_audit_month: currentMonthStr
        })
        .eq('id', item.walletId)
        .eq('agent_id', user.id)

      if (updateError) {
        console.error('Error auditing wallet:', updateError)
        
        // Check constraint violation error code in Postgres is '23514'
        if (updateError.code === '23514') {
          return {
            success: false,
            error: 'تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)',
          }
        }
        
        return {
          success: false,
          error: updateError.message || 'حدث خطأ أثناء تحديث أرصدة المحافظ.',
        }
      }
    }

    // Revalidate operations page
    revalidatePath('/dashboard/operations')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Audit wallets exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
    }
  }
}

export async function getIncomingTransfersAction(userId: string) {
  try {
    const adminSupabase = await createAdminClient()
    const { data, error } = await adminSupabase
      .from('daily_reports')
      .select('transfers, report_date, agent_id')
      .filter('transfers', 'cs', `[{"target_agent_id": "${userId}"}]`)
    
    if (error) {
      console.error('Error fetching incoming transfers in Server Action:', error)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Exception fetching incoming transfers in Server Action:', err)
    return []
  }
}

