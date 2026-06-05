# 🔄 Complete Database Reset & Redesign

Complete Supabase database reset with clean architecture, strict RLS, and NO recursion.

## 📁 Files Overview

| File | Purpose | Run Order |
|------|---------|-----------|
| `00_wipe_database.sql` | Deletes everything (tables, policies, functions, triggers) | 1st |
| `01_fresh_schema.sql` | Creates fresh schema with proper structure | 2nd |
| `02_helper_functions.sql` | Security definer helper functions (NO recursion) | 3rd |
| `03_rls_policies.sql` | Clean RLS policies using helper functions | 4th |
| `04_seed_test_data.sql` | Creates 2 test shops with data | 5th |
| `05_verification_checklist.md` | Complete testing guide | Reference |

## 🎯 Architecture Overview

### Multi-Tenant Design
```
┌─────────────────────────────────────────┐
│           Supabase Auth                 │
│  (auth.users - authentication only)     │
└──────────────┬──────────────────────────┘
               │
               ├─► Shop A Owner (auth_id_1)
               ├─► Shop A Staff (auth_id_2)
               └─► Shop B Owner (auth_id_3)
               
┌──────────────────────────────────────────┐
│           shops table                     │
│  - id, name, contact info                │
└───┬───────────────────────────────┬──────┘
    │                               │
┌───▼────────────────┐      ┌──────▼─────────────┐
│   Shop A           │      │   Shop B           │
│   - users (owner   │      │   - users (owner)  │
│     + staff)       │      │   - customers      │
│   - customers      │      │   - vehicles       │
│   - vehicles       │      │   - bookings       │
│   - bookings       │      │                    │
└────────────────────┘      └────────────────────┘

      ISOLATED                  ISOLATED
```

### RLS Strategy (NO Recursion)

**Helper Function** (SECURITY DEFINER):
```sql
get_current_user_shop_id() → Returns shop_id for auth.uid()
```

**RLS Policies**:
```sql
-- Instead of querying users table in policy (causes recursion):
WHERE shop_id IN (SELECT shop_id FROM users WHERE auth_id = auth.uid())

-- Use helper function (no recursion):
WHERE shop_id = get_current_user_shop_id()
```

### Schema Design

#### Core Tables
1. **shops** - Rental shop info
2. **users** - Owners + staff (links auth.users to shops)
3. **customers** - Customer records with KYC
4. **vehicles** - Fleet management
5. **bookings** - Rental bookings
6. **payments** - Payment tracking
7. **damages** - Vehicle damage records
8. **documents** - File uploads (future)

#### Key Relationships
```sql
auth.users (Supabase Auth)
    ↓ auth_id
users (app users)
    ↓ shop_id
shops
    ↓ shop_id
customers, vehicles, bookings, payments, damages
```

## 🚀 Quick Start

### Option 1: Complete Reset (Development)

```bash
# In Supabase SQL Editor, run in order:
1. Copy & paste 00_wipe_database.sql → Execute
2. Copy & paste 01_fresh_schema.sql → Execute
3. Copy & paste 02_helper_functions.sql → Execute
4. Copy & paste 03_rls_policies.sql → Execute
5. Copy & paste 04_seed_test_data.sql → Execute
```

### Option 2: Fresh Install (No Existing Data)

```bash
# Skip 00_wipe_database.sql, run:
1. 01_fresh_schema.sql
2. 02_helper_functions.sql
3. 03_rls_policies.sql
4. 04_seed_test_data.sql (optional - for testing)
```

## 🔐 Test Credentials

After seeding, you can login with:

| Email | Password | Role | Shop |
|-------|----------|------|------|
| owner.a@rentoshop.com | TestPass123! | Owner | Shop A |
| staff.a@rentoshop.com | TestPass123! | Staff | Shop A |
| owner.b@rentoshop.com | TestPass123! | Owner | Shop B |

## 🧪 Verification Steps

### 1. Test Shop Isolation
```sql
-- Login as Shop A Owner
SELECT * FROM customers;
-- Should see only Shop A customers

-- Try to access Shop B data
SELECT * FROM customers WHERE shop_id = '<shop_b_id>';
-- Should return empty (RLS blocks it)
```

### 2. Test CRUD Operations
```sql
-- Add customer
INSERT INTO customers (shop_id, name, phone, id_type, id_photos, status)
VALUES (get_current_user_shop_id(), 'Test Customer', '+91-9999999999', 'Aadhaar', '[]', 'Verified');

-- View customers
SELECT * FROM customers;
```

