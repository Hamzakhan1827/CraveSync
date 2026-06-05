import { CraveSyncMark } from '@/components/CraveSyncLogo'
import LoginForm from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <CraveSyncMark size={64} />
          </div>

          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100 mb-2">CraveSync Admin</h2>
          <p className="text-center text-slate-500 dark:text-slate-400 mb-8">Sign in to manage your restaurant data</p>

          <LoginForm error={error} />
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-t border-slate-200 dark:border-slate-800 text-center transition-colors">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <a href="#" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Contact CraveSync Sales
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
