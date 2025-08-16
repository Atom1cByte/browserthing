class BrowserSession {
  constructor(sessionId, page, initialUrl) {
    this.sessionId = sessionId;
    this.page = page;
    this.currentUrl = initialUrl;
    this.isActive = true;
    this.streamingSocket = null;
    this.streamingInterval = null;
    this.lastScreenshot = null;
    
    // wire up event listeners like we're setting up a surveillance system
    this.setupPageListeners();
  }

  setupPageListeners() {
    // eavesdrop on navigation like we're the NSA but for web pages
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) {
        this.currentUrl = frame.url();
        this.notifyUrlChange();
      }
    });

    // spy on console messages because we're nosy like that
    this.page.on('console', (msg) => {
      console.log(`[${this.sessionId}] Console:`, msg.text());
    });

    // catch page errors like we're playing Pokemon but for bugs
    this.page.on('pageerror', (error) => {
      console.error(`[${this.sessionId}] Page error:`, error.message);
    });
  }

  async navigate(url) {
    try {
      // slap https:// on URLs that forgot to dress properly
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      console.log(`[${this.sessionId}] Navigating to: ${url}`);
      await this.page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      this.currentUrl = url;
      return true;
    } catch (error) {
      console.error(`[${this.sessionId}] Navigation error:`, error.message);
      throw error;
    }
  }

  async click(x, y) {
    try {
      await this.page.mouse.click(x, y);
      console.log(`[${this.sessionId}] Clicked at (${x}, ${y})`);
    } catch (error) {
      console.error(`[${this.sessionId}] Click error:`, error.message);
      throw error;
    }
  }

  async type(text) {
    try {
      await this.page.keyboard.type(text);
      console.log(`[${this.sessionId}] Typed: ${text}`);
    } catch (error) {
      console.error(`[${this.sessionId}] Type error:`, error.message);
      throw error;
    }
  }

  async scroll(deltaX, deltaY) {
    try {
      await this.page.evaluate((dx, dy) => {
        window.scrollBy(dx, dy);
      }, deltaX, deltaY);
      console.log(`[${this.sessionId}] Scrolled by (${deltaX}, ${deltaY})`);
    } catch (error) {
      console.error(`[${this.sessionId}] Scroll error:`, error.message);
      throw error;
    }
  }

  async takeScreenshot() {
    try {
      const screenshot = await this.page.screenshot({
        type: 'png',
        encoding: 'base64',
        fullPage: false
      });
      this.lastScreenshot = screenshot;
      return screenshot;
    } catch (error) {
      console.error(`[${this.sessionId}] Screenshot error:`, error.message);
      return null;
    }
  }

  startStreaming(socket) {
    this.streamingSocket = socket;
    
    // send the first screenshot like we're sliding into DMs
    this.sendScreenshot();
    
    // start spamming screenshots every second like an overeager photographer
    this.streamingInterval = setInterval(() => {
      this.sendScreenshot();
    }, 1000); // screenshot go brrr every 1000ms

    console.log(`[${this.sessionId}] Started streaming to socket ${socket.id}`);
  }

  stopStreaming() {
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
    }
    this.streamingSocket = null;
    console.log(`[${this.sessionId}] Stopped streaming`);
  }

  async sendScreenshot() {
    if (!this.streamingSocket || !this.isActive) return;

    try {
      const screenshot = await this.takeScreenshot();
      if (screenshot) {
        this.streamingSocket.emit('screenshot', {
          sessionId: this.sessionId,
          screenshot: screenshot,
          url: this.currentUrl,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`[${this.sessionId}] Error sending screenshot:`, error.message);
    }
  }

  notifyUrlChange() {
    if (this.streamingSocket) {
      this.streamingSocket.emit('url-changed', {
        sessionId: this.sessionId,
        url: this.currentUrl
      });
    }
  }

  async destroy() {
    console.log(`[${this.sessionId}] Destroying session`);
    
    this.isActive = false;
    this.stopStreaming();
    
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }
  }

  getInfo() {
    return {
      sessionId: this.sessionId,
      currentUrl: this.currentUrl,
      isActive: this.isActive,
      hasStreaming: !!this.streamingSocket
    };
  }
}

module.exports = BrowserSession;
