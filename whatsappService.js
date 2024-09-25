const axios = require('axios');
const { WHATSAPP_API_URL } = require('./constant');

const sendMessage = async (phone_number_id, to, message) => {
  try {
    await axios.post(
      `${WHATSAPP_API_URL}/${phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        text: { body: message },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
};

module.exports = { sendMessage };
