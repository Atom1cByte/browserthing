class BrowserProxyClient {
    constructor() {
        this.socket = null;
        this.currentSessionId = null;
        this.isConnected = false;
        this.canvas = null;
        this.ctx = null;
        this.lastPingTime = 0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.connectSocket();
    }

    initializeElements() {
        // grab all the control buttons like we're collecting infinity stones
        this.browserSelect = document.getElementById('browser-select');
        this.urlInput = document.getElementById('url-input');
        this.navigateBtn = document.getElementById('navigate-btn');
        this.newSessionBtn = document.getElementById('new-session-btn');
        this.endSessionBtn = document.getElementById('end-session-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        
        // browser navigation buttons because we're basically building Chrome but worse
        this.backBtn = document.getElementById('back-btn');
        this.forwardBtn = document.getElementById('forward-btn');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.addressDisplay = document.getElementById('address-display');
        this.browserType = document.getElementById('browser-type');
        
        // status displays so we can flex our connection stats
        this.sessionStatus = document.getElementById('session-status');
        this.currentUrl = document.getElementById('current-url');
        this.connectionStatus = document.getElementById('connection-status');
        this.latencyDisplay = document.getElementById('latency');
        
        // the canvas where all the browser magic gets painted
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.browserViewport = document.getElementById('browser-viewport');
        this.canvas = document.getElementById('browser-canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    setupEventListeners() {
        // wire up button clicks like we're defusing a bomb
        this.newSessionBtn.addEventListener('click', () => this.createSession());
        this.endSessionBtn.addEventListener('click', () => this.endSession());
        this.navigateBtn.addEventListener('click', () => this.navigate());
        this.refreshBtn.addEventListener('click', () => this.refresh());
        this.logoutBtn.addEventListener('click', () => this.logout());
        
        // URL input events because Enter key supremacy
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigate();
            }
        });
        
        // canvas events so we can click and scroll like we own the place
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('wheel', (e) => this.handleCanvasScroll(e));
        
        // keyboard events for that authentic typing experience
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('screenshot', (data) => {
            this.handleScreenshot(data);
        });
        
        this.socket.on('url-changed', (data) => {
            this.handleUrlChanged(data);
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showError(error);
        });
    }

    async createSession() {
        if (this.currentSessionId) {
            await this.endSession();
        }
        
        this.showLoading(true);
        this.updateSessionStatus('Creating session...');
        
        try {
            const response = await fetch('/api/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    browserType: this.browserSelect.value,
                    url: this.urlInput.value || 'https://www.google.com'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentSessionId = data.sessionId;
                this.socket.emit('join-session', this.currentSessionId);
                this.updateSessionStatus('Session active', true);
                this.updateSessionControls(true);
                this.showCanvas(true);
                console.log('Session created:', this.currentSessionId);
            } else {
                throw new Error(data.error || 'Failed to create session');
            }
        } catch (error) {
            console.error('Error creating session:', error);
            this.showError('Failed to create browser session: ' + error.message);
            this.updateSessionStatus('Session failed');
        } finally {
            this.showLoading(false);
        }
    }

    async endSession() {
        if (!this.currentSessionId) return;
        
        try {
            await fetch(`/api/session/${this.currentSessionId}`, {
                method: 'DELETE'
            });
            
            this.currentSessionId = null;
            this.updateSessionStatus('No active session');
            this.updateSessionControls(false);
            this.showCanvas(false);
            this.clearCanvas();
            console.log('Session ended');
        } catch (error) {
            console.error('Error ending session:', error);
        }
    }

    navigate() {
        if (!this.currentSessionId) {
            this.createSession();
            return;
        }
        
        const url = this.urlInput.value.trim();
        if (!url) return;
        
        this.socket.emit('navigate', {
            sessionId: this.currentSessionId,
            url: url
        });
        
        this.updateSessionStatus('Navigating...');
    }

    refresh() {
        if (!this.currentSessionId) return;
        
        const currentUrl = this.addressDisplay.textContent;
        if (currentUrl && currentUrl !== 'No page loaded') {
            this.socket.emit('navigate', {
                sessionId: this.currentSessionId,
                url: currentUrl
            });
        }
    }

    handleCanvasClick(e) {
        if (!this.currentSessionId) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        this.socket.emit('click', {
            sessionId: this.currentSessionId,
            x: Math.round(x),
            y: Math.round(y)
        });
    }

    handleCanvasMouseMove(e) {
        // TODO: add hover effects when we stop being lazy
    }

    handleCanvasScroll(e) {
        if (!this.currentSessionId) return;
        
        e.preventDefault();
        
        this.socket.emit('scroll', {
            sessionId: this.currentSessionId,
            deltaX: e.deltaX,
            deltaY: e.deltaY
        });
    }

    handleKeyDown(e) {
        if (!this.currentSessionId) return;
        
        // don't hijack typing when user is actually trying to use our inputs (that would be rude)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // only send actual characters, not weird modifier keys
        if (e.key.length === 1) {
            this.socket.emit('type', {
                sessionId: this.currentSessionId,
                text: e.key
            });
        }
    }

    handleKeyUp(e) {
        // keyup events: currently as useful as a chocolate teapot
    }

    handleScreenshot(data) {
        if (data.sessionId !== this.currentSessionId) return;
        
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            
            // calculate ping like we're speedrunning network diagnostics
            const latency = Date.now() - data.timestamp;
            this.latencyDisplay.textContent = latency;
        };
        img.src = 'data:image/png;base64,' + data.screenshot;
        
        this.updateSessionStatus('Session active', true);
    }

    handleUrlChanged(data) {
        if (data.sessionId !== this.currentSessionId) return;
        
        this.addressDisplay.textContent = data.url;
        this.currentUrl.textContent = data.url;
        this.urlInput.value = data.url;
    }

    updateConnectionStatus(connected) {
        this.connectionStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        this.connectionStatus.innerHTML = `<i class="fas fa-circle"></i> ${connected ? 'Connected' : 'Disconnected'}`;
    }

    updateSessionStatus(status, isActive = false) {
        this.sessionStatus.textContent = status;
        this.sessionStatus.className = `status-indicator ${isActive ? 'active' : 'inactive'}`;
    }

    updateSessionControls(hasSession) {
        this.endSessionBtn.disabled = !hasSession;
        this.backBtn.disabled = !hasSession;
        this.forwardBtn.disabled = !hasSession;
        this.refreshBtn.disabled = !hasSession;
        
        if (hasSession) {
            this.browserType.textContent = this.browserSelect.options[this.browserSelect.selectedIndex].text;
        }
    }

    showLoading(show) {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    showCanvas(show) {
        this.canvas.style.display = show ? 'block' : 'none';
        this.browserViewport.style.display = show ? 'none' : 'flex';
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    showError(message) {
        alert('Error: ' + message);
    }

    async logout() {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // end current session if any
            if (this.currentSessionId) {
                await this.endSession();
            }

            // redirect to login page
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
            // force redirect anyway
            window.location.href = '/';
        }
    }
}

// boot up this whole circus when the DOM stops being lazy
document.addEventListener('DOMContentLoaded', () => {
    new BrowserProxyClient();
});
