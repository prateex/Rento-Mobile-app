# Bike Rental Management App

## Overview

This is a comprehensive bike rental management system built as a web application simulating a mobile experience. The application enables bike rental shop owners to manage their entire operation including bike inventory, customer KYC verification, booking management, revenue reporting, and staff administration.

**Core Purpose**: Enable bike rental shop owners and staff to efficiently manage their rental operations with features for bike tracking, customer verification, booking workflows, revenue analytics, and inventory calendar visualization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18+ with TypeScript as the primary UI framework
- Vite as the build tool and development server (port 5000)
- Wouter for client-side routing (lightweight React Router alternative)
- Mobile-first responsive design constrained to max-width of 448px (`max-w-md`) to simulate mobile viewport

**State Management**
- Zustand with persistence middleware for global application state
- Local state stored in browser (persisted across sessions via localStorage)
- Stores manage: user authentication, bikes inventory, customers, bookings, settings, and staff members
- No external state synchronization in current implementation (fully client-side)
- Problem: Client-side only state means data is not shared across devices or persisted server-side
- Solution: Chosen for rapid MVP prototyping; can be migrated to server-backed state later
- Alternative considered: React Query with REST API (more complex setup for MVP)

**UI Component System**
- Radix UI primitives for accessible, unstyled components (dialogs, dropdowns, etc.)
- Tailwind CSS v4 for styling with custom design tokens
- Shadcn-like component architecture with modular, reusable UI elements
- Custom theme: Yellow (#FFD200) primary, White background, Black text
- Typography: DM Sans for headings, Inter for body text
- Component library includes 30+ pre-built components (buttons, cards, forms, modals)

**Form Management**
- React Hook Form for form state and validation
- Hookform Resolvers for schema validation integration
- Inline error messaging and field-level validation

**Data Visualization**
- Recharts for revenue analytics and reporting charts (line, bar, area charts)
- Custom inventory calendar component for timeline-based bike availability view
- Support for multiple chart types based on reporting period (daily/weekly/monthly/custom)

**Date Handling**
- date-fns for all date manipulation and formatting
- React-day-picker for calendar UI components
- ISO 8601 date strings for storage and API communication

**Routing Strategy**
- Wouter for client-side routing
- Private route wrapper for authentication-protected pages
- Bottom navigation bar for primary app navigation
- Modal-based flows for create/edit operations

### Backend Architecture

**Current Implementation**
- Express.js server with minimal configuration
- In-memory storage implementation (MemStorage class)
- No database persistence in current state
- Server primarily serves static built assets
- Problem: Data lost on server restart
- Solution: Designed for client-side-first MVP; storage interface abstracted for future database integration

**Planned Database Integration**
- Drizzle ORM configured for PostgreSQL
- Schema defined in `shared/schema.ts`
- Migration system configured via `drizzle.config.ts`
- IStorage interface designed for swappable implementations (memory vs. database)
- Note: Database may be added later by code agent; application designed to work with Drizzle + PostgreSQL

**API Structure**
- RESTful endpoints to be implemented in `server/routes.ts`
- Storage abstraction layer provides CRUD operations
- Session management configured for connect-pg-simple
- CORS and rate limiting middleware available

**Authentication & Authorization**
- Role-based access control (Admin, Staff roles)
- Phone-based OTP login flow (simplified for MVP)
- Session persistence across page reloads
- Admin-only actions: delete bookings, manage staff
- Problem: Secure authentication needed for production
- Solution: MVP uses simplified phone/OTP; can integrate Firebase Auth or proper JWT later

### Data Model

**Core Entities**
- **Users**: Staff and admin accounts with role-based permissions
- **Bikes**: Inventory items with photos, KM tracking, damage history, status
- **Customers**: KYC-verified users with ID documents and contact info
- **Bookings**: Rental reservations with multi-bike support, date ranges, payment tracking
- **Damages**: Photo-documented bike damage reports with severity levels
- **Settings**: Shop configuration including revenue visibility toggles

**Booking Status Flow**
- Booked → Active → Completed (normal flow)
- Can be Cancelled or marked Deleted by admin
- Return action transitions booking to Completed and updates bike availability

**Bike Availability Logic**
- Status field: Available, Booked, Maintenance
- Availability calculated based on overlapping bookings
- Opening KM and KM driven tracked for maintenance
- Damage history maintained as array of reports

**Customer KYC**
- ID photo uploads (front/back) for verification
- Multiple ID types supported: Aadhaar, Driving License, Voter ID, Passport
- Verification status: Pending or Verified

### Calendar & Reporting Features

**Inventory Calendar**
- Custom implementation using date-fns (no paid FullCalendar plugins)
- Resource timeline view: bikes as rows, days as columns
- Booking visualization with partial-day support (slanted edges for mid-day start/end)
- Visual indicators: booking status colors, stacked overlapping bookings
- Interactive features: click day to see available bikes, click booking for details
- View modes: Day, Week, Month with navigation controls
- Problem: Complex multi-day booking visualization
- Solution: Custom calendar segments calculation with precise fractional positioning within day cells
- Alternative considered: FullCalendar Scheduler (rejected due to paid license requirement)

**Revenue Reporting**
- Aggregation by period: Daily, Weekly, Monthly, Custom date range
- Visualization with Recharts (line/bar/area charts)
- Tabular data display with export to CSV
- Metrics tracked: rent, deposit, total amount by booking
- Excludes cancelled and deleted bookings from calculations

## External Dependencies

**UI & Component Libraries**
- @radix-ui/* (v1.x): Accessible component primitives for dialogs, dropdowns, tooltips, etc.
- class-variance-authority: Type-safe variant styling
- clsx + tailwind-merge: Conditional class name utilities
- lucide-react: Icon system
- embla-carousel-react: Image carousel component

**Form & Validation**
- react-hook-form: Form state management
- @hookform/resolvers: Schema validation integration
- zod: Runtime type validation
- drizzle-zod: Database schema to Zod schema conversion

**Data & Charts**
- recharts: Charting library for revenue visualizations
- date-fns: Date manipulation and formatting
- @tanstack/react-query: Async state management (configured but minimal usage in client-side app)

**Routing & State**
- wouter: Lightweight React routing
- zustand: State management with persistence

**Build Tools**
- vite: Build tool and dev server
- @vitejs/plugin-react: React support for Vite
- @tailwindcss/vite: Tailwind CSS v4 integration
- tsx: TypeScript execution for server and build scripts
- esbuild: Server bundling

**Backend Dependencies**
- express: Web server framework
- drizzle-orm: Database ORM (configured for PostgreSQL)
- drizzle-kit: Database migration tool
- pg: PostgreSQL client (when database added)
- connect-pg-simple: PostgreSQL session store

**Development Tools**
- @replit/vite-plugin-*: Replit-specific tooling (dev banner, error overlay, cartographer)
- typescript: Type checking
- postcss + autoprefixer: CSS processing

**Notable Architectural Decisions**
- No external API calls in current implementation (fully client-side)
- Image uploads currently use mock URLs; Firebase Storage or server endpoint integration planned
- CSV export implemented client-side using data transformation
- Phone/WhatsApp integration uses native device linking (`tel:` and `wa.me` URLs)
- Lazy loading for inventory calendar component to reduce initial bundle size