# Customer Web - Rento Marketplace

Production-grade customer booking website for the Rento multi-vendor vehicle rental marketplace.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📋 Project Structure

```
customer-web/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── common/      # Common components (Button, Modal, etc.)
│   │   ├── search/      # Search-related components
│   │   ├── vehicle/     # Vehicle display components
│   │   └── booking/     # Booking-related components
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component with routing
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── package.json         # Dependencies
```

## 🎯 Features

### Core Functionality
- **Search & Filter**: Search vehicles by city, dates, type, price, transmission
- **Real-time Availability**: Database-level availability checking
- **Secure Booking Flow**: Complete booking process with payment simulation
- **User Authentication**: Supabase Auth with OTP/magic link
- **Booking Management**: View and cancel bookings

### Technical Highlights
- **TypeScript**: Full type safety
- **React Hooks**: Custom hooks for state management
- **Supabase**: Auth, database, RLS policies
- **Tailwind CSS**: Responsive, mobile-first design
- **React Router**: Client-side routing
- **Service Layer**: Clean separation of concerns

## 🔐 Environment Setup

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these from your Supabase project settings.

## 📱 Pages

1. **Home** (`/`) - Hero section with search bar
2. **Search Results** (`/search`) - Vehicle listing with filters
3. **Vehicle Details** (`/vehicle/:id`) - Single vehicle view
4. **Checkout** (`/checkout`) - Booking summary and payment
5. **Booking Success** (`/booking-success/:id`) - Confirmation page
6. **My Bookings** (`/my-bookings`) - User's booking list
7. **Login** (`/login`) - Authentication page

## 🛡️ Security

- Row-Level Security (RLS) policies on all database tables
- Authenticated routes protected with `ProtectedRoute` wrapper
- Supabase Auth session management
- No service role bypass - respects RLS policies

## 🎨 Design System

### Colors
- Primary: Blue (#2563eb)
- Success: Green (#10b981)
- Error: Red (#ef4444)
- Warning: Yellow (#f59e0b)

### Components
- Button variants: primary, secondary, outline, danger
- Loading states with skeletons
- Error messages with retry options
- Modal dialogs
- Responsive navigation

## 🔄 Data Flow

1. **Search**: User enters city and dates → DB function `get_available_vehicles`
2. **Vehicle Details**: Fetch vehicle with images, location, owner → Check real-time availability
3. **Checkout**: Select locations → Calculate pricing → Create booking
4. **Payment**: Simulate payment → Create payment record → Redirect to success
5. **My Bookings**: Fetch user's bookings with vehicle/location details

## 🧪 Testing Checklist

- [ ] Search vehicles by city and dates
- [ ] Apply filters (type, transmission, price)
- [ ] View vehicle details with gallery
- [ ] Check availability for date range
- [ ] Sign in with OTP
- [ ] Create booking with location selection
- [ ] Simulate payment
- [ ] View booking confirmation
- [ ] View all bookings
- [ ] Cancel booking
- [ ] Test responsive design on mobile

## 📦 Dependencies

### Core
- `react` ^18.2.0
- `react-dom` ^18.2.0
- `react-router-dom` ^6.21.0

### Supabase
- `@supabase/supabase-js` ^2.39.0

### UI
- `tailwindcss` ^3.4.0
- `lucide-react` ^0.294.0 (Icons)

### Utils
- `date-fns` ^3.0.0

## 🚧 Limitations (Current Phase)

- Payment is simulated (no real gateway integration)
- No notifications (email/SMS)
- No admin panel
- No owner app changes

## 🔮 Future Enhancements (Next Phases)

- Razorpay/Stripe payment integration
- Email/SMS notifications
- User profile management
- Booking modifications
- Rating and review system
- Owner dashboard
- Admin panel

## 📝 Notes

- All services use database functions for availability to prevent race conditions
- RLS policies enforce data isolation (customer/owner/admin)
- Booking cancellation triggers automatic availability block removal
- Platform users created automatically on first login

## 🤝 Support

For issues or questions, contact support@rento.com

---

**Built with ❤️ for Rento Marketplace**
