import express from 'express';
import whatsappRoute from './whatsapp.route';
import vapiRoute from './vapi.route';


const router = express.Router();

// Register WhatsApp routes
router.use('/whatsapp', whatsappRoute);
router.use('/vapi', vapiRoute);

export { router as v1Router };
