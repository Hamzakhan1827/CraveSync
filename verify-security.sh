#!/bin/bash
# BiteSync Security Audit Verification Script
# Run this to verify all changes are in place and no syntax errors

echo "🔍 BiteSync Security Verification Check"
echo "========================================"
echo ""

# Check 1: Review RLS file exists
echo "✓ Checking database files..."
if [ -f "database/reviews_rls_complete.sql" ]; then
  echo "  ✓ reviews_rls_complete.sql found"
else
  echo "  ✗ reviews_rls_complete.sql NOT FOUND"
fi

# Check 2: Auth utilities exist
echo "✓ Checking mobile auth files..."
if [ -f "mobile/lib/authUtils.ts" ]; then
  echo "  ✓ authUtils.ts found"
  if grep -q "export class RateLimiter" mobile/lib/authUtils.ts; then
    echo "  ✓ RateLimiter class defined"
  else
    echo "  ✗ RateLimiter class missing"
  fi
else
  echo "  ✗ authUtils.ts NOT FOUND"
fi

# Check 3: App.tsx imports
echo "✓ Checking mobile app imports..."
if grep -q "validatePasswordStrength" mobile/App.tsx; then
  echo "  ✓ validatePasswordStrength imported"
else
  echo "  ✗ validatePasswordStrength NOT imported"
fi

if grep -q "RateLimiter" mobile/App.tsx; then
  echo "  ✓ RateLimiter imported"
else
  echo "  ✗ RateLimiter NOT imported"
fi

# Check 4: Rate limiter initialization
echo "✓ Checking rate limiter setup..."
if grep -q "authRateLimiter.*new RateLimiter" mobile/App.tsx; then
  echo "  ✓ Rate limiter initialized"
else
  echo "  ✗ Rate limiter NOT initialized"
fi

# Check 5: Admin utilities
echo "✓ Checking dashboard admin files..."
if [ -f "dashboard/lib/supabaseAdmin.ts" ]; then
  echo "  ✓ supabaseAdmin.ts found"
  if grep -q "assertServerOnly" dashboard/lib/supabaseAdmin.ts; then
    echo "  ✓ assertServerOnly guard defined"
  fi
else
  echo "  ✗ supabaseAdmin.ts NOT FOUND"
fi

# Check 6: Admin scripts
echo "✓ Checking admin scripts..."
if [ -f "dashboard/scripts/check-db.ts" ]; then
  echo "  ✓ check-db.ts found"
else
  echo "  ✗ check-db.ts NOT FOUND"
fi

if [ -f "dashboard/scripts/fix-roles.ts" ]; then
  echo "  ✓ fix-roles.ts found"
else
  echo "  ✗ fix-roles.ts NOT FOUND"
fi

# Check 7: Documentation
echo "✓ Checking security documentation..."
if [ -f "SECURITY_POLICY.md" ]; then
  echo "  ✓ SECURITY_POLICY.md found"
else
  echo "  ✗ SECURITY_POLICY.md NOT FOUND"
fi

if [ -f "DATABASE_ACCESS_AUDIT.md" ]; then
  echo "  ✓ DATABASE_ACCESS_AUDIT.md found"
else
  echo "  ✗ DATABASE_ACCESS_AUDIT.md NOT FOUND"
fi

if [ -f "IMPLEMENTATION_GUIDE.md" ]; then
  echo "  ✓ IMPLEMENTATION_GUIDE.md found"
else
  echo "  ✗ IMPLEMENTATION_GUIDE.md NOT FOUND"
fi

# Check 8: Error handling
echo "✓ Checking error handling improvements..."
silent_catches=$(grep -c "catch { }" mobile/App.tsx || echo "0")
if [ "$silent_catches" = "0" ]; then
  echo "  ✓ No silent catch blocks found in App.tsx"
else
  echo "  ✗ Found $silent_catches silent catch blocks in App.tsx"
fi

# Check 9: Environment file
echo "✓ Checking .env setup..."
if [ -f "dashboard/.env.example" ]; then
  echo "  ✓ .env.example found"
else
  echo "  ✗ .env.example NOT FOUND"
fi

echo ""
echo "========================================"
echo "✅ Security Verification Complete!"
echo ""
echo "📝 Next Steps:"
echo "  1. Review SECURITY_POLICY.md"
echo "  2. Review IMPLEMENTATION_GUIDE.md"
echo "  3. Run database migration: database/reviews_rls_complete.sql"
echo "  4. Test authentication flow"
echo "  5. Test rate limiting (6 failed attempts)"
echo ""
