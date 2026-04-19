import 'dotenv/config';
// ──────────────────────────────────────────────
//  server.ts
//  Main application entry point.
// ──────────────────────────────────────────────
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import eventRoutes from './routes/events';
import gateRoutes from './routes/gates';
import foodRoutes from './routes/food';
import orderRoutes from './routes/orders';
import userEventRoutes from './routes/userEvents';
import userRoutes from './routes/users';
import metricRoutes from './routes/metrics';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = Number(process.env.PORT || 5001);

app.get("/", (_req, res) => {
  res.send("SmartFlow backend alive ✅");
});

// Security & Parsing Middlewares
app.use(helmet());
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean) as string[];

console.log('CORS Allowed Origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting (simple)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 200,
});
app.use('/api', limiter);

// Mount Routers
app.use('/api/events', eventRoutes);
app.use('/api/gates', gateRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/users/:uid/orders', orderRoutes);
app.use('/api/users/:uid/events', userEventRoutes);
app.use('/api/users/:uid', userRoutes);
app.use('/api/metrics', metricRoutes);

// Catch-all 404
app.use('*', (req, res) => {
  res.status(404).json({ error: `Not Found - ${req.originalUrl}` });
});

// Central Error Handler
app.use(errorHandler);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SmartFlow API running on port ${PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing process or set a different PORT in .env.`);
    process.exit(1);
  }
  throw error;
});
