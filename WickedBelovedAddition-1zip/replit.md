# Bike Rental Management App

## Overview

This is a comprehensive bike rental management system built as a web application simulating a mobile experience. The application enables bike rental shop owners to manage their entire operation including inventory, customers, bookings, payments, and staff. The system is designed with a mobile-first approach but runs in the browser, providing a realistic app-like experience through a constrained mobile viewport.

**Core Purpose**: Enable bike rental shop owners and staff to efficiently manage their rental operations with features for bike tracking, customer KYC verification, booking management, revenue reporting, and inventory calendar visualization.

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
- Local state stored in browser (persisted across sessions)
- Stores user authentication, bikes inventory, customers, bookings, settings, and staff members
- No external state synchronization in current implementation (fully client-side)

**UI Component System**
- Radix UI primitives for accessible, unstyled components
- Tailwind CSS v4 for styling with custom design tokens
- Shadcn-like component architecture with modular, reusable UI elements
- Custom theme: Yellow (#FFD200) primary, White background, Black text
- Typography: DM Sans for headings, Inter for body text

**Form Management**
- React Hook Form for form state and validation
- Hookform Resolvers for schema validation integration

**Data Visualization**
- Recharts for revenue analytics and reporting charts
- FullCalendar with resource-timeline plugin for inventory/availability calendar
- Support for multiple chart types (line, bar, area) based on reporting period

**Date Handling**
- date-fns for all date manipulation and formatting
- React-day-picker for calendar UI components

### Component Structure

**Layout Components**
- `MobileLayout`: Wrapper that constrains viewport and manages bottom navigation
- `BottomNav`: Fixed bottom navigation bar with 5 main sections (Home, Bikes, Bookings, Customers, Settings)

**Page Components**
- Dashboard: Summary stats, quick actions, revenue visibility toggle, inventory calendar
- Bikes: List/grid view, add/edit forms, photo galleries, damage tracking, KM tracking
- Bookings: Create/edit bookings, customer selection, inline customer creation, status management, payment tracking
- Customers: KYC management, ID photo uploads, verification status
- Settings: User profile, staff management, revenue visibility toggle

**Feature Components**
- `InventoryCalendar`: Resource timeline view showing bike availability and bookings (lazy-loaded)
- `RevenueReport`: Modal with period selection (daily/weekly/monthly/custom), charts, and CSV export

### Data Model

**Core Entities**
- **User**: Authentication and role-based access (admin/staff)
- **Bike**: Inventory with photos, specifications, status, opening KM, KM driven, damage tracking
- **Customer**: Contact info, KYC documents (ID photos), verification status
- **Booking**: Rental records with bike assignments, customer reference, dates, pricing (rent + deposit separate), payment status, history tracking
- **Damage**: Bike damage records with photos, severity, notes, resolution tracking
- **Settings**: App configuration including revenue visibility preference

**Key Business Logic**
- Booking overlap prevention (same bike cannot have overlapping active bookings)
- Bike availability calculation based on booking dates
- Role-based permissions (admin-only actions like delete bookings, staff management)
- Booking status workflow: Booked → Active → Completed/Cancelled
- Return bike functionality that updates availability and respects future bookings

### Authentication & Authorization

**Authentication Method**
- Phone-based OTP login (simulated - uses "1234" as mock OTP)
- Session persisted via Zustand persistence
- Login page excludes bottom navigation

**Authorization Levels**
- Admin: Full access to all features including deletion, staff management, settings
- Staff: Limited access (cannot delete bookings or manage staff)
- UI conditionally renders actions based on role
- Backend validation required for production (currently client-side only)

### Backend Architecture

**Current Implementation**
- Express.js server with TypeScript
- Modular route registration pattern
- Static file serving for production build
- Vite dev server integration in development mode
- Session middleware support (express-session with configurable stores)

**Storage Interface**
- Abstract storage interface (`IStorage`) with in-memory implementation (`MemStorage`)
- Designed for easy swap to database implementation
- Current methods: user CRUD operations

**Database Schema**
- Drizzle ORM configured for PostgreSQL
- Schema defined in `shared/schema.ts`
- Migration system configured (`drizzle-kit`)
- Currently minimal schema (users table) - application uses client-side state

**Future Backend Considerations**
- API endpoints needed for: bikes, customers, bookings, payments, damage reports
- File upload handling for photos (bike images, customer KYC, damage photos)
- Real authentication/authorization
- Data persistence and synchronization
- Booking overlap validation on server-side
- Revenue aggregation queries

### External Dependencies

**UI & Component Libraries**
- @radix-ui/* (v1.x): Accessible primitive components (dialogs, dropdowns, select, etc.)
- @fullcalendar/* (v6.1.19): Calendar and resource timeline visualization
- lucide-react: Icon library
- cmdk: Command palette component
- vaul: Drawer component
- class-variance-authority: Component variant management
- tailwind-merge, clsx: Utility class composition

**Data & State Management**
- zustand: State management
- @tanstack/react-query (v5.60.5): Async state and caching
- react-hook-form: Form state management
- @hookform/resolvers: Form validation
- zod: Schema validation
- drizzle-orm, drizzle-zod: ORM and schema validation

**Charts & Visualization**
- recharts: Chart library for revenue reports

**Date & Time**
- date-fns: Date manipulation and formatting

**Backend & Build**
- express: Web server
- vite: Build tool and dev server
- esbuild: Server bundling
- tsx: TypeScript execution
- drizzle-kit: Database migrations

**Database & Sessions**
- pg: PostgreSQL client
- connect-pg-simple: PostgreSQL session store

**Development Tools**
- @replit/vite-plugin-*: Replit-specific development enhancements
- @tailwindcss/vite: Tailwind v4 integration

### Image Handling Strategy

**Current Implementation**
- Mock image URLs in development
- File uploads simulate success but don't persist

**Production Requirements**
- Image upload service needed (Firebase Storage, Cloudinary, or S3)
- Client-side image compression before upload (resize to max 1024px)
- Upload progress indication
- Thumbnail generation for galleries
- Support for: bike photos (multiple), customer KYC documents (front/back), damage photos

### Performance Optimizations

- Lazy loading of InventoryCalendar component (React.lazy + Suspense)
- Server-side bundling of common dependencies to reduce cold start times
- Vite's built-in code splitting and tree shaking
- Mobile-optimized bundle size

### Build & Deployment

**Development**
- Client: `npm run dev:client` (Vite on port 5000)
- Server: `npm run dev` (Express with Vite middleware integration)

**Production**
- `npm run build`: Builds both client (Vite) and server (esbuild)
- `npm start`: Runs production server serving static files
- Output: `dist/public` (client), `dist/index.cjs` (server)

**Database**
- `npm run db:push`: Push schema changes to database

### Key Features Requiring Backend Integration

1. **Booking System**: Overlap validation, availability calculation, status transitions
2. **Revenue Reporting**: Aggregation queries by day/week/month, CSV export
3. **File Uploads**: Bike photos, customer KYC, damage reports
4. **User Management**: Authentication, session management, role permissions
5. **Inventory Calendar**: Real-time availability data, booking visualization
6. **Customer KYC**: Document storage and verification workflow
7. **Damage Tracking**: Photo storage, resolution workflow
8. **Communication**: Phone/WhatsApp integration for customer contact