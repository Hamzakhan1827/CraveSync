'use server'

import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

type FollowupPolicy = 'apology_only' | 'discount_offer' | 'free_item' | 'custom_message'

export async function saveFollowupPolicy(payload: {
  restaurantId: string
  followupEnabled: boolean
  followupPolicy: FollowupPolicy
  followupDiscountPercent: number
  followupCustomTemplate: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify the user actually manages this restaurant
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('managed_restaurant_id')
    .eq('id', user.id)
    .single()

  if (profile?.managed_restaurant_id !== payload.restaurantId) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabaseAdmin
    .from('restaurants')
    .update({
      followup_enabled: payload.followupEnabled,
      followup_policy: payload.followupPolicy,
      followup_discount_percent: payload.followupDiscountPercent,
      followup_custom_template: payload.followupPolicy === 'custom_message'
        ? payload.followupCustomTemplate || null
        : null,
    })
    .eq('id', payload.restaurantId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function saveCampaignSettings(payload: {
  restaurantId: string
  recoveryEmailsEnabled: boolean
  winbackEmailsEnabled: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('managed_restaurant_id')
    .eq('id', user.id)
    .single()

  if (profile?.managed_restaurant_id !== payload.restaurantId) {
    return { error: 'Unauthorized' }
  }

  const { error } = await supabaseAdmin
    .from('restaurants')
    .update({
      recovery_emails_enabled: payload.recoveryEmailsEnabled,
      winback_emails_enabled: payload.winbackEmailsEnabled,
    })
    .eq('id', payload.restaurantId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}
