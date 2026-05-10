# Security Policy for BiteSync

## Environment Variables

### Frontend (Mobile App & Web)
Only use these environment variables in frontend code:
- `EXPO_PUBLIC_SUPABASE_URL` - Public Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key (safe for frontend)

**Never expose these in frontend code:**
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key, server-only!

### Backend (Dashboard & Scripts)
These variables should ONLY be in `.env.local` and never committed to git:
- `NEXT_PUBLIC_SUPABASE_URL` - Public project URL (safe)
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key (must be secret!)

## Key Principles

1. **Service Role Key Protection**
   - Never import `SUPABASE_SERVICE_ROLE_KEY` in frontend bundles
   - Always verify you're in a server context before using admin clients
   - Use `assertServerOnly()` helper function in admin utilities
   - All admin scripts must be in `/scripts` directory with `.ts` extension
   - Admin scripts should never be deployed or exposed

2. **Environment File Management**
   - `.env.local` must be in `.gitignore`
   - `.env.example` should show the structure but NOT contain real values
   - Use different service role keys for development vs production
   - Rotate keys periodically

3. **Frontend Security**
   - Only use Supabase anon key with RLS enforcement
   - Never trust client-side data validation alone
   - Always rely on server-side RLS policies
   - Rate limit authentication attempts
   - Implement proper password requirements

4. **Database Security**
   - RLS must be enabled on all tables
   - Public data should have explicit SELECT policies
   - User data should be owner-only (except where public)
   - Service role bypasses RLS (normal Supabase behavior)
   - Review policies quarterly

5. **Deployment**
   - Staging: Use separate Supabase project
   - Production: Use another separate Supabase project
   - Never share service role keys across environments
   - Use GitHub secrets for CI/CD deployments
   - Never log credentials or sensitive data

## Audit Trail

- Review RLS policies: `database/reviews_rls_complete.sql`
- Review auth validation: `mobile/lib/authUtils.ts`
- Review admin utilities: `dashboard/lib/supabaseAdmin.ts`
- Admin scripts: `dashboard/scripts/` (TypeScript only)

## Quick Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` appears in any `.tsx` or `.jsx` files
- [ ] All admin scripts use `supabaseAdmin` client
- [ ] All admin scripts use `assertServerOnly()` guard
- [ ] Frontend uses only `EXPO_PUBLIC_*` variables
- [ ] Rate limiter is initialized for auth endpoints
- [ ] Password validation requires 8+ chars, mixed case, numbers
- [ ] All fetch functions have error logging
- [ ] RLS policies are comprehensive (SELECT, INSERT, UPDATE, DELETE)
