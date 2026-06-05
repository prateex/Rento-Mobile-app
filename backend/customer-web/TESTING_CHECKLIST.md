# TESTING CHECKLIST - Customer Website

Use this checklist to verify all functionality before deployment.

## 🏠 HOME PAGE

- [ ] Page loads without errors
- [ ] Hero section displays correctly
- [ ] Search bar appears
- [ ] City dropdown populates with cities
- [ ] Date pickers work (min date is today)
- [ ] Time pickers work
- [ ] Pickup date cannot be after dropoff date
- [ ] "Search Vehicles" button is clickable
- [ ] Features section displays
- [ ] "How It Works" section displays
- [ ] Stats section displays
- [ ] Footer appears with links
- [ ] Mobile responsive design works
- [ ] Clicking "Search Vehicles" redirects to `/search` with query params

## 🔍 SEARCH RESULTS PAGE

### Basic Display
- [ ] Search results page loads
- [ ] Vehicles display in grid layout
- [ ] Vehicle cards show image, name, price, location
- [ ] Results count displays correctly
- [ ] "No vehicles found" shows if empty

### Filters
- [ ] Filter panel appears on desktop
- [ ] Filter button appears on mobile
- [ ] Vehicle type checkboxes work
- [ ] Transmission radio buttons work
- [ ] Min price filter works
- [ ] Max price filter works
- [ ] Sort by price (ascending) works
- [ ] Sort by price (descending) works
- [ ] Sort by rating works
- [ ] "Clear All Filters" button works
- [ ] Active filter count badge appears
- [ ] Filters apply on change
- [ ] URL updates with filter params

### Vehicle Cards
- [ ] Clicking vehicle card navigates to details page
- [ ] Vehicle images load
- [ ] Location displays correctly
- [ ] Price displays in Indian Rupee format
- [ ] Rating displays with stars
- [ ] Total rides count displays
- [ ] Fuel type icon shows
- [ ] Transmission icon shows

### Responsive Design
- [ ] Grid adapts to screen size (1/2/3 columns)
- [ ] Mobile filter modal opens
- [ ] Mobile filter modal closes
- [ ] Touch interactions work

## 🚗 VEHICLE DETAILS PAGE

### Image Gallery
- [ ] Primary image displays
- [ ] Thumbnail grid appears (if multiple images)
- [ ] Left/right arrows work
- [ ] Image counter shows current/total
- [ ] Clicking image opens lightbox
- [ ] Lightbox arrows work
- [ ] Lightbox closes on X button
- [ ] Lightbox closes on backdrop click
- [ ] Gallery works on mobile (swipe)

### Vehicle Information
- [ ] Vehicle name displays
- [ ] Vehicle type badge shows
- [ ] Location displays with icon
- [ ] Rating displays with stars
- [ ] Total rides count displays
- [ ] Specs grid displays (fuel, transmission, seating, year)
- [ ] Description displays (if available)
- [ ] Features list displays (if available)
- [ ] Cancellation policy displays

### Availability & Booking
- [ ] If dates in URL, shows pickup/dropoff dates
- [ ] Availability check runs automatically
- [ ] "✓ Available" badge shows if available
- [ ] "✗ Not Available" badge shows if unavailable
- [ ] Price per day displays prominently
- [ ] "Book Now" button is clickable (if available)
- [ ] "Book Now" redirects to login if not authenticated
- [ ] "Book Now" redirects to checkout if authenticated
- [ ] "Sign In to Book" shows if not authenticated
- [ ] Button disables if not available

### Navigation
- [ ] "Back to Search" button works
- [ ] URL preserves search dates

## 🔐 LOGIN PAGE

### Email Login
- [ ] Email input field works
- [ ] "Send OTP" button is clickable
- [ ] Email validation works
- [ ] OTP sent success message appears
- [ ] OTP input field appears after sending
- [ ] OTP input accepts 6 digits
- [ ] "Verify & Sign In" button works
- [ ] "Resend OTP" button works
- [ ] Loading states display correctly

### Phone Login
- [ ] Phone input field works
- [ ] "Send OTP" button is clickable
- [ ] Phone validation works (format)
- [ ] OTP sent success message appears
- [ ] OTP verification works

### General
- [ ] "Back" button returns to method selection
- [ ] Error messages display for invalid OTP
- [ ] Successful login redirects to previous page
- [ ] Terms of Service link present
- [ ] Privacy Policy link present
- [ ] Mobile responsive design

## 💳 CHECKOUT PAGE

### Page Load
- [ ] Redirects to login if not authenticated
- [ ] Redirects to home if missing vehicle/dates
- [ ] Vehicle details display correctly
- [ ] Booking dates display correctly
- [ ] Pricing breakdown displays

