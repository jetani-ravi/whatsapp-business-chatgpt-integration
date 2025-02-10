# WhatsApp Voice Agents Integration

A Node.js application that integrates WhatsApp messaging with OpenAI's capabilities to create an intelligent voice-based chat agent.

## Features

- WhatsApp message handling
- Voice message processing
- Integration with OpenAI API
- TypeScript support
- Production-ready with PM2 process management

## Prerequisites

Before running this application, make sure you have the following installed:
- Node.js (v14 or higher)
- Yarn or npm
- PM2 (for production deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whatsapp-openai-integration.git


3. Create a `.env` file in the root directory and add the following configurations:
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=your_openai_api_key
WHATSAPP_TOKEN=your_whatsapp_token
VERIFY_TOKEN=your_verify_token


## Development

To run the application in development mode:

```bash
yarn dev
# or
npm run dev
```

This will start the application with hot-reload enabled.

## Production Deployment

To build and start the application in production:

```bash
# Build the application
yarn compile
# or
npm run compile

# Start with PM2
yarn start
# or
npm run start
```

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
