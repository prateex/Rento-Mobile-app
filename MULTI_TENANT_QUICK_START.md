# Multi-Tenant Architecture: Quick Start Guide

## ✅ Status: All Functions Deployed

**Migrations Applied:**
- ✅ `20250106000000_initial_schema.sql` - Schema creation
- ✅ `20250106000001_multi_tenant_functions.sql` - User/shop management functions

## 📋 Available Functions

### 1. Create Shop
```javascript
const { data: shop_id, error } = await supabase.rpc('create_rental_shop', {
  p_name: 'ABC Rentals',
  p_phone: '9876543210',
  p_email: 'shop@abc.com',
  p_address: '123 Main St',
  p_city: 'New York',
  p_state: 'NY',
  p_pincode: '10001',
  p_gst_number: 'GST123'
});
```

### 2. Create Owner
```javascript
const { data: user_id, error } = await supabase.rpc('create_owner', {
  p_auth_user_id: 'auth-user-uuid',
  p_shop_id: 'shop-uuid'
});
```

### 3. Create Staff
```javascript
const { data: user_id, error } = await supabase.rpc('create_staff', {
  p_auth_user_id: 'auth-user-uuid',
  p_shop_id: 'shop-uuid'
});
```

### 4. Promote Staff to Owner
```javascript
const { data: message, error } = await supabase.rpc('promote_staff_to_owner', {
  p_auth_user_id: 'auth-user-uuid',
  p_shop_id: 'shop-uuid'
});
```

### 5. Deactivate User
```javascript
const { data: message, error } = await supabase.rpc('deactivate_user', {
  p_auth_user_id: 'auth-user-uuid'
});
```

### 6. Get Current User Context
```javascript
const { data: context, error } = await supabase.rpc('get_current_user_context');
// Returns: { user_id, shop_id, role, is_active }
```

## 🔐 Safety Guarantees

| Guarantee | Implementation |
|-----------|-----------------|
| **Only 1 owner per shop** | Unique index on (shop_id, role) WHERE role='owner' |
| **No orphan users** | Foreign key with CASCADE delete |
| **No cross-shop access** | RLS filters all queries by shop_id |
| **No direct role changes** | Only `promote_staff_to_owner()` can change roles |
| **Auth preserved** | Never delete from auth.users (soft delete via is_active) |
| **Input validation** | All functions validate required inputs |
| **No hardcoding** | Functions accept explicit parameters |

## 🚀 Operational Flow

```
1. Owner Signup
   └─> supabase.auth.signUp({ email, password })
   └─> Get auth_user_id

2. Create Shop
   └─> supabase.rpc('create_rental_shop', { ... })
   └─> Get shop_id

3. Create Owner Account
   └─> supabase.rpc('create_owner', { auth_user_id, shop_id })
   └─> Owner can now login and manage shop

4. Invite Staff
   └─> Send email with invite link

5. Staff Signup
   └─> supabase.auth.signUp({ email, password })
   └─> Get staff_auth_user_id

6. Assign Staff to Shop
   └─> supabase.rpc('create_staff', { staff_auth_user_id, shop_id })
   └─> Staff can now access shop data

7. After Login
   └─> supabase.rpc('get_current_user_context')
   └─> Render UI based on role (owner vs staff)
```

## 📊 Database Design

### Users Table
```
id           │ UUID (PK)
auth_id      │ UUID (FK → auth.users.id)
shop_id      │ UUID (FK → rental_shops.id)
name         │ TEXT
email        │ TEXT
role         │ user_role (admin, owner, staff)
is_active    │ BOOLEAN
created_at   │ TIMESTAMPTZ
updated_at   │ TIMESTAMPTZ
```

### Rental Shops Table
```
id           │ UUID (PK)
owner_id     │ UUID (FK → auth.users.id)
name         │ TEXT
phone        │ TEXT
email        │ TEXT
address      │ TEXT
city         │ TEXT
state        │ TEXT
pincode      │ TEXT
gst_number   │ TEXT
created_at   │ TIMESTAMPTZ
updated_at   │ TIMESTAMPTZ
```