### Location Selection
- [ ] Pickup location dropdown populates
- [ ] Dropoff location dropdown populates
- [ ] Locations filtered by vehicle's city
- [ ] Default location selected automatically
- [ ] Can select different locations

### Pricing Breakdown
- [ ] Base price calculates correctly (days × daily price)
- [ ] GST (18%) calculates correctly
- [ ] Total amount displays correctly
- [ ] Number of days displays
- [ ] Pickup/dropoff times display
- [ ] Pickup/dropoff locations display
- [ ] Cancellation policy displays

### Payment Flow
- [ ] "Proceed to Payment" button enabled when locations selected
- [ ] Payment modal opens
- [ ] Demo mode warning displays
- [ ] "Complete Payment" button works
- [ ] Processing state displays with spinner
- [ ] Success state displays with checkmark
- [ ] Failure state displays with error
- [ ] Cannot close modal during processing
- [ ] Success redirects to booking success page

### Error Handling
- [ ] Error if location not selected
- [ ] Error if booking creation fails
- [ ] Error if payment simulation fails
- [ ] Retry option available on failure

## ✅ BOOKING SUCCESS PAGE

### Display
- [ ] Page loads with booking ID
- [ ] Green checkmark displays
- [ ] "Booking Confirmed!" message shows
- [ ] Booking ID displays prominently
- [ ] Vehicle details display with image
- [ ] Pickup date/time/location display
- [ ] Dropoff date/time/location display
- [ ] Total amount paid displays
- [ ] Important notes section displays

### Actions
- [ ] "View My Bookings" button works
- [ ] "Book Another Vehicle" button works
- [ ] "Download Confirmation" button triggers print
- [ ] Print styling hides header/footer/buttons

### Error Handling
- [ ] Shows error if booking ID invalid
- [ ] "View My Bookings" button available on error

## 📋 MY BOOKINGS PAGE

### Display
- [ ] Page redirects to login if not authenticated
- [ ] Page title displays
- [ ] "Book New Vehicle" button appears
- [ ] Booking cards display in grid
- [ ] Empty state shows if no bookings
- [ ] Empty state has CTA to browse vehicles

### Booking Cards
- [ ] Booking ID displays
- [ ] Status badge displays with correct color
- [ ] Vehicle image displays
- [ ] Vehicle name displays
- [ ] Pickup date/time displays
- [ ] Dropoff date/time displays
- [ ] Location displays
- [ ] Total amount displays
- [ ] "View Details" button works
- [ ] "Cancel" button appears for confirmed/pending bookings
- [ ] "Cancel" button missing for cancelled/completed bookings

### Cancellation
- [ ] Cancel modal opens on "Cancel" click
- [ ] Warning message displays
- [ ] Refund policy reminder displays
- [ ] "Yes, Cancel Booking" button works
- [ ] "Keep Booking" button closes modal
- [ ] Loading state displays during cancellation
- [ ] Success updates booking list
- [ ] Status changes to "Cancelled"
- [ ] Cancel button disappears after cancellation
- [ ] Error message displays if cancellation fails

### Navigation
- [ ] Clicking "View Details" navigates to booking success page
- [ ] Clicking "Book New Vehicle" navigates to home

## 🎨 COMMON COMPONENTS

### Header
- [ ] Logo displays and links to home
- [ ] Navigation menu appears
- [ ] "My Bookings" link appears when authenticated
- [ ] User avatar/email displays when authenticated
- [ ] "Sign In" button appears when not authenticated
- [ ] "Sign Out" button works
- [ ] Sign out clears session
- [ ] Mobile menu works (if implemented)

### Footer
- [ ] Logo displays
- [ ] Quick links section appears
- [ ] Support links section appears
- [ ] Contact info displays
- [ ] Social media icons appear
- [ ] Copyright year displays
- [ ] All links are clickable

### Loading States
- [ ] Skeleton loaders display during initial load
- [ ] Spinner displays for inline loading
- [ ] Button loading states work (spinner + disabled)
- [ ] "Loading..." text appears where appropriate

### Error Messages
- [ ] Error messages display in red
- [ ] Warning messages display in yellow
- [ ] Info messages display in blue
- [ ] Retry buttons work (if provided)
- [ ] Error messages are user-friendly

### Modals
- [ ] Modal opens on trigger
- [ ] Modal closes on X button
- [ ] Modal closes on backdrop click (except during processing)
- [ ] Modal prevents background scroll
- [ ] Modal content is centered
- [ ] Modal is responsive

## 🔐 SECURITY TESTING

