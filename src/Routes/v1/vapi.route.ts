import express from 'express';
import * as vapiController from '../../Controllers/vapi.controller';

const router = express.Router();

// Add error handling middleware
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply the routes with error handling

router.post('/server-events', asyncHandler(vapiController.handleVapiServerEvents));
export default router;
