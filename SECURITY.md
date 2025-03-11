# Security Measures

This document outlines the security measures implemented in the WhatsApp Business ChatGPT Integration application.

## Security Features

### 1. Sensitive File Protection
- Blocks access to sensitive files and directories like `.git`, `.env`, `node_modules`, etc.
- Returns a 403 Forbidden response for any attempt to access these resources.

### 2. API Key Authentication
- All API endpoints require a valid API key.
- The API key can be provided via the `x-api-key` header or as a query parameter `apiKey`.
- Unauthorized requests receive a 401 Unauthorized response.

### 3. Request Method Validation
- Most API endpoints only accept POST requests.
- Exceptions include the WhatsApp webhook verification endpoint which accepts GET requests.
- Requests with invalid methods receive a 405 Method Not Allowed response.

### 4. Rate Limiting
- Limits the number of requests from a single IP address.
- Default limit is 100 requests per minute.
- Exceeding the limit results in a 429 Too Many Requests response.

### 5. Enhanced Logging
- Detailed logging of all requests including request ID, method, URL, IP address, user agent, etc.
- Special logging for security-related events (401, 403, 429 responses).
- Body logging for non-sensitive endpoints.

### 6. Standard Security Headers
- Uses Helmet.js to set security headers:
  - Content-Security-Policy
  - X-XSS-Protection
  - X-Content-Type-Options
  - X-Frame-Options
  - Strict-Transport-Security
  - And more

## Best Practices for Deployment

1. **Use HTTPS**: Always deploy the application with HTTPS in production.
2. **Environment Variables**: Keep all sensitive information in environment variables.
3. **Regular Updates**: Keep all dependencies up to date.
4. **Monitoring**: Implement monitoring to detect unusual activity.
5. **Backups**: Regularly backup your database and configuration.

## Security Contacts

If you discover a security vulnerability, please report it to [security@example.com](mailto:security@example.com). 