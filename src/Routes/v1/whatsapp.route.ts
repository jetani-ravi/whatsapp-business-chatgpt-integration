import express from 'express';
import { verifyWebhook, handleWebhook, sendRecommendedProductOverWhatsApp } from '../../Controller/whatsappController';

const router = express.Router();

// Add error handling middleware
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply the routes with error handling
router.get('/webhook', asyncHandler(verifyWebhook));
router.post('/webhook', asyncHandler(handleWebhook));
router.post('/send-recommendations', asyncHandler(sendRecommendedProductOverWhatsApp));

export default router;
