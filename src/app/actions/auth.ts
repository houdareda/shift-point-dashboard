'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('البريد الإلكتروني غير صالح'),
  password: z
    .string()
    .min(6, 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل'),
})

export type FormState = {
  success?: boolean
  errors?: {
    email?: string[]
    password?: string[]
    form?: string[]
  }
}

export async function signInAction(
  prevState: FormState | null,
  formData: FormData
): Promise<FormState> {
  console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validate the inputs
  const validatedFields = loginSchema.safeParse({ email, password })

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  console.log('--- محاولة تسجيل الدخول ---')
  console.log('البريد الإلكتروني المستلم:', email)
  console.log('رابط Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('مفتاح Supabase موجود:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.log("Supabase Auth Error: ", error)
    
    return {
      success: false,
      errors: {
        form: [error.message],
      },
    }
  }

  if (data?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role?.toLowerCase() === 'suspended') {
      await supabase.auth.signOut()
      return {
        success: false,
        errors: {
          form: ['هذا الحساب موقوف حالياً. يرجى مراجعة إدارة النظام.'],
        },
      }
    }
  }

  console.log('تم تسجيل الدخول بنجاح للمستخدم:', data.user?.email)
  // Redirect to dashboard on success
  redirect('/dashboard')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
