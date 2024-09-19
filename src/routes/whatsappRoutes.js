const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

router.get('/', whatsappController.verifyWebhook);
router.post('/', whatsappController.handleWebhook);

module.exports = router;