import axios from 'axios';
import { WHATSAPP_API_URL } from '../config/constant';

export const sendMessage = async (
  phone_number_id: string,
  to: string,
  message: string
): Promise<any> => {
  try {
    console.info('Sending WhatsApp message...', phone_number_id, to, message);
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { 
          preview_url: false,
          body: message 
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env['WHATSAPP_TOKEN']}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error?.message || 
      'Something went wrong while sending the WhatsApp message!';
    console.error('Error sending WhatsApp message:', errorMessage);
    throw new Error(errorMessage);
  }
};

export const sendProductRecommendations = async (
  phoneNumberId: string,
  to: string,
  products: Array<{name: string, description: string, link: string}>
) => {
  const message = `Here are your recommended products:\n\n${products.map((product, index) => (
    `${index + 1}. *${product.name}*\n${product.description}\n${product.link}\n`
  )).join('\n')}`;

  return await sendMessage(phoneNumberId, to, message);
};