### 3. Test Helper Function
```sql
SELECT get_current_user_shop_id();
-- Should return your shop UUID

SELECT is_current_user_owner();
-- Should return true/false based on role
```

### 4. Test RLS Enforcement
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';
-- All business tables should show true
```

## 📋 Complete Testing

See [05_verification_checklist.md](./05_verification_checklist.md) for comprehensive testing guide covering:
- ✅ Shop isolation
- ✅ CRUD operations
- ✅ Owner vs Staff permissions
- ✅ Helper functions
- ✅ RLS policies
- ✅ App integration
- ✅ Performance checks

## 🔧 Customization

### Add New Table with RLS

```sql
-- 1. Create table
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  -- ... other columns
);

-- 2. Add index
CREATE INDEX idx_new_table_shop_id ON new_table(shop_id);

-- 3. Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- 4. Add policies
CREATE POLICY new_table_select_own_shop 
  ON new_table FOR SELECT 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY new_table_insert_own_shop 
  ON new_table FOR INSERT 
  WITH CHECK (shop_id = get_current_user_shop_id());

CREATE POLICY new_table_update_own_shop 
  ON new_table FOR UPDATE 
  USING (shop_id = get_current_user_shop_id());

CREATE POLICY new_table_delete_own_shop 
  ON new_table FOR DELETE 
  USING (shop_id = get_current_user_shop_id());
```

### Add New User Role

```sql
-- 1. Update users table check constraint
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'staff', 'manager'));

-- 2. Add helper function if needed
CREATE OR REPLACE FUNCTION is_current_user_manager()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_manager BOOLEAN;
BEGIN
  SELECT (role = 'manager') INTO v_is_manager
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(v_is_manager, false);
END;
$$;

-- 3. Update policies to include manager permissions
```

## 🚨 Troubleshooting

### "infinite recursion detected in policy"
**Cause**: RLS policy on `users` table queries `users` table  
**Fix**: Use `get_current_user_shop_id()` helper function instead

### "null value in column shop_id"
**Cause**: User doesn't have entry in `users` table  
**Fix**: Create users table entry after auth user creation

### "permission denied for table"
**Cause**: RLS is blocking access  
**Fix**: Check user has valid shop_id and policies are correct

### No data visible after login
**Cause**: shop_id mismatch or missing users table entry  
**Fix**: Verify user's shop_id matches data shop_id

## 🎯 Production Deployment

### For Supabase Cloud

1. **Create Auth Users** via Admin API:
```javascript
const { data, error } = await supabase.auth.admin.createUser({
  email: 'owner@shop.com',
  password: 'SecurePassword123!',
  email_confirm: true
});
```

2. **Run Migration Files**:
```bash
# Run SQL files 01-04 in Supabase SQL Editor
```

3. **Verify**:
```bash
# Use verification checklist
```

### For Local Development

1. **Run All SQL Files** including auth user creation
2. **Test with seed data**
3. **Develop against local instance**

## 📊 Performance Considerations

- **Indexes**: All shop_id columns indexed for fast lookups
- **SECURITY DEFINER**: Helper function cached per transaction
- **RLS**: Policies use indexed columns (shop_id)
- **Triggers**: Only on updated_at columns

## 🔒 Security Notes

- ✅ RLS enabled on ALL business tables
- ✅ NO policies use `USING (true)` or disabled RLS
- ✅ Helper function is SECURITY DEFINER to avoid recursion
- ✅ Shop isolation is strict - no cross-shop data access
- ✅ Role-based permissions (owner vs staff)
- ✅ All foreign keys enforce referential integrity

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Definer Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Multi-tenant Patterns](https://supabase.com/docs/guides/auth/row-level-security#multi-tenant-apps)

## 🎉 Success Checklist

After running all files:

- [ ] All tables created
- [ ] All indexes created
- [ ] All triggers created
- [ ] Helper functions work
- [ ] RLS enabled on all tables
- [ ] No recursion errors
- [ ] Shop isolation verified
- [ ] CRUD operations work
- [ ] Owner/staff permissions correct
- [ ] App can login and view data
- [ ] Multi-user same shop works
- [ ] Cross-shop data invisible

## 📞 Support

If issues persist:
1. Check Supabase logs for errors
2. Verify user has entry in users table
3. Test with service role (bypasses RLS)
4. Review 05_verification_checklist.md
5. Check auth.uid() returns valid UUID

---

**Last Updated**: January 2026  
**Tested On**: Supabase Cloud + Local  
**Status**: Production Ready ✅
