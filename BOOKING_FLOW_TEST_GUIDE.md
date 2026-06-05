# Complete Booking Flow Test Guide

## Test: Create Booking → Mark Taken → Mark Returned → Generate Invoice

### Prerequisites
- Dev server running on http://127.0.0.1:3000
- Supabase local or cloud configured
- At least 1 existing customer
- At least 1 available vehicle

### Test Steps

#### 1. **Create a New Booking**
- Navigate to `Bookings` tab
- Click "+ New Booking"
- Select rental dates & times (with day/time picker)
  - Start: Today 10:00 AM
  - End: Tomorrow 2:00 PM (for quick testing)
- Select an available vehicle
- Select an existing customer
- Enter Rent: 500, Deposit: 100
- Click "Create Booking"
- **Expected**: 
  - Booking created with status `Booked`
  - `start_datetime` and `end_datetime` populated (verify in DB)
  - Booking number assigned (e.g., BK0001)

#### 2. **Mark Booking as Taken**
- On the newly created booking, click the "Play" (▶️) icon
- Enter opening odometer reading (e.g., 12000)
- Click "Mark as Taken"
- **Expected**:
  - Booking status changes to `Taken` (or `Active`)
  - `taken_at` timestamp recorded
  - `opening_odometer` set to value entered
  - Vehicle status changes to `Rented`
  - Toast: "Vehicle Taken" with odometer reading

#### 3. **Mark Booking as Returned**
- On the same booking (now showing status `Taken`/`Active`), click "Return" (↙️) icon
- Enter closing odometer reading (e.g., 12150)
- Optionally add damages (mark a Scratch, Minor severity)
- Review deposit deduction (if any)
- Click through steps: Odometer → Damages → Deposit → Invoice
- **Expected**:
  - Booking status changes to `Completed`
  - `returned_at` timestamp recorded
  - `closing_odometer` set
  - `total_km_driven` calculated (150 km)
  - Vehicle status changes to `Available`
  - Invoice number assigned
  - Toast: "Return Processed"

#### 4. **Verify Invoice**
- Click the "Invoice" (📄) icon on the returned booking
- Check:
  - Invoice number present (e.g., INV/2024-2501)
  - Rent amount = 500
  - Tax amount calculated if GST configured
  - Total = Rent + Tax + Damage Deductions
  - Can send via WhatsApp (button visible)
  - Toast confirmation if sent

### Expected Database State After All Steps
```sql
-- Booking
SELECT id, booking_number, status, start_datetime, end_datetime, 
       opening_odometer, closing_odometer, taken_at, returned_at, 
       total_amount, invoice_number
FROM bookings
WHERE booking_number = 'BK0001';

-- Result: All fields populated, status = 'Completed', datetimes set, odometers recorded
```

### What This Tests
✅ `start_datetime` and `end_datetime` composition in frontend
✅ Immediate update of datetimes after booking creation
✅ Lifecycle transitions: Booked → Taken → Completed
✅ Datetime usage in lifecycle (not just start_date/end_date)
✅ Odometer tracking (opening → closing)
✅ Invoice generation on return
✅ WhatsApp integration for invoice delivery
✅ No NOT NULL constraint violations on optional columns

### Troubleshooting
| Issue | Cause | Fix |
|-------|-------|-----|
| "Create Booking" fails | `start_datetime`/`end_datetime` not in payload | Check frontend code includes both in payload |
| "Mark Taken" fails | Missing `opening_odometer` | Ensure odometer input validated |
| Status doesn't update | Client state desync | Refresh page, check browser console for errors |
| Invoice not assigned | Return flow incomplete | Ensure all return steps completed |
| 403 Permission error | Auth context missing | Check Supabase session active |

### Expected Logs in Dev Console
```
✅ Booking created: BK0001
✅ start_datetime: 2025-12-30T10:00:00.000Z
✅ end_datetime: 2025-12-31T14:00:00.000Z
✅ Vehicle marked Taken at 2025-12-30T[NOW]
✅ Opening odometer: 12000 km
✅ Vehicle marked Returned at 2025-12-31T[NOW]
✅ Closing odometer: 12150 km
✅ Invoice INV/2025-001 assigned
```
