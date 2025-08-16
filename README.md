# BrowserProxy - Browserling Clone

A web-based browser proxy service that allows users to access websites through a remote browser session, similar to Browserling. This tool is particularly useful for bypassing network restrictions and testing websites in different browser environments.

## Features

- **Remote Browser Sessions**: Create isolated browser sessions that run on the server
- **Real-time Interaction**: Click, type, scroll, and navigate in real-time through WebSocket connections
- **Screenshot Streaming**: Live screenshots streamed to your browser every second
- **Multiple Browser Support**: Chrome, Firefox, and Safari options (currently Chrome implemented)
- **Proxy Functionality**: Built-in proxy to handle cross-origin requests
- **Session Management**: Create, manage, and destroy browser sessions
- **Security**: Rate limiting, CORS protection, and session isolation

## Architecture

### Backend Components

1. **Server (server.js)**: Main Express.js server with Socket.IO for real-time communication
2. **BrowserManager**: Manages Puppeteer browser instances and sessions
3. **BrowserSession**: Individual browser session with screenshot streaming and interaction handling
4. **ProxyHandler**: HTTP proxy middleware for handling web requests through the server

### Frontend Components

1. **HTML Interface**: Clean, responsive web interface similar to Browserling
2. **JavaScript Client**: Handles WebSocket communication and user interactions
3. **Canvas Rendering**: Displays browser screenshots and handles user input

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd browserthing
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Create a Session**: Click "New Session" to start a remote browser instance
2. **Navigate**: Enter a URL in the input field and click "Go" or press Enter
3. **Interact**: Click, scroll, and type directly on the browser canvas
4. **End Session**: Click "End Session" when finished to clean up resources

## API Endpoints

### REST API

- `POST /api/session/create` - Create a new browser session
- `DELETE /api/session/:sessionId` - Destroy a browser session
- `GET /proxy/:sessionId/*` - Proxy web requests through the session

### WebSocket Events

#### Client to Server
- `join-session` - Join a browser session for streaming
- `navigate` - Navigate to a URL
- `click` - Click at coordinates
- `type` - Type text
- `scroll` - Scroll the page

#### Server to Client
- `screenshot` - Receive browser screenshot
- `url-changed` - URL change notification
- `error` - Error messages

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)

### Browser Settings

The browser is configured with the following Puppeteer options:
- Headless mode enabled
- No sandbox for compatibility
- Disabled GPU acceleration
- Custom viewport (1024x768)

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configurable cross-origin policies
- **Session Isolation**: Each session runs in a separate browser context
- **Content Security**: Helmet.js for security headers
- **Request Filtering**: Proxy filters and modifies responses

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for automatic server restarts on file changes.

### Testing

```bash
npm test
```

## Browser Compatibility

### Server Requirements
- Node.js 14+
- Chrome/Chromium for Puppeteer

### Client Requirements
- Modern web browser with WebSocket support
- Canvas API support
- ES6+ JavaScript support

## Limitations

1. **Performance**: Screenshot streaming every second may cause latency
2. **Concurrent Sessions**: Limited by server resources
3. **Browser Features**: Some advanced browser features may not work in headless mode
4. **File Downloads**: File downloads are not currently supported
5. **Popup Windows**: Popups are blocked by default

## Use Cases

- **Network Bypass**: Access blocked websites through the proxy
- **Cross-browser Testing**: Test websites in different browser environments
- **Safe Browsing**: Browse potentially unsafe websites in an isolated environment
- **Educational**: Learn web development and browser behavior
- **Accessibility**: Access websites when local browser restrictions apply

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

This tool is for educational and legitimate testing purposes only. Users are responsible for complying with all applicable laws and website terms of service when using this proxy service.
