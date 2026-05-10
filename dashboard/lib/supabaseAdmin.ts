// dashboard/lib/supabaseAdmin.ts
// SECURE SERVER-SIDE SUPABASE USAGE ONLY
// This module must NEVER be used in frontend code or exposed to clients

import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set. This is required for admin operations.');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set.');
}

// Create admin client with service role key
// This client bypasses RLS and should only be used on the server
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Export a helper to ensure this is never accidentally used in frontend
export function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin can only be used on the server side!');
  }
}
