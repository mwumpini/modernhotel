# Testing the Consolidated Check-ins & In-House Management

## Test Plan

### 1. Access the Application
- Open browser to: http://localhost:3001
- Navigate to the main dashboard

### 2. Test Navigation Redirects
- **Test 1**: Click on "Check-ins" in navigation
  - Expected: Redirects to `/guest-services/check-ins`
  - Should show the consolidated page with 3 tabs

- **Test 2**: Click on "In-House" in navigation (if still visible)
  - Expected: Redirects to `/guest-services/check-ins?tab=inhouse`
  - Should open the In-House Management tab directly

### 3. Test Check-ins Page Functionality

#### Tab 1: Check-In Reservations
- **Test 3**: View pending check-ins
  - Expected: Should show John Mensah (confirmed, today's arrival)
  - Should show Kwame Asante (confirmed, tomorrow's arrival)

- **Test 4**: Process a check-in
  - Click "Process" on John Mensah's reservation
  - Complete the check-in process
  - Expected: Status should change to "checked-in"

#### Tab 2: Walk-In Check-In
- **Test 5**: Create a walk-in reservation
  - Fill out the walk-in form
  - Complete the check-in
  - Expected: New reservation should be created and checked in

#### Tab 3: In-House Management
- **Test 6**: View in-house guests
  - Expected: Should show Ama Osei (already checked-in)
  - Should show John Mensah (after processing check-in)

- **Test 7**: Manage in-house guest
  - Click "Manage" on a guest
  - Test "Extend 1 Night" functionality
  - Test "Early Checkout" functionality

### 4. Test URL Parameters
- **Test 8**: Direct tab navigation
  - Navigate to: `/guest-services/check-ins?tab=inhouse`
  - Expected: Should open directly to In-House Management tab

### 5. Test Complete Workflow
- **Test 9**: End-to-end workflow
  1. Create a reservation (or use existing)
  2. Check in the guest
  3. Manage the guest in In-House tab
  4. Process checkout

## Sample Data Available

### Reservations:
1. **John Mensah** - Confirmed, arriving today, Standard room
2. **Ama Osei** - Already checked-in, Deluxe room
3. **Kwame Asante** - Confirmed, arriving tomorrow, Suite

### Room Types:
- Standard (₵600)
- Deluxe (₵800) 
- Suite (₵1200)
- Presidential Suite (₵2500)

## Expected Results

✅ **Navigation**: All redirects work correctly
✅ **Tabs**: All three tabs function properly
✅ **Check-ins**: Can process reservations and walk-ins
✅ **In-House**: Can manage checked-in guests
✅ **URL Parameters**: Direct tab navigation works
✅ **Workflow**: Complete guest journey functions end-to-end

## Issues to Watch For

- Tab switching not working
- Modal not opening/closing properly
- Guest status not updating correctly
- Navigation redirects not working
- URL parameters not being read
- Sample data not loading
