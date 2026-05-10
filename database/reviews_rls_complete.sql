-- BiteSync Complete Review RLS Policies
-- This file provides comprehensive coverage for reviews table security
-- Run in Supabase SQL Editor

-- Ensure RLS is enabled on reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 1. Users can view their own reviews (including private notes)
-- This allows users to see their personal diary with private_note content
DROP POLICY IF EXISTS "Users can view own reviews" ON reviews;
CREATE POLICY "Users can view own reviews" ON reviews
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Public can view reviews with public notes only
-- This allows anyone (authenticated or not) to see public feedback
-- Only reviews with non-empty public_note are visible
DROP POLICY IF EXISTS "Public can view reviews with public notes" ON reviews;
CREATE POLICY "Public can view reviews with public notes" ON reviews
  FOR SELECT
  TO public
  USING (public_note IS NOT NULL AND public_note != '');

-- 3. Authenticated users can insert their own reviews
DROP POLICY IF EXISTS "Users can insert own reviews" ON reviews;
CREATE POLICY "Users can insert own reviews" ON reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Users can update their own reviews
-- Note: Business logic enforces 5-minute edit window on frontend
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Users can delete their own reviews
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can bypass RLS for backend operations
-- (This is automatic with service_role key)
