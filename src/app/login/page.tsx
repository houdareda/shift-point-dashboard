import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-bg p-4 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-brand-accent-dark/5 blur-[120px] pointer-events-none" />

      <LoginForm />
    </main>
  )
}
