const whatsappService = require("./whatsappService");
const openaiService = require("./openaiService");

const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
};

const handleWebhook = async (req, res) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    try {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "messages") {
            console.log("change.value ", change.value);
            if (Array.isArray(change.value.messages)) {
              for (const message of change.value.messages) {
                if (message.type === "text") {
                  const phone_number_id = change.value.metadata.phone_number_id;
                  const from = message.from;
                  const msg_body = message.text.body;

                  const gptResponse = await openaiService.getChatGPTResponse(
                    msg_body
                  );
                  await whatsappService.sendMessage(
                    phone_number_id,
                    from,
                    gptResponse
                  );
                }
              }
            }
          }
        }
      }
      res.status(200).send('OK');
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(404).send('Not Found');
  }
};

module.exports = { verifyWebhook, handleWebhook };

