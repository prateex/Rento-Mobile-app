## FIX IS_PUBLISHED COLUMN - MANUAL SUPABASE DASHBOARD STEPS

### ERROR CONTEXT
Owner app sends `is_published` when updating vehicles, but Supabase throws:
```
PGRST204: column 'is_published' does not exist.
```

### SOLUTION
The migration file exists but hasn't been applied to the database. Follow these steps to apply it manually.

---

## STEPS TO APPLY MIGRATION

### 1. Open Supabase Dashboard
- **URL**: https://supabase.com/dashboard/project/vamxwwgjjfqvwcceedyk
- **Or**: Log in to Supabase → Select "Rento" project

### 2. Go to SQL Editor
- Click "SQL Editor" in the left sidebar
- Click "New Query"

### 3. Copy and Paste the Migration SQL

Copy **ALL** of this SQL:

```sql
-- MIGRATION 009: ADD IS_PUBLISHED COLUMN TO VEHICLES
BEGIN;

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false NOT NULL;

UPDATE vehicles 
SET is_published = true 
WHERE is_published = false;

COMMIT;
```

### 4. Click "Run"
- The query should execute with **"Success. No rows returned."** message

### 5. Verify the Column Was Added
Run this verification query in a new SQL Editor tab:

```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name='vehicles' AND column_name='is_published';
```

**Expected result:**
```
column_name   | data_type | is_nullable | column_default
is_published  | boolean   | false       | false
```

---

## TEST THE FIX

### In Owner App:
1. Go to **Bikes** page
2. **Edit** any vehicle
3. Toggle the **"Publish on Website"** checkbox
4. Click **Save**
5. **Verify**: The PATCH request succeeds (Network tab shows 200 status)
6. **Verify**: The vehicle shows as published in the list

### Expected Success:
- ✓ No PGRST204 error
- ✓ Vehicle saves with published status
- ✓ Checkbox toggle persists after refresh

---

## MIGRATION FILE LOCATION
If needed, the migration files are in:
- Local: `backend/migrations/009_add_is_published_to_vehicles.sql`
- Supabase CLI: `supabase/migrations/20260204162235_add_is_published_to_vehicles.sql`

---

## IF MIGRATION FAILS

**Error: "column already exists"**
- The column was already added (just update existing vehicles)
- Run: `UPDATE vehicles SET is_published = true WHERE is_published = false;`

**Error: "permission denied"**
- Your Supabase account doesn't have write permissions
- Contact the project owner or check if you're logged in as the right user

**Still getting PGRST204 error after migration?**
- The schema cache may need refresh
- In Supabase dashboard: Settings → Database → Press "Refresh Schema Cache"
- Or restart your local dev server: `npm run dev`

---

## PROGRESS TRACKING

After completing the steps above, confirm with:
```
Migration Status: ✓ COMPLETE
Column Added: is_published BOOLEAN DEFAULT false NOT NULL
Existing Vehicles: All set to is_published = true
Ready to Test: YES
```