### Authentication
- [ ] Cannot access /checkout without login
- [ ] Cannot access /my-bookings without login
- [ ] Cannot access /booking-success without login
- [ ] Login redirects to previous page after success
- [ ] Session persists on page refresh
- [ ] Session clears on logout

### Authorization
- [ ] User can only see their own bookings
- [ ] User can only cancel their own bookings
- [ ] RLS policies prevent unauthorized data access
- [ ] No service role bypass in customer app

### Data Validation
- [ ] Cannot submit empty forms
- [ ] Cannot select past dates
- [ ] Cannot select dropoff before pickup
- [ ] Email format validated
- [ ] Phone format validated (if implemented)

## 📱 RESPONSIVE DESIGN

### Mobile (< 640px)
- [ ] All pages display correctly
- [ ] Touch targets are large enough (44px min)
- [ ] Images scale appropriately
- [ ] Text is readable (min 16px)
- [ ] Forms are usable
- [ ] Buttons span full width where appropriate
- [ ] Modals cover full screen
- [ ] Gallery swipe works

### Tablet (640px - 1024px)
- [ ] Grid layouts adapt (2 columns)
- [ ] Navigation adjusts
- [ ] Spacing is appropriate

### Desktop (> 1024px)
- [ ] Grid layouts use 3+ columns
- [ ] Sidebar filters display
- [ ] Max width constraints applied
- [ ] Hover states work

## ⚡ PERFORMANCE

### Load Times
- [ ] Initial page load < 3 seconds (good connection)
- [ ] Images lazy load
- [ ] Subsequent navigation is instant (client-side routing)
- [ ] No layout shift (CLS)

### Optimization
- [ ] No console errors
- [ ] No console warnings (except known dev mode warnings)
- [ ] No memory leaks on navigation
- [ ] Images compressed/optimized
- [ ] Build size reasonable (< 1MB gzipped)

## 🌐 BROWSER COMPATIBILITY

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## 🔄 DATA INTEGRITY

### Booking Creation
- [ ] Booking record created in database
- [ ] Platform payment record created
- [ ] Availability block created automatically
- [ ] All fields populated correctly
- [ ] Total amount matches calculation

### Booking Cancellation
- [ ] Booking status updated to 'Cancelled'
- [ ] Availability block removed automatically (trigger)
- [ ] Refund calculation correct (if applicable)
- [ ] Timestamps updated

### Platform User Creation
- [ ] Platform user auto-created on first login
- [ ] Email/phone saved correctly
- [ ] Role set to 'customer'
- [ ] is_active set to true

## 📊 EDGE CASES

### No Data Scenarios
- [ ] No vehicles available (empty state)
- [ ] No bookings (empty state)
- [ ] No locations in city (error message)
- [ ] No images for vehicle (placeholder)

### Error Scenarios
- [ ] Network error (retry option)
- [ ] Supabase error (user-friendly message)
- [ ] Invalid vehicle ID (error page)
- [ ] Invalid booking ID (error page)
- [ ] Payment failure (retry option)
- [ ] Booking creation failure (error message)

### Concurrent Booking Attempts
- [ ] Two users try to book same vehicle at same time
- [ ] Only one booking succeeds
- [ ] Second user sees "Not Available" message
- [ ] Database function prevents race condition

### Date/Time Edge Cases
- [ ] Midnight bookings work
- [ ] Same-day bookings work
- [ ] Multi-month bookings work
- [ ] Leap year dates work
- [ ] Daylight saving time changes (if applicable)

## ✅ PRE-DEPLOYMENT CHECKLIST

### Configuration
- [ ] `.env` file not committed to git
- [ ] `.gitignore` includes `.env`
- [ ] Environment variables set in hosting platform
- [ ] Supabase URL correct
- [ ] Supabase anon key correct (NOT service role key)

### Database
- [ ] Phase 1 migrations applied
- [ ] RLS policies active
- [ ] Database functions created
- [ ] Indexes created
- [ ] Triggers created

### Build
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No linting errors (if linter configured)
- [ ] Build size acceptable
- [ ] Source maps generated

### Testing
- [ ] All critical flows tested
- [ ] No console errors in production build
- [ ] Mobile tested on real device
- [ ] Different browsers tested
- [ ] All edge cases handled

### Documentation
- [ ] README.md up to date
- [ ] DEPLOYMENT_GUIDE.md complete
- [ ] Environment variables documented
- [ ] Known issues documented

---

## 📝 TESTING NOTES

**Tester Name:** _________________  
**Date:** _________________  
**Environment:** Development / Staging / Production  

**Issues Found:**
1. 
2. 
3. 

**Blockers:**
- 

**Ready for Deployment:** ☐ YES ☐ NO

---

**Use this checklist before each deployment to ensure quality! ✅**
