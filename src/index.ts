import dotenv from 'dotenv';
import path from 'path';

// Load environment variables at the very beginning
dotenv.config({ path: path.join(__dirname, '../.env') });

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import {router} from './routes/v1';
import { connectDatabase } from './config/database';


// Load environment variables

const app: Express = express();
const port = process.env['PORT'] || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // HTTP request logger
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// app.use('/*', async(req: Request, res: Response, next: NextFunction) => {
//   console.log('__body', req.body)
//   next()
// });

// Connect to MongoDB
connectDatabase();

// API Routes
app.use('/api/v1', router);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});
// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Not Found',
    path: req.originalUrl,
  });
});

// Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env['NODE_ENV'] === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
  console.log(`🚪 Port: ${port}`);
  console.log(`📝 Environment: ${process.env['NODE_ENV']}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

export default app; 