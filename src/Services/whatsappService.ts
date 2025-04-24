import axios from 'axios';
import { WHATSAPP_API_URL } from '../config/constant';

export const sendMessage = async (
  phone_number_id: string,
  to: string,
  message: string
): Promise<any> => {
  try {
    console.info('____Sending WhatsApp message...', phone_number_id, to, message);
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phone_number_id}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env['WHATSAPP_TOKEN']}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.error?.message ||
      'Something went wrong while sending the WhatsApp message!';
    console.error('Error sending WhatsApp message:', errorMessage);
    console.error('Error sending WhatsApp message:___', error);
    throw new Error(errorMessage);
  }
};

export const sendProductRecommendations = async (
  phoneNumberId: string,
  to: string,
  products: Array<{ name: string; description: string; link: string }>
) => {
  console.log('Sending product recommendations...', phoneNumberId, to);
  console.log('products____', JSON.stringify(products));
  const message = `Ecco i prodotti consigliati: \n\n${products
    .map(
      (product, index) =>
        `${index + 1}. *${product.name}*\n${product.description}\n${product.link}\n`
    )
    .join('\n')}`;

  return sendMessage(phoneNumberId, to, message);
};

export const sendWhatsAppFollowUpMessage = async (
  phoneNumberId: string,
  to: string,
  name: string
) => {
  try {
    const headers = {
      Authorization: `Bearer ${process.env['WHATSAPP_TOKEN']}`,
      'Content-Type': 'application/json',
    };
    const templateName = process.env['FOLLOW_UP_TEMPLATE'];
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'it',
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                parameter_name: 'name',
                text: name,
              },
            ],
          },
        ],
      },
    };
    const response = await axios.post(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, data, {
      headers,
    });

    return response.data;
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.error?.message ||
      'Something went wrong while sending the WhatsApp message!';
    console.error('Error sending WhatsApp message:', errorMessage);
    console.error('Error sending WhatsApp message:___', error);
    throw new Error(errorMessage);
  }
};

/**
 * Sends a message to WhatsApp, handling chunking for long messages if needed
 * WhatsApp has a character limit of approximately 4096 characters
 */


export default {
  sendMessage,
  sendWhatsAppFollowUpMessage,
  sendProductRecommendations,
};
