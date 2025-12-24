# Bike Rental Management App (MVP)

This is a high-fidelity **Web Mockup** of the Bike Rental Management Mobile App. 
It is built using **React + Vite + Tailwind CSS** to simulate the mobile experience directly in the browser.

## 📱 Project Overview
A complete management dashboard for Bike Rental Shop owners to manage:
- **Bikes**: Track availability, status, photos, opening KM, and damages.
- **Customers**: KYC verification and history.
- **Bookings**: Create and manage rentals with date/time, separate rent/deposit, and inline customer creation.
- **Payments**: Track revenue and payment status.
- **Settings**: Toggle dashboard revenue visibility.

## 🎨 Design System
- **Primary Color**: Yellow (`#FFD200`)
- **Background**: White (`#FFFFFF`)
- **Typography**: DM Sans (Headings) + Inter (Body)
- **Styling**: Tailwind CSS with custom Mobile-First layout.

## 🚀 How to Run
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Development Server**:
   ```bash
   npm run dev
   ```
3. **Open in Browser**:
   The app runs on port 5000. Open the webview to see the mobile simulation.

## 🔒 Security & Dependency Management

### npm Audit Status
- ✅ **Fixed**: `express-session` vulnerability (removed - not used with Supabase JWT auth)
- ✅ **Fixed**: `on-headers` vulnerability (auto-fixed by npm audit)
- ⚠️ **Development-Only**: `esbuild` vulnerability is in dev dependencies only
  - Used by `drizzle-kit` (CLI tool) and build process
  - **NOT exploitable in production** - esbuild runs only on dev machine
  - Production server does NOT use esbuild at runtime
  - Upgrading would require breaking changes to drizzle-kit

**Summary**: Backend is production-safe. The remaining esbuild warning is development-only.

## 📱 Mobile Simulation
This project uses a `MobileLayout` component to restrict the view to a mobile viewport (`max-w-md`) on desktop screens, providing a realistic app-like experience.

## 🛠 Tech Stack
- **Frontend**: React, Wouter (Routing), Zustand (State Management)
- **UI Library**: Radix UI + Tailwind CSS (Shadcn-like components)
- **Icons**: Lucide React
- **Forms**: React Hook Form
- **Date Handling**: date-fns

## 📂 Folder Structure
```
client/
├── src/
│   ├── components/
│   │   ├── layout/       # MobileLayout, BottomNav
│   │   ├── ui/           # Reusable UI components (Button, Card, Input)
│   ├── pages/            # App Screens (Dashboard, Bikes, Bookings)
│   ├── lib/
│   │   ├── store.ts      # Global State (Zustand) & Mock Data
│   │   ├── utils.ts      # Helper functions
│   ├── App.tsx           # Main Routing
```

## 🔄 Porting to Expo (React Native)
To convert this web mockup to a real Native App:
1. Initialize a new Expo project: `npx create-expo-app bike-rental`
2. Copy the state logic from `store.ts`.
3. Replace HTML tags (`div`, `span`) with React Native components (`View`, `Text`).
4. Replace `lucide-react` with `@expo/vector-icons`.
5. Use `NativeWind` for Tailwind styling in React Native.

## 🔐 Demo Credentials
- **Admin Phone**: `9999999999` (OTP: `1234`) - Full access (Delete bookings, etc.)
- **Staff Phone**: `8888888888` (OTP: `1234`) - Limited access

## ✨ New Features (v2)
- **Edit Bookings**: Change dates, bike, rent/deposit with overlap protection.
- **Detailed Bike Management**: Multiple photos, opening KM, KM driven, damage reporting.
- **Enhanced Bookings**: Date & Time picker, Rent vs Deposit split, Add Customer inline.
- **Admin Controls**: Delete bookings (Admin only), Hide Dashboard Revenue (Settings).

## 🚀 Feature Requests (v3 - Latest)
- **Inventory Calendar**: Dashboard calendar view showing availability heat map.
- **Revenue Reports**: Interactive revenue card with details and CSV export mock.
- **Staff Management**: Add Staff modal with invite flow.
- **Communication**: Call and WhatsApp buttons for customers.
- **Invoice**: Generate and download PDF invoices for bookings.
- **Multi-Bike Booking**: Select multiple bikes for a single booking.
- **Return Bike Flow**: Action to mark bike as returned and complete booking.
- **Filters**: Advanced filtering on Bookings tab.
- **Enhanced Customer Profile**: View/Edit customer details with ID photos.
