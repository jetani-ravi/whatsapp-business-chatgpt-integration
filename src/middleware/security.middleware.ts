import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to block access to sensitive files and directories
 */
export const blockSensitiveFiles = (req: Request, res: Response, next: NextFunction): void => {
  const blockedPaths = [
    /\.git/,
    /\.env/,
    /node_modules/,
    /\.config/,
    /\.ssh/,
    /\.bash_history/,
    /package-lock\.json/,
    /yarn\.lock/,
    /\.DS_Store/,
    /\.vscode/,
    /\.idea/
  ];
  
  const url = req.originalUrl.toLowerCase();
  
  if (blockedPaths.some(pattern => pattern.test(url))) {
    console.warn(`Blocked access attempt to sensitive path: ${url}`);
    res.status(403).json({
      success: false,
      message: 'Access Forbidden',
    });
    return;
  }
  
  next();
};

/**
 * Middleware to validate API key
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey as string;
  const validApiKey = process.env.X_API_KEY;
  
  if (!apiKey || apiKey !== validApiKey) {
    console.warn('Invalid API key attempt');
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid API Key',
    });
    return;
  }
  
  next();
};

/**
 * Middleware to validate request methods
 * Only allows POST requests except for specific endpoints
 */
export const validateRequestMethod = (req: Request, res: Response, next: NextFunction): void => {
  // Allow GET requests for webhook verification
  if (req.path.includes('/whatsapp/webhook') && req.method === 'GET') {
    next();
    return;
  }
  
  // Allow GET requests for health checks
  if (req.path === '/health' && req.method === 'GET') {
    next();
    return;
  }
  
  // For all other API endpoints, only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      message: 'Method Not Allowed',
      allowedMethods: ['POST']
    });
    return;
  }
  
  next();
};

/**
 * Rate limiting middleware to prevent abuse
 * Simple implementation - for production, consider using a library like 'express-rate-limit'
 */
const requestCounts: Record<string, { count: number, timestamp: number }> = {};
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // Max requests per minute

export const rateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Clean up old entries
  Object.keys(requestCounts).forEach(key => {
    if (now - requestCounts[key].timestamp > WINDOW_MS) {
      delete requestCounts[key];
    }
  });
  
  // Initialize or update request count
  if (!requestCounts[ip]) {
    requestCounts[ip] = { count: 1, timestamp: now };
  } else {
    requestCounts[ip].count++;
  }
  
  // Check if rate limit exceeded
  if (requestCounts[ip].count > MAX_REQUESTS) {
    res.status(429).json({
      success: false,
      message: 'Too Many Requests',
      retryAfter: Math.ceil((requestCounts[ip].timestamp + WINDOW_MS - now) / 1000)
    });
    return;
  }
  
  next();
}; 