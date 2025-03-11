import { Request, Response, NextFunction } from 'express';

/**
 * Enhanced request logger middleware
 * Logs detailed information about each request
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Store the original end method
  const originalEnd = res.end;
  
  // Override the end method
  res.end = function(chunk?: any, encoding?: any, callback?: any): any {
    const responseTime = Date.now() - start;
    const statusCode = res.statusCode;
    
    // Log request details
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.getHeader('content-length') || 'unknown'
    }));
    
    // Log security-related events separately
    if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
      console.warn(JSON.stringify({
        securityEvent: true,
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        statusCode,
        message: statusCode === 401 ? 'Unauthorized access attempt' : 
                 statusCode === 403 ? 'Forbidden resource access attempt' : 
                 'Rate limit exceeded'
      }));
    }
    
    // Call the original end method and return its result
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
};

/**
 * Body logger middleware
 * Logs request body for debugging purposes
 */
export const bodyLogger = (req: Request, _res: Response, next: NextFunction): void => {
  // Don't log bodies for sensitive endpoints
  const sensitiveEndpoints = ['/login', '/auth', '/password'];
  if (!sensitiveEndpoints.some(endpoint => req.path.includes(endpoint))) {
    console.log('Request Body:', JSON.stringify(req.body));
  }
  
  next();
}; 