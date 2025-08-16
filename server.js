const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');

const BrowserManager = require('./src/browserManager');
const ProxyHandler = require('./src/proxyHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// security middleware because we're not trying to get pwned by script kiddies
app.use(helmet({
  contentSecurityPolicy: false, // turn off CSP because it's cockblocking our proxy
  crossOriginEmbedderPolicy: false
}));

// rate limiting so people can't spam us into oblivion
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // cap at 100 requests because we're not running a charity here
});
app.use(limiter);

// enable CORS and JSON parsing like we're opening all the doors
app.use(cors());
app.use(express.json());

// session middleware for passcode authentication (because we're not running a charity)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours because ain't nobody got time to re-auth constantly
  }
}));

// the sacred passcode (change this or put it in env vars)
const PASSCODE = process.env.PASSCODE || 'letmein2024';

// authentication middleware that's more protective than a helicopter parent
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }

  // check if they're trying to authenticate
  if (req.path === '/api/auth' && req.method === 'POST') {
    return next();
  }

  // redirect to login for HTML requests, return 401 for API requests
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required. Nice try though.' });
  }

  // serve the login page instead of the main app
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
};

app.use(express.static(path.join(__dirname, 'public')));

// spawn our manager overlords
const browserManager = new BrowserManager();
const proxyHandler = new ProxyHandler();

// authentication route (the bouncer at the club)
app.post('/api/auth', (req, res) => {
  const { passcode } = req.body;

  if (passcode === PASSCODE) {
    req.session.authenticated = true;
    res.json({ success: true, message: 'Welcome to the party!' });
  } else {
    res.status(401).json({ success: false, message: 'Wrong passcode, buddy. Try again.' });
  }
});

// logout route (for when you want to peace out)
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully. See ya!' });
});

// set up routes like we're building a highway system
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API routes where the real magic happens
app.post('/api/session/create', requireAuth, async (req, res) => {
  try {
    const sessionId = uuidv4();
    const { browserType = 'chrome', url = 'https://www.google.com' } = req.body;
    
    const session = await browserManager.createSession(sessionId, browserType, url);
    res.json({ sessionId, success: true });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create browser session' });
  }
});

app.delete('/api/session/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    await browserManager.destroySession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error destroying session:', error);
    res.status(500).json({ error: 'Failed to destroy session' });
  }
});

// proxy middleware that's basically a man-in-the-middle attack but legal
app.use('/proxy/:sessionId/*', requireAuth, proxyHandler.handleRequest.bind(proxyHandler));

// Socket.IO for that sweet real-time browser puppeteering
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // check if socket connection is authenticated (no freeloaders allowed)
  const sessionCookie = socket.handshake.headers.cookie;
  if (!sessionCookie || !sessionCookie.includes('connect.sid')) {
    socket.emit('error', 'Authentication required for socket connection');
    socket.disconnect();
    return;
  }
  
  socket.on('join-session', async (sessionId) => {
    try {
      socket.join(sessionId);
      const session = browserManager.getSession(sessionId);
      if (session) {
        // start the screenshot spam train
        session.startStreaming(socket);
      }
    } catch (error) {
      console.error('Error joining session:', error);
      socket.emit('error', 'Failed to join session');
    }
  });
  
  socket.on('navigate', async (data) => {
    try {
      const { sessionId, url } = data;
      const session = browserManager.getSession(sessionId);
      if (session) {
        await session.navigate(url);
      }
    } catch (error) {
      console.error('Error navigating:', error);
      socket.emit('error', 'Navigation failed');
    }
  });
  
  socket.on('click', async (data) => {
    try {
      const { sessionId, x, y } = data;
      const session = browserManager.getSession(sessionId);
      if (session) {
        await session.click(x, y);
      }
    } catch (error) {
      console.error('Error clicking:', error);
    }
  });
  
  socket.on('type', async (data) => {
    try {
      const { sessionId, text } = data;
      const session = browserManager.getSession(sessionId);
      if (session) {
        await session.type(text);
      }
    } catch (error) {
      console.error('Error typing:', error);
    }
  });
  
  socket.on('scroll', async (data) => {
    try {
      const { sessionId, deltaX, deltaY } = data;
      const session = browserManager.getSession(sessionId);
      if (session) {
        await session.scroll(deltaX, deltaY);
      }
    } catch (error) {
      console.error('Error scrolling:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Browserling Clone server running on port ${PORT}`);
});

// graceful shutdown because we're classy like that
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await browserManager.cleanup();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
