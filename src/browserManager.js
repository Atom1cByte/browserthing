const puppeteer = require('puppeteer');
const BrowserSession = require('./browserSession');

class BrowserManager {
  constructor() {
    this.sessions = new Map();
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
    }
    return this.browser;
  }

  async createSession(sessionId, browserType = 'chrome', initialUrl = 'https://www.google.com') {
    try {
      await this.initialize();
      
      const page = await this.browser.newPage();
      
      // set the viewport size like we're adjusting our monitor for maximum gaming performance
      await page.setViewport({
        width: 1024,
        height: 768,
        deviceScaleFactor: 1
      });

      // disguise ourselves as Chrome because everyone pretends to be Chrome these days
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const session = new BrowserSession(sessionId, page, initialUrl);
      this.sessions.set(sessionId, session);

      // send this browser to its first destination like a GPS that actually works
      await session.navigate(initialUrl);

      console.log(`Created browser session: ${sessionId}`);
      return session;
    } catch (error) {
      console.error('Error creating browser session:', error);
      throw error;
    }
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  async destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.destroy();
      this.sessions.delete(sessionId);
      console.log(`Destroyed browser session: ${sessionId}`);
    }
  }

  async cleanup() {
    console.log('Cleaning up browser sessions...');
    
    // obliterate all sessions like Thanos but for browser tabs
    for (const [sessionId, session] of this.sessions) {
      try {
        await session.destroy();
      } catch (error) {
        console.error(`Error destroying session ${sessionId}:`, error);
      }
    }
    this.sessions.clear();

    // shut down the browser like we're putting it to sleep forever (RIP)
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  getSessionCount() {
    return this.sessions.size;
  }
}

module.exports = BrowserManager;
