import express from 'express';
import * as whatsappController from '../../Controllers/whatsapp.controller';

const router = express.Router();

// Add error handling middleware
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply the routes with error handling

router.get('/webhook', asyncHandler(whatsappController.verifyWebhook));
router.post('/initiate-call', asyncHandler(whatsappController.initiateFollowUpCall));

router.post('/webhook', asyncHandler(whatsappController.handleWebhook));
router.post('/send-recommendations', asyncHandler(whatsappController.sendRecommendedProductOverWhatsApp));

router.post('/follow-up', asyncHandler(whatsappController.sendFollowUpMessage));
export default router;
