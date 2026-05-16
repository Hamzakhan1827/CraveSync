'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getItemStats(itemId: string) {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('rating_thumbs, public_note, created_at, users(full_name)')
    .eq('menu_item_id', itemId)
    .order('created_at', { ascending: false })

  if (error || !data) return null

  const total = data.length
  const positive = data.filter(r => r.rating_thumbs === true).length
  const negative = data.filter(r => r.rating_thumbs === false).length
  const satisfaction = total > 0 ? Math.round((positive / total) * 100) : null

  const recentNotes = data
    .filter(r => r.public_note)
    .slice(0, 6)
    .map(r => ({
      note: r.public_note!,
      name: (r.users as any)?.full_name || 'Deleted User',
      rating: r.rating_thumbs,
      date: r.created_at,
    }))

  return { total, positive, negative, satisfaction, recentNotes }
}
