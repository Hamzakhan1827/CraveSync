import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { CraveSyncMark } from './CraveSyncLogo'
import { SidebarNav } from './SidebarNav'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { signOut } from '@/app/actions/auth'

export async function Sidebar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let displayName = "Loading...";
  let planName = "Accessing...";
  let initial = "B";
  let isSuperAdmin = false;

  if (user) {
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('is_super_admin, managed_restaurant_id, restaurants(name)')
      .eq('id', user.id)
      .single();

    isSuperAdmin = profile?.is_super_admin ?? false;

    if (profile?.is_super_admin) {
      displayName = "CraveSync Network";
      planName = "Platform Owner";
      initial = "⚡";
    } else if (profile?.restaurants) {
      const restData = profile.restaurants as any;
      displayName = Array.isArray(restData)
        ? (restData[0]?.name || "My Restaurant")
        : (restData?.name || "My Restaurant");
      planName = "Pro Plan";
      initial = displayName.charAt(0).toUpperCase();
    } else {
      displayName = "Unauthorized Access";
      planName = "No Restaurant Linked";
      initial = "❌";
    }
  }

  return (
    <>
      {/* Spacer for layout so content doesn't get hidden behind the collapsed sidebar */}
      <div className="w-16 hidden md:block shrink-0" />
      
      <aside className="fixed left-0 top-0 h-screen w-16 hover:w-64 group z-[100] hidden md:flex flex-col bg-white/95 dark:bg-slate-900/60 backdrop-blur-2xl border-r border-slate-200 dark:border-slate-800/50 shadow-[0_0_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden">
        
        {/* Logo area — mark stays fixed at left, text slides in beside it */}
        <div className="h-16 flex items-center shrink-0 border-b border-slate-200/50 dark:border-slate-800/50 pl-[17px]">
          <Link href="/" className="flex items-center gap-[10px] min-w-max">
            <CraveSyncMark size={38} className="shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 whitespace-nowrap font-bold tracking-tight text-slate-900 dark:text-slate-200" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>
              Crave<span className="text-emerald-500 dark:text-emerald-400">Sync</span>
            </span>
          </Link>
        </div>
        {/* Main Navigation */}
        <div className="flex-1 py-6 overflow-y-auto overflow-x-hidden no-scrollbar">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-4 px-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Main Menu
          </p>
          <SidebarNav isSuperAdmin={isSuperAdmin} />
        </div>

        {/* Bottom Actions */}
        <div className="px-3 py-3 shrink-0">
          <form action={signOut}>
            <button type="submit" className="flex items-center gap-4 px-3 py-2.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl font-semibold transition-all w-[232px]">
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">Sign Out</span>
            </button>
          </form>
        </div>
        {/* User Profile */}
        <div className="p-4 border-t border-transparent group-hover:border-slate-200/50 dark:group-hover:border-slate-800/50 shrink-0 transition-colors">
          <div className="flex items-center gap-3 overflow-hidden min-w-max">
            <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
              {initial}
            </div>
            <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={displayName}>{displayName}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{planName}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
