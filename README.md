# WhatsApp Business ChatGPT Integration

This project integrates WhatsApp Business API with ChatGPT to provide automated customer service and product recommendations.

## Features

- WhatsApp message handling
- Intent detection
- Channel preference detection (voice, WhatsApp, chat)
- Product recommendations
- Follow-up calls and messages
- Conversation history tracking

## LLM Service Architecture

The project now uses an abstract LLM service built with LangChain, which allows for:

- Model-agnostic implementation
- Easy switching between different LLM providers
- Structured output parsing
- Consistent interface for all LLM operations

### Supported LLM Providers

Currently, the following LLM providers are supported:

- OpenAI (GPT-4 Turbo)

The architecture is designed to be easily extended to support additional providers in the future.

## Environment Variables

Create a `.env` file with the following variables:

```
OPENAI_API_KEY=your_openai_api_key
VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
LLM_PROVIDER=openai
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Using PM2 for Process Management

```bash
npm run pm2:start
```

## Extending the LLM Service

To add support for additional LLM providers:

1. Update the `LLMProvider` type in `src/Services/llmService.ts`
2. Add the provider's initialization logic in the `initializeModel` method
3. Install the necessary dependencies

## License

ISC

## Project Structure

```
├── src/
│   ├── Controllers/
│   │   └── whatsappController.ts
│   ├── Routes/
│   │   └── v1/
│   │       ├── index.ts
│   │       └── whatsapp.route.ts
│   ├── Services/
│   │   └── openaiService.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

- `GET /v1/webhook`: WhatsApp verification endpoint
- `POST /v1/webhook`: WhatsApp message handling endpoint

## Scripts

- `yarn dev`: Run in development mode with hot-reload
- `yarn compile`: Build the TypeScript code
- `yarn start`: Start the application with PM2
- `yarn watch`: Run with nodemon for development
- `yarn compile:watch`: Watch for TypeScript changes

## Environment Variables

| Variable | Description |
|----------|-------------|
| NODE_ENV | Application environment (development/production) |
| PORT | Server port number |
| OPENAI_API_KEY | OpenAI API key for AI integration |
| WHATSAPP_TOKEN | WhatsApp Cloud API token |
| VERIFY_TOKEN | Webhook verification token |

## Author

Ravi Jetani

## License

ISC

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For support, email your-email@example.com or open an issue in the repository.

## Development

To run the application in development mode:
