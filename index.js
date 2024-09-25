// require('dotenv').config();
const functions = require('@google-cloud/functions-framework');
const whatsappController = require('./whatsappController');

functions.http('facebookWebhookProxyV2', async (req, res) => {
  if (req.method === 'GET') {
    whatsappController.verifyWebhook(req, res);
  } else if (req.method === 'POST') {
    await whatsappController.handleWebhook(req, res);
  } else {
    res.status(405).send('Method Not Allowed');
  }
});