// require('dotenv').config();
const whatsappController = require('./whatsappController');
async function main(req,res) {
if (req.method === 'GET') {
    whatsappController.verifyWebhook(req, res);
  } else if (req.method === 'POST') {
    await whatsappController.handleWebhook(req, res);
  } else {
    res.status(405).send('Method Not Allowed');
  }

}