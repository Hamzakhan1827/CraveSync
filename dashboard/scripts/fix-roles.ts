// dashboard/scripts/fix-roles.ts
// ADMIN SCRIPT - Run only from secure backend environment
// Usage: npx ts-node scripts/fix-roles.ts
// This script links user accounts to their managed restaurants

import { supabaseAdmin, assertServerOnly } from '../lib/supabaseAdmin';

assertServerOnly();

async function fixRoles() {
  console.log('Starting role assignment process...');
  
  try {
    // Get all restaurants
    const { data: restaurants, error: restError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name');

    if (restError || !restaurants) {
      console.error('Error fetching restaurants:', restError?.message);
      process.exit(1);
    }

    console.log(`Found ${restaurants.length} restaurants`);

    // Find Kolachi restaurant
    const kolachi = restaurants.find(r => r.name.toLowerCase().includes('kolachi'));
    if (kolachi) {
      console.log(`Linking kolachi@bitesync.com to ${kolachi.name} (${kolachi.id})`);
      
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ managed_restaurant_id: kolachi.id })
        .eq('email', 'kolachi@bitesync.com');

      if (updateError) {
        console.error(`Error updating Kolachi user: ${updateError.message}`);
      } else {
        console.log('✓ Successfully linked kolachi@bitesync.com');
      }
    } else {
      console.warn('⚠ Kolachi restaurant not found');
    }

    // Find Xanders restaurant
    const xanders = restaurants.find(r => r.name.toLowerCase().includes('xander'));
    if (xanders) {
      console.log(`Linking xanders@bitesync.com to ${xanders.name} (${xanders.id})`);
      
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ managed_restaurant_id: xanders.id })
        .eq('email', 'xanders@bitesync.com');

      if (updateError) {
        console.error(`Error updating Xanders user: ${updateError.message}`);
      } else {
        console.log('✓ Successfully linked xanders@bitesync.com');
      }
    } else {
      console.warn('⚠ Xanders restaurant not found');
    }

    console.log('\n✓ Role assignment complete');
  } catch (err: any) {
    console.error('Unexpected error:', err.message);
    process.exit(1);
  }
}

fixRoles();
