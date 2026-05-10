// dashboard/scripts/check-db.ts
// ADMIN SCRIPT - Run only from secure backend environment
// Usage: npx ts-node scripts/check-db.ts

import { supabaseAdmin, assertServerOnly } from '../lib/supabaseAdmin';

assertServerOnly();

async function check() {
  console.log('Fetching user data from database...');
  
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, managed_restaurant_id, is_super_admin')
      .limit(50);

    if (error) {
      console.error('Error fetching users:', error.message);
      process.exit(1);
    }

    console.log('\n=== User Data ===');
    console.log(JSON.stringify(data, null, 2));
    
    console.log(`\n✓ Successfully retrieved ${data?.length || 0} users`);
  } catch (err: any) {
    console.error('Unexpected error:', err.message);
    process.exit(1);
  }
}

check();
