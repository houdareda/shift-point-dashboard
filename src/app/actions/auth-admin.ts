'use server'

import { createClient, checkUserSuspension } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function resetAgentPasswordAction(
  agentId: string,
  newPassword: string
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
    const {
      data: { user: currentUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !currentUser) {
      return {
        success: false,
        error: 'انتهت جلستك، يرجى إعادة تسجيل الدخول.',
      }
    }

    // Verify current user role is Admin/Owner/Leader
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (profileError || currentProfile?.role?.toLowerCase() !== 'admin') {
      return {
        success: false,
        error: 'صلاحيات غير كافية. هذا الإجراء يتطلب حساب مدير النظام (Admin) فقط.',
      }
    }

    if (!newPassword || newPassword.trim().length < 6) {
      return {
        success: false,
        error: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.',
      }
    }

    // Initialize Supabase Admin Client using service role key
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Call admin API to update password
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      agentId,
      { password: newPassword }
    )

    if (updateAuthError) {
      console.error('Error resetting password via admin client:', updateAuthError)
      return {
        success: false,
        error: updateAuthError.message || 'فشل تحديث كلمة المرور في نظام المصادقة.',
      }
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('Password reset action exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع أثناء إعادة تعيين كلمة المرور.',
    }
  }
}
