import { Header } from '@/components/Header'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { RestaurantManager } from '@/components/RestaurantManager'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'

const getCachedUserProfile = unstable_cache(
  async (userId: string) => {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('managed_restaurant_id, is_super_admin')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data
  },
  ['user-profile'],
  { revalidate: 60, tags: ['profile'] }
)

const getCachedAdminRestaurantsList = unstable_cache(
  async () => {
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, logo_url, address, cuisine_type')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
  ['admin-restaurants-list'],
  { revalidate: 10, tags: ['restaurants'] }
)

export default async function MasterMenuPage() {
  const headerList = await headers()
  const userId = headerList.get('x-user-id')

  if (!userId) redirect('/login')

  const profile = await getCachedUserProfile(userId)

  if (!profile?.is_super_admin) {
    if (profile?.managed_restaurant_id) {
      redirect(`/menu/${profile.managed_restaurant_id}`)
    }
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <p className="text-xl text-slate-500">Your account is not linked to any restaurant. Please contact support.</p>
      </div>
    )
  }

  const restaurants = await getCachedAdminRestaurantsList()

  return (
    <>
      <Header title="Platform Master Dashboard" />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <RestaurantManager initialRestaurants={restaurants} />
        </div>
      </main>
    </>
  )
}
