# RLS Remediation - Quick Reference

**Migration File**: `20260213000000_restore_missing_rls.sql`  
**Status**: Ready for Deployment  
**Scope**: 5 tables, 12 policies, ~150 lines of SQL

---

## TABLE-BY-TABLE POLICY SUMMARY

### 1️⃣ customer_profiles

| Policy Name | Type | USING Condition |
|---|---|---|
| customer_profiles_select_own | SELECT | `auth_id = auth.uid()` |
| customer_profiles_insert_own | INSERT | `auth_id = auth.uid()` |
| customer_profiles_update_own | UPDATE | `auth_id = auth.uid()` |
| customer_profiles_delete_own | DELETE | `auth_id = auth.uid()` |

**Effect**: Customer can only CRUD their own profile (matched by auth_id)

---

### 2️⃣ customer_id_documents

| Policy Name | Type | USING Condition |
|---|---|---|
| customer_id_documents_select_own | SELECT | `customer_auth_id = auth.uid()` |
| customer_id_documents_insert_own | INSERT | `customer_auth_id = auth.uid()` |
| customer_id_documents_update_own | UPDATE | `customer_auth_id = auth.uid()` |
| customer_id_documents_delete_own | DELETE | `customer_auth_id = auth.uid()` |

**Effect**: Customer can only CRUD their own license/ID documents (matched by customer_auth_id)

---

### 3️⃣ marketplace_locations

| Policy Name | Type | USING Condition | Role |
|---|---|---|---|
| marketplace_locations_select_active | SELECT | `is_active = true` | authenticated |

**Effect**: Any logged-in user can discover active pickup locations (public read-only)

---

### 4️⃣ marketplace_payment_events

| Policy Name | Type | Access Logic |
|---|---|---|
| marketplace_payment_events_select_customer | SELECT | Can view if customer_auth_id matches their booking |
| marketplace_payment_events_select_owner | SELECT | Can view if owner_id matches their shop |

**Effect**: Customer & shop owner can view payment events for their own bookings/shops (via FK join chain)

---

### 5️⃣ marketplace_payment_reconciliation

| Policy Name | Type | Access Logic |
|---|---|---|
| marketplace_payment_reconciliation_system_only | ALL | `false` (deny all) |

**Effect**: RLS blocks all access; backend service role must grant access via API authorization

---

## DEPLOYMENT COMMAND

```bash
# Development (with reset)
cd c:\App Project\Rento App Project\Development\Rento-App-03
supabase db reset

# Production (push only)
supabase db push
```

---

## VERIFY AFTER DEPLOYMENT

```bash
# Run verification script
psql <connection_string> -f RLS_VERIFICATION_SCRIPT.sql
```

**Expected Output**:
```
✅ customer_profiles: 4 policies
✅ customer_id_documents: 4 policies
✅ marketplace_locations: 1 policy
✅ marketplace_payment_events: 2 policies
✅ marketplace_payment_reconciliation: 1 policy
```

---

## MIGRATION FILE LOCATION

```
c:\App Project\Rento App Project\Development\Rento-App-03\
  └── supabase\
      └── migrations\
          └── 20260213000000_restore_missing_rls.sql  ← THIS FILE
```

---

## POLICIES AT A GLANCE

| Table | Enable RLS | SELECT | INSERT | UPDATE | DELETE | Total |
|-------|---|---|---|---|---|---|
| customer_profiles | ✅ | ✅ | ✅ | ✅ | ✅ | 4 |
| customer_id_documents | ✅ | ✅ | ✅ | ✅ | ✅ | 4 |
| marketplace_locations | ✅ | ✅ | — | — | — | 1 |
| marketplace_payment_events | ✅ | ✅ | — | — | — | 2 |
| marketplace_payment_reconciliation | ✅ | — | — | — | — | 1 |

---

## FAQ

**Q: Will this break existing functionality?**  
A: No. RLS layer filters rows invisibly. Users only see their own data, which is the correct behavior.

**Q: Do I need to change application code?**  
A: No code changes needed. RLS operates at database layer.

**Q: Can I rollback if something breaks?**  
A: Yes. Apply a forward-fix migration dropping the policies, or disable RLS on affected tables (use only in emergency).

**Q: How long does it take to apply?**  
A: <1 second (dev), <5 seconds (production). Metadata-only, no data migration.

**Q: What if I see "permission denied" errors after deployment?**  
A: Check JWT token has correct `auth.uid()`. User must exist in referenced tables (customers, users, etc.).

---

## RELATED DOCUMENTS

| Document | Purpose |
|----------|---------|
| [RLS_FORENSIC_INVESTIGATION_COMPLETE.md](RLS_FORENSIC_INVESTIGATION_COMPLETE.md) | Root cause analysis of missing RLS |
| [RLS_REMEDIATION_IMPLEMENTATION_GUIDE.md](RLS_REMEDIATION_IMPLEMENTATION_GUIDE.md) | Detailed deployment & testing guide |
| [RLS_VERIFICATION_SCRIPT.sql](RLS_VERIFICATION_SCRIPT.sql) | SQL to validate RLS state |
| [RLS_REMEDIATION_DEPLOYMENT_SUMMARY.md](RLS_REMEDIATION_DEPLOYMENT_SUMMARY.md) | Executive summary |

---

**Ready to deploy?** → Run `supabase db reset` or `supabase db push`

