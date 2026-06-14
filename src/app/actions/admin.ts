'use server'

import { createClient, createAdminClient, checkUserSuspension } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function checkAdminPermissions() {
  const supabase = await createClient()

  // 1. Get current authenticated user session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { authorized: false, error: 'انتهت جلستك، يرجى تسجيل الدخول مجدداً.', userId: null }
  }

  // 2. Fetch profile role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { authorized: false, error: 'تعذر التحقق من صلاحيات الحساب.', userId: null }
  }

  const allowedRoles = ['admin', 'owner', 'leader', 'accountant']
  const userRole = profile.role?.toLowerCase() || 'agent'

  if (!allowedRoles.includes(userRole)) {
    return { authorized: false, error: 'غير مصرح لك بإجراء هذه العملية.', userId: null }
  }

  return { authorized: true, userId: user.id }
}

export async function fetchExpenseEditRequestAction(requestId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return { success: false, error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.' }
  }

  try {
    const perm = await checkAdminPermissions()
    if (!perm.authorized) {
      return { success: false, error: perm.error }
    }

    // Use admin client to bypass RLS and guarantee daily_reports data is fetched
    const supabase = await createAdminClient()

    const { data, error } = await supabase
      .from('expense_edit_requests')
      .select('*, agent:profiles!expense_edit_requests_agent_id_fkey(full_name), report:daily_reports(*)')
      .eq('id', requestId)
      .single()

    if (error) {
      console.error('Error fetching single request with joins:', error)
      return { success: false, error: 'فشل جلب تفاصيل الطلب من قاعدة البيانات.' }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Fetch edit request exception:', error)
    return { success: false, error: 'حدث خطأ غير متوقع.' }
  }
}

export async function approveExpenseEditRequestAction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return { success: false, error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.' }
  }

  try {
    const perm = await checkAdminPermissions()
    if (!perm.authorized) {
      return { success: false, error: perm.error }
    }

    const supabase = await createAdminClient()

    // 1. Fetch request details to get the proposed updates and the report ID
    const { data: request, error: fetchError } = await supabase
      .from('expense_edit_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single()

    if (fetchError || !request) {
      console.error('Error fetching edit request to approve:', fetchError)
      return { success: false, error: 'لم يتم العثور على طلب التعديل المعلق أو تم معالجته بالفعل.' }
    }

    // 2. Update the target daily_reports record with the new values from the request
    const { error: updateReportError } = await supabase
      .from('daily_reports')
      .update({
        personal_expenses: request.new_personal_expenses,
        marketing_1_expenses: request.new_marketing_1_expenses,
        marketing_2_expenses: request.new_marketing_2_expenses,
        marketing_3_expenses: request.new_marketing_3_expenses,
        transfers: request.new_transfers,
      })
      .eq('id', request.report_id)

    if (updateReportError) {
      console.error('Error updating daily report on approval:', updateReportError)
      return { success: false, error: 'حدث خطأ أثناء تحديث التقرير اليومي بالقيم الجديدة.' }
    }

    // 3. Update expense_edit_requests status to approved and store metadata
    const { error: updateRequestError } = await supabase
      .from('expense_edit_requests')
      .update({
        status: 'approved',
        reviewed_by: perm.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (updateRequestError) {
      console.error('Error updating edit request status:', updateRequestError)
      return { success: false, error: 'حدث خطأ أثناء تحديث حالة طلب التعديل في قاعدة البيانات.' }
    }

    revalidatePath('/admin/approvals')
    revalidatePath('/dashboard/operations')
    return { success: true }
  } catch (error: any) {
    console.error('Approve expense edit exception:', error)
    return { success: false, error: 'حدث خطأ غير متوقع أثناء معالجة الطلب.' }
  }
}

export async function rejectExpenseEditRequestAction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return { success: false, error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.' }
  }

  try {
    const perm = await checkAdminPermissions()
    if (!perm.authorized) {
      return { success: false, error: perm.error }
    }

    const supabase = await createAdminClient()

    // Update request status to rejected
    const { error } = await supabase
      .from('expense_edit_requests')
      .update({
        status: 'rejected',
        reviewed_by: perm.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (error) {
      console.error('Error rejecting edit request:', error)
      return { success: false, error: 'حدث خطأ أثناء رفض الطلب في قاعدة البيانات.' }
    }

    revalidatePath('/admin/approvals')
    return { success: true }
  } catch (error: any) {
    console.error('Reject expense edit exception:', error)
    return { success: false, error: 'حدث خطأ غير متوقع.' }
  }
}

export async function approveMoneyRequestAction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return { success: false, error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.' }
  }

  try {
    const perm = await checkAdminPermissions()
    if (!perm.authorized) {
      return { success: false, error: perm.error }
    }

    const supabase = await createAdminClient()

    // 1. Fetch request details to get amount and target wallet
    const { data: request, error: fetchError } = await supabase
      .from('money_requests')
      .select('wallet_id, amount, status')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      console.error('Error fetching money request:', fetchError)
      return { success: false, error: 'لم يتم العثور على طلب الأموال في قاعدة البيانات.' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: 'هذا الطلب تم اتخاذ قرار فيه بالفعل.' }
    }

    // 2. Update status to approved
    const { error: updateRequestError } = await supabase
      .from('money_requests')
      .update({
        status: 'approved',
      })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (updateRequestError) {
      console.error('Error approving money request:', updateRequestError)
      return { success: false, error: 'حدث خطأ أثناء الموافقة على الطلب في قاعدة البيانات.' }
    }

    // 3. Increment target wallet's approved_monthly_requests and current_balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('approved_monthly_requests, current_balance')
      .eq('id', request.wallet_id)
      .single()

    if (walletError || !wallet) {
      console.error('Error fetching wallet details:', walletError)
      return { success: false, error: 'تمت الموافقة على الطلب ولكن لم يتم العثور على المحفظة المرتبطة لتحديث الأرصدة.' }
    }

    const newApproved = (wallet.approved_monthly_requests || 0) + request.amount
    const newBalance = (wallet.current_balance || 0) + request.amount

    const { error: updateWalletError } = await supabase
      .from('wallets')
      .update({
        approved_monthly_requests: newApproved,
        current_balance: newBalance,
      })
      .eq('id', request.wallet_id)

    if (updateWalletError) {
      console.error('Error updating wallet approved requests & balance:', updateWalletError)
    }

    revalidatePath('/admin/approvals')
    return { success: true }
  } catch (error: any) {
    console.error('Approve money request exception:', error)
    return { success: false, error: 'حدث خطأ غير متوقع.' }
  }
}

export async function rejectMoneyRequestAction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return { success: false, error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.' }
  }

  try {
    const perm = await checkAdminPermissions()
    if (!perm.authorized) {
      return { success: false, error: perm.error }
    }

    const supabase = await createAdminClient()

    // Update status to rejected
    const { error } = await supabase
      .from('money_requests')
      .update({
        status: 'rejected',
      })
      .eq('id', requestId)
      .eq('status', 'pending')

    if (error) {
      console.error('Error rejecting money request:', error)
      return { success: false, error: 'حدث خطأ أثناء رفض الطلب في قاعدة البيانات.' }
    }

    revalidatePath('/admin/approvals')
    return { success: true }
  } catch (error: any) {
    console.error('Reject money request exception:', error)
    return { success: false, error: 'حدث خطأ غير متوقع.' }
  }
}

export async function fetchMoneyRequestAction(requestId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return { success: false, error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.' }
  }

  try {
    const perm = await checkAdminPermissions()
    if (!perm.authorized) {
      return { success: false, error: perm.error }
    }

    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('money_requests')
      .select('*, agent:profiles(full_name), wallet:wallets(phone_number, current_balance)')
      .eq('id', requestId)
      .single()

    if (error) {
      console.error('Error fetching money request details:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Fetch money request exception:', error)
    return { success: false, error: 'حدث خطأ غير متوقع.' }
  }
}
