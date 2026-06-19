'use server'

import { z } from 'zod'
import { createClient, checkUserSuspension } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const agentSchema = z.object({
  fullName: z.string().min(1, 'الاسم الكامل مطلوب'),
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('البريد الإلكتروني غير صالح'),
  password: z
    .string()
    .min(6, 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل'),
  role: z.enum(['agent', 'leader', 'accountant', 'admin'], {
    message: 'الدور المحدد غير صالح',
  }),
  teamId: z.string().nullable().optional(),
})

export type AgentFormState = {
  success?: boolean
  error?: string
  errors?: {
    fullName?: string[]
    email?: string[]
    password?: string[]
    role?: string[]
    teamId?: string[]
  }
}

export async function addAgentAction(
  prevState: AgentFormState | null,
  formData: FormData
): Promise<AgentFormState> {
  const suspension = await checkUserSuspension()
  if (suspension.suspended) {
    return {
      success: false,
      error: 'حسابك موقوف، غير مصرح لك باتخاذ أي إجراء.',
    }
  }

  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string
  const rawTeamId = formData.get('teamId') as string | null
  const teamId = rawTeamId?.trim() ? rawTeamId.trim() : null
  const sys1 = formData.get('sys1') as string
  const sys2 = formData.get('sys2') as string
  const sys3 = formData.get('sys3') as string

  const isAgent = role?.toLowerCase() === 'agent'
  const finalTeamId = isAgent ? teamId : null

  const sheetsObj: Record<string, string> = {}
  if (isAgent) {
    if (sys1?.trim()) sheetsObj.sys1 = sys1.trim()
    if (sys2?.trim()) sheetsObj.sys2 = sys2.trim()
    if (sys3?.trim()) sheetsObj.sys3 = sys3.trim()
  }
  const agentSheets = Object.keys(sheetsObj).length > 0 ? sheetsObj : null

  // 1. Validate inputs on server side
  const validation = agentSchema.safeParse({
    fullName,
    email,
    password,
    role,
    teamId: finalTeamId,
  })

  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors,
    }
  }

  try {
    // 2. Retrieve the standard client and verify request sender auth
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

    // 3. Check if the current user is an Admin
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

    // 4. Initialize the Supabase Admin Client using the Service Role Key
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

    // 5. Create user in Supabase Auth system
    const { data: createUserData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm user email directly
      })

    if (createUserError) {
      console.error('Error creating auth user:', createUserError)
      return {
        success: false,
        error: createUserError.message || 'فشل إنشاء الحساب في نظام المصادقة.',
      }
    }

    const newUserId = createUserData.user.id

    // 6. Insert new user profile into public.profiles
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        full_name: fullName,
        role: role.toLowerCase(),
        team_id: finalTeamId,
        agent_sheets: agentSheets,
      })

    if (profileInsertError) {
      console.error('Error inserting user profile:', profileInsertError)
      
      // Rollback: delete auth user if profile insertion fails to avoid orphans
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      
      return {
        success: false,
        error: profileInsertError.message || 'فشل إدراج بيانات الملف الشخصي في قاعدة البيانات.',
      }
    }

    // 7. Update caches
    revalidatePath('/dashboard/agents')

    return {
      success: true,
    }
  } catch (error: unknown) {
    console.error('Add agent exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع أثناء إضافة الموظف.',
    }
  }
}

export async function updateAgentAction(
  agentId: string,
  fullName: string,
  role: string,
  teamId: string | null,
  agentSheets: Record<string, string> | null
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

    const isAgent = role.toLowerCase() === 'agent'
    const finalTeamId = isAgent ? teamId : null
    const finalAgentSheets = isAgent ? agentSheets : null

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        role: role.toLowerCase(),
        team_id: finalTeamId,
        agent_sheets: finalAgentSheets,
      })
      .eq('id', agentId)

    if (updateError) {
      console.error('Error updating agent profile:', updateError)
      return {
        success: false,
        error: updateError.message || 'فشل تحديث بيانات الموظف.',
      }
    }

    revalidatePath('/dashboard/agents')
    return { success: true }
  } catch (error: unknown) {
    console.error('Update agent exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع أثناء تحديث بيانات الموظف.',
    }
  }
}

export async function toggleAgentSuspensionAction(
  agentId: string,
  currentRole: string
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

    const isSuspended = currentRole.toLowerCase() === 'suspended'
    const newRole = isSuspended ? 'agent' : 'suspended'

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: newRole,
      })
      .eq('id', agentId)

    if (updateError) {
      console.error('Error toggling agent status:', updateError)
      return {
        success: false,
        error: updateError.message || 'فشل تعديل حالة الحساب.',
      }
    }

    revalidatePath('/dashboard/agents')
    return { success: true }
  } catch (error: unknown) {
    console.error('Toggle agent status exception:', error)
    return {
      success: false,
      error: 'حدث خطأ غير متوقع أثناء تعديل حالة الحساب.',
    }
  }
}
