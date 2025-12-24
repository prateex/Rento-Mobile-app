import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

// Validate Supabase environment variables on startup
function validateEnvironment() {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set these in your .env file');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

// Only validate in production or when Supabase is being used
if (process.env.NODE_ENV === 'production' || process.env.SUPABASE_URL) {
  validateEnvironment();
}

const app = express();
const httpServer = createServer(app);

// Trust proxy for secure cookies behind reverse proxy (Render, etc.)
app.set('trust proxy', 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CORS configuration for mobile app and web access
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
  : ['http://localhost:5000', 'http://localhost:3000', 'capacitor://localhost', 'https://localhost'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed) || allowed === '*')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all for mobile WebView compatibility
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Prevent process from exiting on unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// ============================================
// STARTUP: INITIALIZE ROUTES & MIDDLEWARE
// ============================================

async function startup() {
  try {
    console.log('Starting route registration...');
    // Register all API routes
    await registerRoutes(httpServer, app);
    console.log('✅ Route registration complete');

    // Global error handler - must be after all routes
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Global error handler:', err);
      
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Send proper error response
      if (!res.headersSent) {
        res.status(status).json({ 
          error: message,
          ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
        });
      }
    });
    console.log('✅ Error handler registered');

    // API-only mode: skip static/vite for backend testing
    if (process.env.API_ONLY === 'true') {
      log('API_ONLY mode enabled: skipping static/Vite setup');
    } else {
      // Setup Vite or static files based on environment
      if (process.env.NODE_ENV === "production") {
        try {
          console.log('Setting up static file serving...');
          serveStatic(app);
          console.log('✅ Static file serving ready');
        } catch (err) {
          console.warn('Static file serving setup warning:', err);
          // Continue - API still works without static files
        }
      } else {
        try {
          console.log('Setting up Vite dev server...');
          const { setupVite } = await import("./vite");
          await setupVite(httpServer, app);
          console.log('✅ Vite dev server ready');
        } catch (err) {
          console.warn('Vite setup warning (API will still work):', err);
          // Continue - API still works without Vite
        }
      }
    }

    console.log('✅ Routes and middleware initialized successfully');
    return true;
  } catch (err) {
    console.error('❌ Startup initialization failed:', err);
    throw err;
  }
}

// ============================================
// SERVER LISTEN: GUARANTEED TO EXECUTE
// ============================================

const port = Number(process.env.PORT) || 3000;
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

httpServer.listen(port, host, () => {
  log(`🚀 Server running on http://${host}:${port}`);
  log(`✅ Backend ready for testing`);
  log(`Health check: http://${host}:${port}/health`);
  if (process.env.NODE_ENV === 'production') {
    log(`Production API available at: https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'your-app.onrender.com'}`);
  }
});

httpServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// ============================================
// RUN STARTUP IN BACKGROUND
// ============================================

startup().catch((err) => {
  console.error('❌ Fatal startup error:', err);
  // Server is already listening - log error but don't crash immediately
  // API will still respond but routes/middleware may be incomplete
});

// CRITICAL: Keep process alive indefinitely
// Without this, Node.js will exit after main script completes
// Create keep-alive intervals that cannot be unreferenced

const keepAliveTimer = setInterval(() => {
  // This interval will keep the process alive
}, 30000);

// Prevent Node.js from garbage collecting the timer
keepAliveTimer.ref();

// Also resume stdin to keep another handle active
if (process.stdin) {
  process.stdin.resume();
}
