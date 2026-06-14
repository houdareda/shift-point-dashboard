'use server'

import { z } from 'zod'
import { createClient, checkUserSuspension } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const walletSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'رقم الهاتف مطلوب')
    .regex(/^01[0125]\d{8}$/, 'يجب أن يكون رقم هاتف مصري صحيح مكون من 11 رقماً ويبدأ بـ 01'),
  currentBalance: z.coerce
    .number()
    .min(0, 'يجب أن يكون الرصيد 0 أو أكثر'),
})

export type WalletFormState = {
  success?: boolean
  error?: string
  errors?: {
    phoneNumber?: string[]
    currentBalance?: string[]
  }
}

export async function addWalletAction(
  prevState: WalletFormState | null,
  formData: FormData
): Promise<WalletFormState> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  const phoneNumber = formData.get('phoneNumber') as string
  const currentBalance = formData.get('currentBalance') as string

  // Validate the phone number and current balance fields
  const validation = walletSchema.safeParse({ phoneNumber, currentBalance })
  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors as any,
    }
  }

  // Check 200,000 constraint manually
  if (validation.data.currentBalance > 200000) {
    return {
      success: false,
      error: 'تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)',
    }
  }

  try {
    const supabase = await createClient()

    // Retrieve user session on the server for security
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'لم يتم العثور على جلسة مستخدم نشطة. يرجى تسجيل الدخول مجدداً.',
      }
    }

    const tzOffset = new Date().getTimezoneOffset() * 60000
    const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
    const currentMonthStr = todayLocal.substring(0, 7) // Format: "YYYY-MM"

    // Insert new wallet into public.wallets
    const { error: insertError } = await supabase
      .from('wallets')
      .insert({
        agent_id: user.id,
        phone_number: validation.data.phoneNumber,
        starting_balance: validation.data.currentBalance,
        current_balance: validation.data.currentBalance,
        approved_monthly_requests: 0,
        last_audit_month: currentMonthStr,
        current_month_total: 0,
      })

    if (insertError) {
      console.error('Error inserting wallet:', insertError)
      
      // Check limit check constraint violation
      if (insertError.code === '23514') {
        return {
          success: false,
          error: 'تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)',
        }
      }
      
      // Check for duplicate key violation (UNIQUE constraint)
      if (insertError.code === '23505') {
        return {
          success: false,
          errors: {
            phoneNumber: ['لقد قمت بإضافة هذا الرقم مسبقاً، يرجى إدخال رقم محفظة جديد.'],
          },
        }
      }
      
      return {
        success: false,
        error: insertError.message || 'حدث خطأ أثناء إضافة المحفظة بقاعدة البيانات.',
      }
    }

    // Revalidate paths to update the UI instantly
    revalidatePath('/dashboard/wallets')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Wallet insertion exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.',
    }
  }
}

export async function toggleWalletStatusAction(
  walletId: string,
  currentStatus: boolean
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
      return { success: false, error: 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً.' }
    }

    // 2. Toggle the status in public.wallets
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ is_active: !currentStatus })
      .eq('id', walletId)
      .eq('agent_id', user.id) // Security check: must belong to the logged-in agent

    if (updateError) {
      console.error('Error toggling wallet status:', updateError)
      return { success: false, error: updateError.message }
    }

    // 3. Revalidate path to update the UI list
    revalidatePath('/dashboard/wallets')
    return { success: true }
  } catch (error: any) {
    console.error('Toggle wallet status exception:', error)
    return { success: false, error: 'حدث خطأ غير متوقع.' }
  }
}

export async function updateWalletBalanceAction(
  walletId: string,
  balance: number
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
      return { success: false, error: 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً.' }
    }

    if (balance < 0) {
      return { success: false, error: 'يجب أن يكون الرصيد 0 أو أكثر' }
    }

    if (balance > 200000) {
      return { success: false, error: 'تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)' }
    }

    // 2. Fetch existing wallet details to get approved_monthly_requests
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('approved_monthly_requests')
      .eq('id', walletId)
      .eq('agent_id', user.id)
      .single()

    if (walletError || !wallet) {
      console.error('Error fetching wallet for update balance:', walletError)
      return { success: false, error: 'لم يتم العثور على المحفظة المرتبطة.' }
    }

    const approvedRequests = Number(wallet.approved_monthly_requests || 0)
    const newCurrentBalance = balance + approvedRequests

    if (newCurrentBalance > 200000) {
      return { success: false, error: 'تنبيه: المبلغ الإجمالي للمحفظة بعد التعديل يتجاوز 200 ألف ج.م.' }
    }

    const tzOffset = new Date().getTimezoneOffset() * 60000
    const todayLocal = new Date(Date.now() - tzOffset).toISOString().split('T')[0]
    const currentMonthStr = todayLocal.substring(0, 7) // Format: "YYYY-MM"

    // 3. Update the starting and current balance in public.wallets, preserving approved requests
    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        starting_balance: balance,
        current_balance: newCurrentBalance,
        last_audit_month: currentMonthStr
      })
      .eq('id', walletId)
      .eq('agent_id', user.id)

    if (updateError) {
      console.error('Error updating wallet balance:', updateError)
      if (updateError.code === '23514') {
        return { success: false, error: 'تنبيه: المبلغ يتجاوز الحد المسموح به (200 ألف شهرياً)' }
      }
      return { success: false, error: updateError.message || 'حدث خطأ أثناء تحديث رصيد المحفظة.' }
    }

    // 3. Revalidate path to update the UI list
    revalidatePath('/dashboard/wallets')
    return { success: true }
  } catch (error: any) {
    console.error('Update wallet balance exception:', error)
    return { success: false, error: 'حدث خطأ غير متوقع.' }
  }
}
