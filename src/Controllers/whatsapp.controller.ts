import { Request, Response } from 'express';
import {
  sendMessage,
  sendWhatsAppFollowUpMessage,
} from '../Services/whatsappService';
import { getVoiceFlowResponse, formatVoiceFlowResponses } from '../Services/voiceflowService';

const verifyWebhook = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === process.env['VERIFY_TOKEN']) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
};

const sendFollowUpMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('sendFollowUpMessage____Body___2', req.body);
    const { name, phoneNumber: to } = req.body;
    const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] || '';

    if (!to) {
      res.status(400).send('Phone number is required');
      return;
    }
    if (!name) {
      res.status(400).send('Name is required');
      return;
    }
    await sendWhatsAppFollowUpMessage(phoneNumberId, to, name);

    console.log(
      `Follow up message initiated successfully with Name: ${name} and Phone Number: ${to}`
    );
    res.status(200).send({
      status: 'success',
      message: `Follow up message has been sent successfully with Name: ${name} and PhoneNumber: ${to} `,
    });
  } catch (error) {
    console.error('Error sending follow up message:', error);
    res.status(500).send({
      status: 'error',
      message: 'Error sending follow up message',
    });
  }
};

const handleWebhook = async (req: Request, res: Response): Promise<any> => {
  try {
    const { object, entry } = req.body;

    console.log('handleWebhook_object____', JSON.stringify(object));
    console.log('handleWebhook_entry____', JSON.stringify(entry));

    if (object !== 'whatsapp_business_account') {
      console.log('Unhandled webhook object type:', object);
      res.status(200).send('OK');
      return;
    }

    if (!Array.isArray(entry) || entry.length === 0) {
      console.log('No entries in webhook payload');
      res.status(200).send('OK');
      return;
    }

    for (const entryItem of entry) {
      const changes = entryItem.changes;

      for (const change of changes) {
        // Skip if this is a status update
        if (change.value?.statuses) {
          console.log('Skipping status update webhook');
          continue;
        }

        // Only process if there are messages
        if (change.field === 'messages' && change.value?.messages) {
          const { metadata, messages } = change.value;

          if (!Array.isArray(messages) || messages.length === 0) {
            continue;
          }

          for (const message of messages) {
            if (message.type === 'text') {
              const phone_number_id = metadata.phone_number_id;
              const from = message.from;
              const msg_body = message.text.body;
              
              console.log('handleWebhook_from____', from);
              console.log('Received message:', msg_body);
              
              try {
                // Generate a consistent user ID from the phone number
                const userId = `whatsapp-${from}`;
                
                
                // Get response from VoiceFlow
                // For first interaction, pass empty message to trigger the welcome flow
                const voiceFlowResponse = await getVoiceFlowResponse(
                  userId, 
                  msg_body
                );
                
                // Format the VoiceFlow response
                const formattedResponse = formatVoiceFlowResponses(voiceFlowResponse);
                
                // Send the response back to WhatsApp using sendLongMessage to handle large responses
                console.log(`Response ${formattedResponse} sent to ${from} successfully`);
                await sendMessage(phone_number_id, from, formattedResponse);
                return res.status(200).send('OK');
                
              } catch (error) {
                console.error('Error processing message with VoiceFlow:', error);
                // Send fallback message if VoiceFlow fails
                await sendMessage(
                  phone_number_id, 
                  from, 
                  "I'm sorry, I'm having trouble processing your request right now. Please try again later."
                );
              }
            }
          }
        }
        res.status(200).send('OK');
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};



export {
  verifyWebhook,
  handleWebhook,
  sendFollowUpMessage,
};

