import express from 'express';
import whatsappRoute from './whatsapp.route';

const router = express.Router();

// Register WhatsApp routes
router.use('/whatsapp', whatsappRoute);

export { router };
