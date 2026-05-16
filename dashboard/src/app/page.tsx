import { Header } from '@/components/Header'
import { Star, TrendingUp, Users, ThumbsUp, ThumbsDown, Minus, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'

export const revalidate = 0

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitial(name: string | null, email: string | null) {
  return (name || email || "?").charAt(0).toUpperCase();
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('managed_restaurant_id, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.managed_restaurant_id && !profile?.is_super_admin) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500">Your account is not linked to a restaurant.</p>
      </div>
    )
  }

  // Fetch all reviews for this restaurant
  let reviewQuery = supabaseAdmin
    .from('reviews')
    .select(`
      id,
      rating_thumbs,
      public_note,
      created_at,
      user_id,
      users ( full_name, email ),
      menu_items!inner (
        id,
        name,
        price,
        menu_categories!inner ( name, restaurant_id )
      )
    `)
    .order('created_at', { ascending: false })

  if (!profile.is_super_admin) {
    reviewQuery = reviewQuery.eq('menu_items.menu_categories.restaurant_id', profile.managed_restaurant_id)
  }

  const { data: reviews } = await reviewQuery

  const allReviews = reviews ?? []

  // --- Top-level metrics ---
  const totalReviews = allReviews.length

  const ratedReviews = allReviews.filter(r => r.rating_thumbs !== null)
  const positiveCount = ratedReviews.filter(r => r.rating_thumbs === true).length
  const satisfaction = ratedReviews.length > 0 ? Math.round((positiveCount / ratedReviews.length) * 100) : null

  // Week-over-week review growth
  const now = Date.now()
  const msWeek = 7 * 24 * 60 * 60 * 1000
  const thisWeekCount = allReviews.filter(r => now - new Date(r.created_at).getTime() < msWeek).length
  const lastWeekCount = allReviews.filter(r => {
    const age = now - new Date(r.created_at).getTime()
    return age >= msWeek && age < 2 * msWeek
  }).length
  const weekDelta = lastWeekCount > 0
    ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
    : thisWeekCount > 0 ? 100 : 0

  // Return rate: users with more than 1 review
  const userReviewCounts: Record<string, number> = {}
  for (const r of allReviews) {
    if (r.user_id) userReviewCounts[r.user_id] = (userReviewCounts[r.user_id] || 0) + 1
  }
  const uniqueDiners = Object.keys(userReviewCounts).length
  const returningDiners = Object.values(userReviewCounts).filter(c => c > 1).length
  const returnRate = uniqueDiners > 0 ? Math.round((returningDiners / uniqueDiners) * 100) : null

  // --- Per-item leaderboard ---
  type ItemStat = {
    id: string
    name: string
    category: string
    price: number
    total: number
    positive: number
    negative: number
    satisfaction: number | null
  }

  const itemMap: Record<string, ItemStat> = {}
  for (const r of allReviews) {
    const item = r.menu_items as any
    if (!item?.id) continue
    if (!itemMap[item.id]) {
      itemMap[item.id] = {
        id: item.id,
        name: item.name,
        category: item.menu_categories?.name ?? '—',
        price: item.price,
        total: 0,
        positive: 0,
        negative: 0,
        satisfaction: null,
      }
    }
    itemMap[item.id].total++
    if (r.rating_thumbs === true) itemMap[item.id].positive++
    if (r.rating_thumbs === false) itemMap[item.id].negative++
  }

  // Compute satisfaction per item
  for (const stat of Object.values(itemMap)) {
    const rated = stat.positive + stat.negative
    stat.satisfaction = rated > 0 ? Math.round((stat.positive / rated) * 100) : null
  }

  // Sort by total reviews desc, then satisfaction desc
  const leaderboard = Object.values(itemMap).sort((a, b) =>
    b.total !== a.total ? b.total - a.total : (b.satisfaction ?? 0) - (a.satisfaction ?? 0)
  )

  return (
    <>
      <Header title="Dashboard Overview" />
      <main className="flex-1 overflow-auto p-8 bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Top Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Reviews */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                {weekDelta !== 0 && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${weekDelta > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-500'}`}>
                    {weekDelta > 0 ? '+' : ''}{weekDelta}% this week
                  </span>
                )}
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100">{totalReviews}</p>
              <p className="text-sm font-semibold text-slate-400 mt-1">Total Reviews</p>
              {thisWeekCount > 0 && (
                <p className="text-xs text-slate-400 mt-2">{thisWeekCount} in the last 7 days</p>
              )}
            </div>

            {/* Avg Satisfaction */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                {satisfaction !== null && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    satisfaction >= 70 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : satisfaction >= 40 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-500'
                  }`}>
                    {satisfaction >= 70 ? 'Excellent' : satisfaction >= 40 ? 'Fair' : 'Needs work'}
                  </span>
                )}
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {satisfaction !== null ? `${satisfaction}%` : '—'}
              </p>
              <p className="text-sm font-semibold text-slate-400 mt-1">Avg Satisfaction</p>
              <p className="text-xs text-slate-400 mt-2">{positiveCount} 👍 · {ratedReviews.length - positiveCount} 👎</p>
            </div>

            {/* Return Rate */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-500" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {returnRate !== null ? `${returnRate}%` : '—'}
              </p>
              <p className="text-sm font-semibold text-slate-400 mt-1">Return Rate</p>
              <p className="text-xs text-slate-400 mt-2">{returningDiners} of {uniqueDiners} diner{uniqueDiners !== 1 ? 's' : ''} returned</p>
            </div>
          </div>

          {/* Menu Item Leaderboard */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Menu Item Leaderboard</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Live dish performance ranked by review volume.</p>
            </div>

            {leaderboard.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-400">
                <Star className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">No reviews yet</p>
                <p className="text-sm mt-1">Reviews from your diners will appear here.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="px-6 py-4 w-10">#</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-center">Reviews</th>
                    <th className="px-6 py-4 text-center">Satisfaction</th>
                    <th className="px-6 py-4 text-center">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {leaderboard.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group/row">
                      <td className="px-6 py-4">
                        <span className={`text-sm font-black ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-slate-300 dark:text-slate-600'}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/feedback?item=${item.id}`} className="group/link">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm group-hover/link:text-emerald-600 dark:group-hover/link:text-emerald-400 transition-colors flex items-center gap-1.5">
                            {item.name}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover/row:opacity-60 transition-opacity" />
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">PKR {item.price}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-black text-slate-900 dark:text-slate-100">{item.total}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.satisfaction !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={`font-black text-sm ${
                              item.satisfaction >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                              : item.satisfaction >= 40 ? 'text-amber-500'
                              : 'text-red-500'
                            }`}>
                              {item.satisfaction}%
                            </span>
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${item.satisfaction >= 70 ? 'bg-emerald-500' : item.satisfaction >= 40 ? 'bg-amber-400' : 'bg-red-500'}`}
                                style={{ width: `${item.satisfaction}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <ThumbsUp className="w-3 h-3" />{item.positive}
                          </span>
                          <span className="flex items-center gap-1 text-red-400 font-semibold">
                            <ThumbsDown className="w-3 h-3" />{item.negative}
                          </span>
                          {item.total - item.positive - item.negative > 0 && (
                            <span className="flex items-center gap-1 font-semibold">
                              <Minus className="w-3 h-3" />{item.total - item.positive - item.negative}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent Activity */}
          {allReviews.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Recent Activity</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Latest diner reviews across all dishes.</p>
                </div>
                <Link href="/feedback" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                  View all →
                </Link>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {allReviews.slice(0, 6).map((r: any) => {
                  const user = r.users as { full_name: string | null; email: string | null } | null;
                  const item = r.menu_items as { id: string; name: string } | null;
                  const dinerName = user?.full_name || "Deleted User";
                  return (
                    <Link
                      key={r.id}
                      href={`/feedback?item=${item?.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-black text-indigo-600 dark:text-indigo-400 shrink-0">
                        {getInitial(user?.full_name ?? null, user?.email ?? null)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{dinerName}</p>
                          <span className="text-slate-300 dark:text-slate-600 text-xs shrink-0">·</span>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate shrink-0">{item?.name ?? "Unknown"}</p>
                        </div>
                        {r.public_note && (
                          <p className="text-xs text-slate-400 truncate mt-0.5 italic">"{r.public_note}"</p>
                        )}
                      </div>

                      {/* Rating + time */}
                      <div className="flex items-center gap-3 shrink-0">
                        {r.rating_thumbs === true && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                            <ThumbsUp className="w-3 h-3" /> Positive
                          </span>
                        )}
                        {r.rating_thumbs === false && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
                            <ThumbsDown className="w-3 h-3" /> Negative
                          </span>
                        )}
                        <span className="text-xs text-slate-400 w-14 text-right">{timeAgo(r.created_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </>
  )
}
