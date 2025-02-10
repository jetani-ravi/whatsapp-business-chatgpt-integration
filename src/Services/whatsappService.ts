import axios from 'axios';
import { WHATSAPP_API_URL } from '../config/constant';

const sendMessage = async (
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

const sendProductRecommendations = async (
  phone_number_id: string,
  to: string,
  products: string[]
): Promise<void> => {
  try {
    const productList = products.map(product => `• ${product}`).join('\n');
    const message = `Based on our conversation, here are your recommended products:\n\n${productList}\n\nWould you like to discuss these recommendations further over a voice call or continue via chat?`;
    
    await sendMessage(phone_number_id, to, message);
  } catch (error) {
    console.error('Error sending product recommendations:', error);
    throw error;
  }
};

export { sendMessage, sendProductRecommendations };