### Key Constraints
- `users.auth_id` → `auth.users.id` (UNIQUE, ON DELETE CASCADE)
- `users.shop_id` → `rental_shops.id` (ON DELETE CASCADE)
- `rental_shops.owner_id` → `auth.users.id` (ON DELETE CASCADE)
- **UNIQUE INDEX:** `(shop_id, role) WHERE role='owner'` (only 1 owner per shop)

## 🔒 RLS Policies Summary

| Table | Owner Can | Staff Can |
|-------|-----------|-----------|
| `rental_shops` | View/Update own shop | View own shop |
| `users` | View/Insert staff | View own record |
| `bookings` | Create/View/Update all | Create/View/Update own shop |
| `vehicles` | Create/View/Update all | View/Update own shop |
| `customers` | Create/View/Update all | Create/View/Update own shop |
| `payments` | View/Insert all | View/Insert own shop |
| `damages` | View/Insert all | View/Insert own shop |

## ⚠️ Important Rules

### Frontend Can Call
✅ `supabase.auth.signUp()`
✅ `supabase.auth.signInWithPassword()`
✅ `supabase.rpc('create_rental_shop', ...)`
✅ `supabase.rpc('create_owner', ...)`
✅ `supabase.rpc('create_staff', ...)`
✅ `supabase.rpc('promote_staff_to_owner', ...)`
✅ `supabase.rpc('deactivate_user', ...)`
✅ `supabase.rpc('get_current_user_context')`
✅ `supabase.from('bookings').select('*')` (RLS applies)

### Frontend CANNOT Do
❌ Direct INSERT/UPDATE/DELETE on `users` table
❌ Direct INSERT on `auth.users`
❌ Set custom JWT claims
❌ Bypass RLS policies
❌ Change user roles directly
❌ Delete from auth.users

## 🧪 Testing the Functions

### 1. Create Owner + Shop
```javascript
// Step 1: Auth signup
const { data: auth } = await supabase.auth.signUp({
  email: 'owner@shop.com',
  password: 'SecurePass123'
});

// Step 2: Create shop
const { data: shop_id } = await supabase.rpc('create_rental_shop', {
  p_name: 'Test Shop',
  p_phone: '1234567890'
});

// Step 3: Create owner
const { data: user_id } = await supabase.rpc('create_owner', {
  p_auth_user_id: auth.user.id,
  p_shop_id: shop_id
});

console.log('Owner created:', user_id);
```

### 2. Create Staff
```javascript
// Step 1: Staff auth signup
const { data: staff_auth } = await supabase.auth.signUp({
  email: 'staff@shop.com',
  password: 'SecurePass123'
});

// Step 2: Assign to shop
const { data: staff_user_id } = await supabase.rpc('create_staff', {
  p_auth_user_id: staff_auth.user.id,
  p_shop_id: shop_id
});

console.log('Staff created:', staff_user_id);
```

### 3. Verify Access Control
```javascript
// Login as staff
await supabase.auth.signInWithPassword({
  email: 'staff@shop.com',
  password: 'SecurePass123'
});

// Get context
const { data: context } = await supabase.rpc('get_current_user_context');
console.log('User role:', context.role); // 'staff'
console.log('Shop ID:', context.shop_id);

// Try to access only own shop data
const { data: bookings } = await supabase
  .from('bookings')
  .select('*');
// RLS automatically filters to only this shop's bookings
```

## 🐛 Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Shop does not exist" | Invalid shop_id | Create shop first with `create_rental_shop()` |
| "User already exists" | Duplicate user in shop | Check if user is already in users table |
| "Shop already has an owner" | Multiple owners attempted | Use `promote_staff_to_owner()` to change owner |
| "User not found" | auth_user_id doesn't exist | Ensure auth signup succeeded first |
| "Auth user does not exist" | Invalid auth_user_id UUID | Verify UUID format |

## 📚 Documentation Files

- `MULTI_TENANT_ARCHITECTURE.sql` - Complete architecture guide with examples
- `20250106000000_initial_schema.sql` - Core schema migration
- `20250106000001_multi_tenant_functions.sql` - Functions migration
- `MIGRATION_APPLIED_SUCCESS.md` - Migration verification report

## 🚢 Deployment to Production

When ready to deploy to production:

```bash
# Test locally first
supabase db push --local

# Push to production
supabase db push --remote

# Verify in production
supabase migration list --remote
```

---

**All functions are live and ready for use! 🎉**
