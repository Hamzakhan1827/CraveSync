import { Header } from '@/components/Header'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MenuManager } from '@/components/MenuManager'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'

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

const getCachedRestaurantName = unstable_cache(
  async (restaurantId: string) => {
    const { data, error } = await supabaseAdmin
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single()
    if (error) throw error
    return data?.name || 'Unknown Restaurant'
  },
  ['restaurant-name'],
  { revalidate: 300, tags: ['restaurant'] }
)

const getCachedRestaurantMenuItemsAndCats = unstable_cache(
  async (restaurantId: string) => {
    const [
      { data: menuItems, error: err1 },
      { data: categories, error: err2 }
    ] = await Promise.all([
      supabaseAdmin
        .from('menu_items')
        .select(`
          id,
          name,
          price,
          description,
          image_url,
          category_id,
          menu_categories!inner (
            name,
            restaurant_id
          )
        `)
        .eq('menu_categories.restaurant_id', restaurantId)
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('menu_categories')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
    ])

    if (err1 || err2) throw new Error('Failed to fetch menu items')
    return {
      menuItems: menuItems ?? [],
      categories: categories ?? []
    }
  },
  ['restaurant-menu-data'],
  { revalidate: 5, tags: ['menu'] }
)

export default async function RestaurantMenuPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const resolvedParams = await params;
  const restaurantId = resolvedParams.restaurantId;

  const headerList = await headers()
  const userId = headerList.get('x-user-id')

  if (!userId) redirect('/login')

  const profile = await getCachedUserProfile(userId)

  if (!profile?.is_super_admin && profile?.managed_restaurant_id !== restaurantId) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <p className="text-xl text-slate-500">You do not have access to manage this restaurant.</p>
      </div>
    )
  }

  const restaurantName = await getCachedRestaurantName(restaurantId)

  const { menuItems, categories } = await getCachedRestaurantMenuItemsAndCats(restaurantId)

  // Format menuItems to match MenuItem type (flattening menu_categories array if needed)
  const formattedMenuItems = menuItems?.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    description: item.description,
    image_url: item.image_url,
    category_id: item.category_id,
    menu_categories: Array.isArray(item.menu_categories)
      ? item.menu_categories[0]
      : item.menu_categories
        ? (item.menu_categories as any)
        : undefined
  })) || [];

  return (
    <>
      <Header title={`Menu Manager: ${restaurantName}`} />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          {profile?.is_super_admin && (
            <Link href="/menu" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-semibold mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Master List
            </Link>
          )}
            <MenuManager 
              initialItems={formattedMenuItems} 
              categories={categories || []} 
              restaurantId={restaurantId} 
              restaurantName={restaurantName}
            />
        </div>
      </main>
    </>
  )
}
