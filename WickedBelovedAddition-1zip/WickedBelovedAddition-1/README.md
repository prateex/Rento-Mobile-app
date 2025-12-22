# Rento Bike Rental Management App

A complete bike rental management system with Express backend and React frontend, deployed as an Android mobile app.

## Project Structure

- **`/backend`** - Main application (Deploy this on Render)
  - Backend API (Express + TypeScript)
  - Frontend (React + Vite)
  - Database schema (Drizzle ORM)
  - Android wrapper (Capacitor)

- **`/Rento-App-02zip`** - Original development structure (legacy)

## Quick Start

### Deploy Backend on Render

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for complete instructions.

**TL;DR:**
```
Root Directory: backend
Build Command: npm install && npm run build:full
Start Command: npm run start
```

### Build Android APK

```bash
cd backend
npm install
npm run build:full
npm run cap:sync
npm run cap:open
```

Then in Android Studio: Build → Build APK(s)

## Features

- 📱 Mobile-first design
- 🚴 Bike inventory management
- 📅 Booking calendar with availability tracking
- 💰 Revenue dashboard
- 📷 Damage documentation with photos
- 📲 WhatsApp integration for customer communication
- 💳 Invoice generation

## Tech Stack

- **Backend:** Node.js, Express, TypeScript
- **Frontend:** React, TanStack Query, Zustand
- **UI:** shadcn/ui, Tailwind CSS
- **Mobile:** Capacitor
- **Database:** PostgreSQL (via Drizzle ORM)
- **Deployment:** Render (Backend), APK (Android)

## Documentation

- [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) - Render deployment guide
- [backend/APK_BUILD_REQUIREMENTS.md](./backend/APK_BUILD_REQUIREMENTS.md) - Android build setup
- [backend/CAPACITOR_SETUP.md](./backend/CAPACITOR_SETUP.md) - Capacitor configuration
- [CHANGE_LOG.md](./CHANGE_LOG.md) - Project change history
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Implementation details

## License

MIT
