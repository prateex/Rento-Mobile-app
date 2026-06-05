# Evidence Collection: 6 UI/UX Runtime Issues
**Status:** EVIDENCE ONLY - NO FIXES APPLIED  
**Collected:** Current Session  
**Purpose:** Root cause diagnosis for ChatGPT analysis

---

## ISSUE 1: Brand/Model Selection Dropdown Not Closing

### 1.1 Code Evidence: Brand Selection Popover

**File:** [backend/client/src/pages/Bikes.tsx](backend/client/src/pages/Bikes.tsx#L500-L548)  
**Lines:** 500-548

```tsx
{/* 2. Brand */}
<div className="space-y-2">
  <label className="text-sm font-medium">Brand</label>
  <Popover open={brandIsOther ? true : undefined}>
    <PopoverTrigger asChild>
      <Button variant="outline" role="combobox" className="w-full justify-between">
        {brandSelection || 'Select brand'}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[320px] p-0">
      <Command>
        <CommandInput placeholder="Search brand..." />
        <CommandList>
          <CommandEmpty>No brand found.</CommandEmpty>
          <CommandGroup>
            {brandsForType.map((brand) => (
              <CommandItem
                key={brand}
                value={brand}
                onSelect={(val) => {
                  setBrandSelection(val);
                  setBrandIsOther(false);
                  setModelSelection('');
                  setValue('brand', val);
                }}
              >
                {brand}
              </CommandItem>
            ))}
            <CommandItem
              value="Other"
              onSelect={() => {
                setBrandIsOther(true);
                setBrandSelection('');
                setModelSelection('');
                setValue('brand', '');
              }}
            >
              Other
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
  {brandIsOther && (
    <Input
      className="mt-2"
      placeholder="Enter brand"
      value={brandSelection}
      onChange={(e) => {
        setBrandSelection(e.target.value);
        setValue('brand', e.target.value);
      }}
    />
  )}
</div>
```

### 1.2 Code Evidence: Model Selection Popover

**File:** [backend/client/src/pages/Bikes.tsx](backend/client/src/pages/Bikes.tsx#L549-L600)  
**Lines:** 549-600

```tsx
{/* 3. Model */}
<div className="space-y-2">
  <label className="text-sm font-medium">Model</label>
  <Popover open={modelIsOther ? true : undefined}>
    <PopoverTrigger asChild>
      <Button variant="outline" role="combobox" className="w-full justify-between">
        {modelSelection || 'Select model'}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-[320px] p-0">
      <Command>
        <CommandInput placeholder="Search model..." />
        <CommandList>
          <CommandEmpty>No model found.</CommandEmpty>
          <CommandGroup>
            {modelsForBrand.map((model) => (
              <CommandItem
                key={model}
                value={model}
                onSelect={(val) => {
                  setModelSelection(val);
                  setModelIsOther(false);
                  setValue('model', val);
                }}
              >
                {model}
              </CommandItem>
            ))}
            <CommandItem
              value="Other"
              onSelect={() => {
                setModelIsOther(true);
                setModelSelection('');
                setValue('model', '');
              }}
            >
              Other
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
  {modelIsOther && (
    <Input
```

### 1.3 Root Cause Analysis

**Problem:** Both Brand and Model Popovers lack `onOpenChange` handler on the `<Popover>` component.

**Evidence:**
- Brand Popover: Line 501 shows `<Popover open={brandIsOther ? true : undefined}>` with NO `onOpenChange` property
- Model Popover: Line 550 shows `<Popover open={modelIsOther ? true : undefined}>` with NO `onOpenChange` property
- When `CommandItem.onSelect()` fires, state updates but popover stays open because no close signal is sent
- Popover only closes manually by clicking outside or when `open` prop changes to `false`, but there's no logic to set `open={false}` after selection

**Expected Fix Pattern:**
```tsx
<Popover open={isOpen} onOpenChange={setIsOpen}>
  {/* ... inside CommandItem.onSelect: */}
  setIsOpen(false);  // Close after selection
</Popover>
```

---

## ISSUE 2: Edit Changes Not Persisting After Page Refresh

### 2.1 Code Evidence: Vehicle Edit Form Submit (No Post-Edit Refresh)

**File:** [backend/client/src/pages/Bikes.tsx](backend/client/src/pages/Bikes.tsx#L323-L360)  
**Lines:** 323-360

```tsx
const onSubmit = async (data: any) => {
  const bikeData = {
    ...data,
    photos: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800'],
    image: photos.length > 0 ? photos[0] : 'https://images.unsplash.com/photo-1558981806-ec527fa84c3d?auto=format&fit=crop&q=80&w=800',
    openingKm: Number(data.openingKm),
    kmDriven: Number(data.kmDriven || data.openingKm),
    pricePerDay: Number(data.pricePerDay),
    damages: previousDamages
  };

  // Auto-generate display name if empty
  if (!bikeData.name || bikeData.name.trim().length === 0) {
    const vehicleLabel = (() => {
      const t = (vehicleTypeSelection || 'bike').toLowerCase();
      if (t === 'ev') return 'EV';
      if (t === 'scooter') return 'Scooter';
      if (t === 'car') return 'Car';
      return 'Bike';
    })();
    bikeData.name = `${vehicleLabel} - ${bikeData.brand || ''} ${bikeData.model || ''} ${bikeData.cc || ''}`.trim();
  }

  if (initialData) {
    try {
      await updateBike(initialData.id, bikeData);
      toast({ title: "Vehicle Updated", description: "Changes saved successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update vehicle" });
    }
  }
```

**Key Finding:** After `await updateBike()` on line 356:
- ✅ Toast message shown
- ❌ **NO `refreshAllData()` or `refreshBikes()` call**
- ❌ **NO subsequent reload of vehicle list from DB**

### 2.2 Code Evidence: updateBike Store Function

**File:** [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts#L551-L605)  
**Lines:** 551-605

```typescript
updateBike: async (id, data) => {
  try {
    if (warnSupabaseDisabled('updateBike')) {
      const normalized = sanitizeVehiclePayload(data);
      set((state) => ({
        bikes: state.bikes.map((b) => (b.id === id ? { ...b, ...normalized } : b))
      }));
      return;
    }

    // ... sanitization and Supabase update ...
    const { error } = await supabase
      .from('vehicles')
      .update(updatePayload)
      .eq('id', id)
      .eq('shop_id', shopId);

    if (error) throw error;

    // Update local state
    set((state) => ({
      bikes: state.bikes.map((b) => (b.id === id ? { ...b, ...normalized } : b))
    }));
  } catch (error) {
    console.error('Error updating bike:', error);
    throw error;
  }
},
```

**Key Finding:** `updateBike()` function:
- ✅ Updates Supabase DB
- ✅ Updates local Zustand state
- ❌ **Does NOT call `refreshBikes()` or `refreshAllData()`**
- ❌ **State update uses locally normalized data, not DB response**

### 2.3 Code Evidence: Customer Edit Form Submit (No Post-Edit Refresh)

**File:** [backend/client/src/pages/Customers.tsx](backend/client/src/pages/Customers.tsx#L390-L410)  
**Lines:** 390-410

```tsx
const onSubmit = async (formData: any) => {
  console.log('[onSubmit] START - initialData:', !!initialData, 'formData:', formData);
  console.log('[onSubmit] pendingIdPhotos at submit:', pendingIdPhotos);
  if (initialData) {
    try {
      // Edit mode: Update metadata only (photos handled separately)
      await updateCustomer(initialData.id, { ...formData, documents });
      toast({ title: "Updated", description: "Customer details updated." });
      onClose();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update customer" });
    }
    return;
  }
  // ... new customer flow ...
}
```

**Key Finding:** Customer edit on line 397:
- ✅ Calls `updateCustomer()`
- ✅ Shows toast
- ❌ **NO `refreshAllData()` or `refreshCustomers()` call**
- ❌ **Caller's state never re-synced with DB**

### 2.4 Code Evidence: Booking Edit Form Submit (No Post-Edit Refresh)

**File:** [backend/client/src/pages/Bookings.tsx](backend/client/src/pages/Bookings.tsx#L1143-L1160)  
**Lines:** 1143-1160

```tsx
if (initialData) {
  try {
    await updateBooking(initialData.id, {
      ...data,
      startDate: startDateISO,
      endDate: endDateISO,
      rent: Number(data.rent),
      deposit: Number(data.deposit),
      totalAmount: total,
      history: [...(initialData.history || []), { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: 'Edited details' }]
    });
    toast({ title: "Booking Updated", description: "Changes saved." });
    onClose();
  } catch (error) {
    toast({ title: "Error", description: "Failed to update booking" });
  }
  return;
}
```

**Key Finding:** Booking edit on line 1143:
- ✅ Calls `updateBooking()`
- ✅ Shows toast
- ❌ **NO `refreshAllData()` or `refreshBookings()` call**

### 2.5 Code Evidence: Booking Advance Payment Submit (No Post-Update Refresh)

**File:** [backend/client/src/pages/Bookings.tsx](backend/client/src/pages/Bookings.tsx#L487-L560)  
**Lines:** 487-560

```tsx
const handleSaveAdvance = async () => {
  if (!amount || amount <= 0) {
    toast({ title: "Advance Required", description: "Enter a valid advance amount.", variant: "destructive" });
    return;
  }
  if (amount >= total) {
    toast({ title: "Advance Too High", description: "Advance must be less than total amount.", variant: "destructive" });
    return;
  }

  try {
    // ... payment insert ...
    const { data: updated, error: updErr } = await supabase
      .from('bookings')
      .update({
        payment_status: 'Partial',
        status: 'Confirmed',
        advance_amount: amount,
        balance_amount: balancePreview,
        payment_date: paymentDate ? paymentDate.toISOString() : null,
        utr_number: method === 'UPI' && utrNumber ? utrNumber : null,
      })
      .eq('id', booking.id)
      .select('id')
      .single();
    
    // ... error handling ...
    
    const history = Array.isArray(booking.history) ? booking.history : [];
    updateBooking(booking.id, {
      paymentStatus: 'Partial',
      status: 'Confirmed',
      advanceAmount: amount,
      remainingAmount: balancePreview,
      paymentMode: method,
      paymentType: method,
      history: [...history, { byUserId: user?.id || 'unknown', timestamp: new Date().toISOString(), changes: `Advance ₹${amount} via ${method}` }]
    }).catch((error) => console.error('Error updating booking:', error));
    
    setPaymentFlow(null);
    toast({ title: "Advance Saved", description: "Booking confirmed with advance payment." });
  } catch (e: any) {
    toast({ title: "Unexpected Error", description: e?.message || String(e), variant: "destructive" });
  }
};
```

**Key Finding:** Advance payment handler on line 487:
- ✅ Inserts payment to DB
- ✅ Updates booking in DB
- ✅ Calls `updateBooking()` on line 552
- ❌ **NO `refreshAllData()` or `refreshBookings()` call**
- ❌ **State only updated with local data, not DB response**

### 2.6 Root Cause Analysis

**Pattern:** All edit/update operations across 3 pages (Bikes, Customers, Bookings) follow this flow:

```
1. Form submit → updateBike/updateCustomer/updateBooking()
2. ✅ DB updated via Supabase
3. ✅ Local Zustand state updated  
4. ✅ Toast shown
5. ❌ NO refresh of data from DB
6. ❌ If page is refreshed, stale local state remains
```

**Why It Fails:**
- Zustand state is updated with locally-transformed data, not DB response
- No call to `refreshAllData()` or specific `refreshBikes()/refreshCustomers()/refreshBookings()`
- When user manually refreshes page or app reloads, Zustand state is reset to last DB fetch
- If DB had computed/generated fields or server-side transformations, local state diverges

**Example Sequence:**
1. Edit vehicle name: "Bike1" → "Bike2"
2. `updateBike()` writes to DB ✅
3. Local Zustand state shows "Bike2" ✅
4. User presses F5 (page refresh)
5. `refreshBikes()` called on page load, fetches from DB
6. If DB write failed silently or used different field mapping, page shows old value

---

## ISSUE 3: Home Refresh Button Appears Non-Functional

### 3.1 Code Evidence: Dashboard Refresh Button

**File:** [backend/client/src/pages/Dashboard.tsx](backend/client/src/pages/Dashboard.tsx#L31-L33)

```tsx
const handleRefresh = async () => {
  await refreshAllData();
};
```

**File:** [backend/client/src/pages/Dashboard.tsx](backend/client/src/pages/Dashboard.tsx#L68-L78)

```tsx
<Button 
  onClick={handleRefresh} 
  disabled={isRefreshing}
  className="rounded-full h-9 w-9 p-0"
>
  <RotateCw size={16} />
</Button>
```

### 3.2 Code Evidence: refreshAllData Implementation

**File:** [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts#L1125-L1160)  
**Lines:** 1125-1160

```typescript
refreshAllData: async () => {
  console.log('[refreshAllData] Start at', new Date().toISOString());
  set({ isRefreshing: true });

  try {
    const results = await Promise.all([
      get().refreshBikes().catch(e => {
        console.error('[refreshAllData] refreshBikes error:', e);
        return e;
      }),
      get().refreshCustomers().catch(e => {
        console.error('[refreshAllData] refreshCustomers error:', e);
        return e;
      }),
      get().refreshBookings().catch(e => {
        console.error('[refreshAllData] refreshBookings error:', e);
        return e;
      }),
      get().refreshUsers().catch(e => {
        console.error('[refreshAllData] refreshUsers error:', e);
        return e;
      }),
      get().refreshShopDetails().catch(e => {
        console.error('[refreshAllData] refreshShopDetails error:', e);
        return e;
      })
    ]);

    console.log('[refreshAllData] All promises resolved at', new Date().toISOString());
  } catch (e) {
    console.error('[refreshAllData] Unexpected error:', e);
  } finally {
    set({ isRefreshing: false });
    console.log('[refreshAllData] End at', new Date().toISOString());
  }
}
```

### 3.3 Root Cause Analysis

**Observable Behavior:**
- Button renders and is clickable
- `handleRefresh()` executes on click
- Button shows loading state (`disabled={isRefreshing}`)

**Potential Issues (No Runtime Evidence Yet):**

1. **Silent Errors in Promise.all():**
   - Each refresh function wrapped in `.catch()` to preserve state on error
   - Errors logged to console but no UI feedback
   - User may not know if refresh succeeded or failed

2. **Supabase Connection Issues:**
   - If `isSupabaseEnabledNow()` returns false, refreshBikes/refreshCustomers/etc return early with no state update
   - No console log indicating disabled state
   - Button disabled state clears, appears functional, but data unchanged

3. **Missing Async/Await:**
   - `usePullToRefresh` hook passes `onRefresh: handleRefresh` but may not await promise completion
   - Refresh indicator closes before data actually loads

4. **Auth Session Expired:**
   - `refreshBikes()` calls `supabase.auth.getSession()` on line 1174
   - If session expired, UID will be null
   - Function returns early without updating state (line 1183)
   - Console logs "No UID - returning" but user sees nothing

**Evidence Needed:**
- Browser DevTools console logs when refresh button clicked
- Network tab showing Supabase queries executing or failing
- isRefreshing state transitions
- Auth session validity check

---

## ISSUE 4: Pull-to-Refresh Not Working

### 4.1 Code Evidence: usePullToRefresh Hook

**File:** [backend/client/src/hooks/usePullToRefresh.tsx](backend/client/src/hooks/usePullToRefresh.tsx#L1-L150)  
**Lines:** 1-150

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

export const usePullToRefresh = ({ 
  onRefresh, 
  threshold = 80,
  resistance = 2.5,
  maxPullDistance = 150
}: {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
  maxPullDistance?: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  let isPulling = false;
  let startY = 0;

  const handleTouchStart = (e: TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    if (container.scrollTop === 0) {
      isPulling = true;
      startY = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    if (diff > 10) {
      e.preventDefault();
    }
    
    if (diff > 0) {
      const distance = Math.min(diff / resistance, maxPullDistance);
      setPullDistance(distance);
      setPullProgress(Math.min((distance / threshold) * 100, 100));
    }
  };

  const handleTouchEnd = async (e: TouchEvent) => {
    isPulling = false;
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);
      setPullProgress(0);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      // Reset animation
      setPullDistance(0);
      setPullProgress(0);
    }
  };

  // Mouse event fallback for desktop testing
  const handleMouseDown = (e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    if (container.scrollTop === 0 && e.button === 0) {
      isPulling = true;
      startY = e.clientY;
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPulling) return;
    
    const currentY = e.clientY;
    const diff = currentY - startY;
    
    if (diff > 0) {
      const distance = Math.min(diff / resistance, maxPullDistance);
      setPullDistance(distance);
      setPullProgress(Math.min((distance / threshold) * 100, 100));
    }
  };

  const handleMouseUp = async (e: MouseEvent) => {
    isPulling = false;
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);
      setPullProgress(0);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
      setPullProgress(0);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('touchstart', handleTouchStart as any);
    container.addEventListener('touchmove', handleTouchMove as any, { passive: false });
    container.addEventListener('touchend', handleTouchEnd as any);
    container.addEventListener('mousedown', handleMouseDown as any);
    container.addEventListener('mousemove', handleMouseMove as any);
    container.addEventListener('mouseup', handleMouseUp as any);
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart as any);
      container.removeEventListener('touchmove', handleTouchMove as any);
      container.removeEventListener('touchend', handleTouchEnd as any);
      container.removeEventListener('mousedown', handleMouseDown as any);
      container.removeEventListener('mousemove', handleMouseMove as any);
      container.removeEventListener('mouseup', handleMouseUp as any);
    };
  }, [pullDistance, isRefreshing]);

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    pullProgress,
  };
};
```

### 4.2 Code Evidence: Dashboard Container Using usePullToRefresh

**File:** [backend/client/src/pages/Dashboard.tsx](backend/client/src/pages/Dashboard.tsx#L1-L100)

```tsx
const { containerRef, pullDistance, isRefreshing, pullProgress } = usePullToRefresh({ 
  onRefresh: handleRefresh 
});

return (
  <MobileLayout>
    <div ref={containerRef} className="p-4 space-y-4 min-h-screen pb-24 relative">
      <PullToRefreshIndicator 
        pullDistance={pullDistance} 
        isRefreshing={isRefreshing} 
        pullProgress={pullProgress} 
      />
      {/* ... rest of page ... */}
    </div>
  </MobileLayout>
);
```

### 4.3 Root Cause Analysis

**Hook Logic:**
- Line 27: `if (container.scrollTop === 0)` - Detects if user is at top of scroll
- Line 42: Same check in touchmove handler
- Line 88-94: Mouse event fallback for desktop testing

**Potential Issues:**

1. **CSS Prevents Scrolling:**
   - Container `div` has `className="p-4 space-y-4 min-h-screen pb-24 relative"`
   - If `overflow` CSS property is not set or set to `hidden`, `scrollTop` will always be 0
   - Hook will think user is "at top" even when content is above viewport
   - Pull gesture will trigger immediately on any downward drag

2. **scrollTop Never Updates:**
   - If parent container has `overflow: auto` but child has `overflow: hidden`, scroll won't register
   - `container.scrollTop === 0` check may always be false if scrollbar doesn't exist

3. **Event Listener Cleanup Issues:**
   - Line 121: `useEffect` dependency array only includes `[pullDistance, isRefreshing]`
   - Missing `containerRef` in dependency array
   - Event listeners may reference stale closures of `isPulling` and `startY` variables
   - `isPulling` and `startY` are component-level variables, not state, so don't persist across renders

4. **Container Not Scrollable:**
   - `min-h-screen` ensures container is at least viewport height
   - If content fits within viewport, `scrollHeight <= clientHeight`, so scrolling isn't possible
   - `container.scrollTop === 0` check is meaningless if scroll can't happen

**Evidence Needed:**
- Screenshot of container CSS showing overflow property
- Browser DevTools inspection of container scroll height vs client height
- Testing on mobile device vs desktop (mouse event fallback behavior)
- Console logs showing handleTouchStart/handleMouseDown being triggered

---

## ISSUE 5: Damage Image Preview Not Interactive

### 5.1 Code Evidence: Damage Image Rendering

**File:** [backend/client/src/pages/Bikes.tsx](backend/client/src/pages/Bikes.tsx#L1100-L1130)  
**Lines:** 1100-1130

```tsx
{/* Damages */}
<div className="space-y-2">
  <div className="flex justify-between items-center">
    <h3 className="font-semibold text-sm">Reported Damages</h3>
    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsDamageModalOpen(true)}>
      <AlertTriangle size={12} className="mr-1" /> Report
    </Button>
  </div>
  {viewingBike.damages && viewingBike.damages.length > 0 ? (
     <div className="space-y-2">
       {viewingBike.damages.map((damage) => (
         <div key={damage.id} className="flex gap-3 bg-red-50 p-2 rounded-lg border border-red-100">
            {damage.photoUrls && damage.photoUrls.length > 0 && (
              <img src={damage.photoUrls[0]} className="h-12 w-12 rounded-md object-cover bg-white" />
            )}
            <div>
              <div className="flex items-center gap-2">
                 <Badge variant="destructive" className="text-[10px] h-5 px-1">{damage.severity}</Badge>
                 <span className="text-xs text-muted-foreground">{new Date(damage.date).toLocaleDateString()}</span>
              </div>
              <p className="text-xs mt-1 text-zinc-800">{damage.notes}</p>
            </div>
         </div>
       ))}
     </div>
  ) : (
    <div className="text-center py-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
      <p className="text-xs text-muted-foreground">No damages reported</p>
    </div>
  )}
</div>
```

### 5.2 Root Cause Analysis

**Evidence:**
- Line 1113: `<img src={damage.photoUrls[0]}...` renders damage photo
- ❌ **NO `onClick` handler on the image element**
- ❌ **NO modal component to expand/preview damage**
- ❌ **NO lightbox or image gallery component**

**Current State:**
- Damage image displays as 12x12px thumbnail
- Image is static (read-only display)
- No user interaction possible
- No way to view full-size damage photo

**Expected Enhancement:**
- Click image to open modal/lightbox
- Display full photo details, date, severity, notes
- Maybe carousel to view all damage photos

---

## ISSUE 6: No Edit/Delete Functionality for Damages

### 6.1 Code Evidence: Damage Report Form

**File:** [backend/client/src/pages/Bikes.tsx](backend/client/src/pages/Bikes.tsx#L900-L1010)  
**Lines:** 900-1010

```tsx
const DamageReportForm = ({ bikeId, onClose }: { bikeId: string; onClose: () => void }) => {
  const { register, handleSubmit, reset } = useForm();
  const [damageDate, setDamageDate] = useState<Date>(new Date());
  const [isDatePickerOpenDamage, setIsDatePickerOpenDamage] = useState(false);
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);

  const handleAddDamagePhoto = async () => {
    // Photo upload logic
  };

  const handleRemoveDamagePhoto = (i: number) => {
    setDamagePhotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const onSubmit = async (data: any) => {
    // Submit new damage report
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Form fields for NEW damage reports only */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Date of Damage</label>
        <Popover open={isDatePickerOpenDamage} onOpenChange={setIsDatePickerOpenDamage}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal h-10"
            >
              <CalendarDays size={14} className="mr-2" />
              {format(damageDate, 'PPP')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={damageDate}
              onSelect={(date) => {
                if (date) setDamageDate(date);
                setIsDatePickerOpenDamage(false);
              }}
              disabled={{ after: new Date() }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Photos (Max 4)</label>
        <div className="flex gap-2 flex-wrap">
          {damagePhotos.map((url, i) => (
            <div key={i} className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden group">
              <img src={url} className="h-full w-full object-cover" />
              <button 
                type="button" 
                onClick={() => handleRemoveDamagePhoto(i)} 
                className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {damagePhotos.length < 4 && (
            <div 
              onClick={handleAddDamagePhoto} 
              className="h-16 w-16 flex-shrink-0 border border-dashed border-zinc-300 rounded-md flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:bg-zinc-50"
            >
              <UploadCloud size={16} className="text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">Add</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <Textarea 
          {...register("notes")} 
          placeholder="Describe the damage location and details..." 
          className="min-h-[80px]"
        />
      </div>
      
      <Button type="submit" variant="destructive" className="w-full h-12 mt-4">
        <AlertTriangle size={16} className="mr-2" /> Report Damage
      </Button>
    </form>
  );
};
```

### 6.2 Damage Viewing in Vehicle Detail View

**File:** [backend/client/src/pages/Bikes.tsx](backend/client/src/pages/Bikes.tsx#L1100-L1140)  
**Lines:** 1100-1140

```tsx
{/* Damages */}
<div className="space-y-2">
  <div className="flex justify-between items-center">
    <h3 className="font-semibold text-sm">Reported Damages</h3>
    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setIsDamageModalOpen(true)}>
      <AlertTriangle size={12} className="mr-1" /> Report
    </Button>
  </div>
  {viewingBike.damages && viewingBike.damages.length > 0 ? (
     <div className="space-y-2">
       {viewingBike.damages.map((damage) => (
         <div key={damage.id} className="flex gap-3 bg-red-50 p-2 rounded-lg border border-red-100">
            {damage.photoUrls && damage.photoUrls.length > 0 && (
              <img src={damage.photoUrls[0]} className="h-12 w-12 rounded-md object-cover bg-white" />
            )}
            <div>
              <div className="flex items-center gap-2">
                 <Badge variant="destructive" className="text-[10px] h-5 px-1">{damage.severity}</Badge>
                 <span className="text-xs text-muted-foreground">{new Date(damage.date).toLocaleDateString()}</span>
              </div>
              <p className="text-xs mt-1 text-zinc-800">{damage.notes}</p>
            </div>
         </div>
       ))}
     </div>
  ) : (
    <div className="text-center py-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
      <p className="text-xs text-muted-foreground">No damages reported</p>
    </div>
  )}
</div>
```

### 6.3 Root Cause Analysis

**Evidence:**
- DamageReportForm (Lines 900-1010): **ONLY supports CREATE (new damage reports)**
  - No `initialData` parameter to support edit mode
  - No `onSubmit` logic for UPDATE
  - Form fields only for data collection, not editing

- Damage Display (Lines 1100-1140): **READ-ONLY display**
  - ❌ **NO Edit button on each damage item**
  - ❌ **NO Delete button on each damage item**
  - ❌ **NO action menu (kebab/three-dots)**
  - Only shows Report button to create NEW damage

**Current User Flow:**
1. Open vehicle detail
2. View reported damages (read-only)
3. Can only add NEW damage via "Report" button
4. Cannot modify or remove existing damages

**Expected Enhancement:**
- Edit button on each damage to open form with pre-filled data
- Delete button to remove damage
- Ability to update date, photos, notes, severity

---

## Summary of Evidence

| Issue | Root Cause | Evidence Location | Severity |
|-------|-----------|------------------|----------|
| **Dropdown Not Closing** | Missing `onOpenChange` handler on Popover | Bikes.tsx L500, L550 | High |
| **Edit Not Persisting** | No `refreshAllData()` after update | Bikes.tsx L356, Customers.tsx L397, Bookings.tsx L1143 | Critical |
| **Refresh Button** | Silent errors, potential auth/connection issues | Dashboard.tsx L31-33, store.ts L1125-1160 | High |
| **Pull-to-Refresh** | CSS scroll behavior unclear, event listener issues | usePullToRefresh.tsx L27, L42, L121 | Medium |
| **Damage Preview** | No onClick handler, no modal/lightbox | Bikes.tsx L1113 | Medium |
| **Damage Edit/Delete** | No edit form support, no delete buttons | Bikes.tsx L900-1140 | High |

---

## Additional Testing Required (Step 7)

To complete root cause diagnosis, the following runtime evidence is needed:

### Browser Console Logs
- Refresh button click → console output showing refreshAllData flow
- Edit form submit → logs showing updateBike/updateCustomer/updateBooking execution
- Pull-to-refresh gesture → logs showing handleTouchStart/handleMouseDown triggering

### Network Requests (DevTools Network Tab)
- Supabase query requests and responses for edit operations
- Response status codes and error messages
- Time taken for each query

### CSS Inspection
- Container element scroll properties (overflow, overflow-y)
- Pull-to-refresh indicator element z-index and positioning
- Popover component positioning and z-index

---

**Note:** This document contains EVIDENCE ONLY. NO FIXES have been applied to the codebase.
