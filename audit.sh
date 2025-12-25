#!/bin/bash
# AUDIT SCRIPT: Find all service role usage in backend routes

echo "=== AUDIT: Service Role Usage in Backend ==="
echo ""
echo "1. Files importing supabaseAdmin (should only be scripts/admin):"
grep -r "import.*supabaseAdmin" backend/server/ --include="*.ts" || echo "   ✓ No imports in server routes"

echo ""
echo "2. Files using supabase. (old service role client):"
grep -r "supabase\." backend/server/ --include="*.ts" | grep -v "getSupabaseUserClient\|getSupabaseAdminClient" || echo "   ✓ No service role usage"

echo ""
echo "3. Routes that use requireAuth:"
grep -r "requireAuth" backend/server/routes.ts | head -20 || echo "   ✗ Missing requireAuth checks"

echo ""
echo "4. Routes using getUserClient:"
grep -r "getUserClient" backend/server/routes.ts | wc -l

echo ""
echo "=== AUDIT COMPLETE ==="
