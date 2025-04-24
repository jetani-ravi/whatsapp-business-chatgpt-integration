import { Request, Response } from 'express';
import {
  sendMessage,
  sendWhatsAppFollowUpMessage,
} from '../Services/whatsappService';
import llmService from '../Services/llmService';
import Conversation from '../Models/conversation.model';
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

const handleWebhook = async (req: Request, res: Response): Promise<void> => {
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
                await sendMessage(phone_number_id, from, formattedResponse);
                
                console.log(`Response ${formattedResponse} sent to ${from} successfully`);
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
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};

const getConversationSummary = async (conversation: any, isVoiceCall: boolean = false) => {
  if (!conversation) return '';

   const messages = conversation.messages
    .filter((msg: any) => msg.role !== 'system')
    .map((msg: any) => `${msg.role}: ${msg.content}`)
    .join('\n');

    const transcript = conversation.transcript;
    let systemMessage = '';

    if(transcript) {
      systemMessage = 
      `Genera un riepilogo della conversazione con il cliente e l'assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, soddisfazione del cliente, passi successivi del cliente. Sii breve e conciso. Includi solo i dettagli della trascrizione, assicurati di non includere altre informazioni o di non aggiungere ipotesi.

- Se non hai abbastanza informazioni per il riepilogo, restituisci "Non disponibile".
- Mantieni solo le informazioni della trascrizione, non aggiungere altre informazioni o di non aggiungere ipotesi.
- Non aggiungere informazioni come "Genererò un riepilogo" o "Ecco il riepilogo della conversazione", restituisci semplicemente il riepilogo.
- Se hai abbastanza informazioni, riepiloga solo quelle disponibili. Non chiedere ulteriori informazioni o le mie preferenze. Riepiloga solo ciò che hai e riepiloga la conversazione.
- Se non hai abbastanza informazioni, restituisci "Non disponibile".
- Assicurati di mantenere solo le informazioni essenziali, non aggiungere informazioni extra, sii conciso per il riepilogo della prossima chiamata.

Trascrizione della chiamata vocale tra cliente e assistente:
Trascrizione della chiamata: ${transcript}

È presente la cronologia delle conversazioni tra cliente e assistente su WhatsApp. Genera un riepilogo della conversazione con cliente e assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, soddisfazione del cliente, passaggi successivi del cliente. Sii breve e conciso. Includi solo i dettagli della trascrizione.`;
    } else {
      systemMessage = `
      Genera un riepilogo della conversazione con il cliente e l'assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, soddisfazione del cliente, passaggi successivi del cliente. Sii breve e conciso. Includi solo i dettagli della trascrizione, assicurati di non includere altre informazioni o di non aggiungere ipotesi.
- Assicurati di non aggiungere altre informazioni o di non aggiungere ipotesi. Se non hai abbastanza informazioni per il riepilogo, restituisci "Non disponibile". Se hai abbastanza informazioni, riepiloga semplicemente le informazioni disponibili. Non chiedere ulteriori informazioni o le mie preferenze. Riepiloga solo ciò che hai e riepiloga la conversazione.
- Se non hai abbastanza informazioni, restituisci "Non disponibile".
- Non aggiungere informazioni come "Genererò un riepilogo" o "Ecco il riepilogo della conversazione", restituisci solo il riepilogo.
- Assicurati di mantenere solo le informazioni essenziali, non aggiungere informazioni extra, sii conciso per il riepilogo della prossima chiamata.

Cronologia delle conversazioni tra cliente e assistente su WhatsApp. Genera un riepilogo della conversazione con cliente e assistente. Evidenzia i punti importanti e i prodotti consigliati. Punti chiave da includere: nome del cliente, tipo di pelle del cliente, problemi di pelle del cliente, prodotti consigliati, soddisfazione del cliente, passaggi successivi del cliente. Sii breve e conciso. Includi solo i dettagli dalla trascrizione. Cronologia delle conversazioni: ${messages}
      `;
    }


    if(isVoiceCall) {
      const summary = await llmService.getResponse(messages, systemMessage);
      console.log('getConversationSummary____summary____', summary?.content);
      return summary?.content || '';
    }
    return messages;

};


export {
  verifyWebhook,
  handleWebhook,
  sendFollowUpMessage,
};

