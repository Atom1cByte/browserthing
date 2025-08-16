const { createProxyMiddleware } = require('http-proxy-middleware');

class ProxyHandler {
  constructor() {
    this.proxyCache = new Map();
  }

  handleRequest(req, res, next) {
    const sessionId = req.params.sessionId;
    const targetUrl = req.params[0]; // yoink everything after the sessionId like we're stealing cookies from grandma
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'No target URL provided' });
    }

    // time to build this URL like we're assembling IKEA furniture (hopefully with less crying)
    let fullTargetUrl;
    try {
      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        fullTargetUrl = targetUrl;
      } else {
        fullTargetUrl = 'https://' + targetUrl;
      }
      
      const targetDomain = new URL(fullTargetUrl).origin;
      
      // either grab the proxy from our stash or make a fresh one (like choosing between leftover pizza or ordering new)
      let proxy = this.proxyCache.get(targetDomain);
      if (!proxy) {
        proxy = this.createProxy(targetDomain);
        this.proxyCache.set(targetDomain, proxy);
      }
      
      // redirect this request like we're GPS recalculating after you missed the exit
      req.url = req.url.replace(`/proxy/${sessionId}`, '');
      
      proxy(req, res, next);
      
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({ error: 'Proxy request failed' });
    }
  }

  createProxy(targetDomain) {
    return createProxyMiddleware({
      target: targetDomain,
      changeOrigin: true,
      secure: true,
      followRedirects: true,
      logLevel: 'warn',
      
      onProxyReq: (proxyReq, req, res) => {
        // dress up this request like it's going to prom so websites don't sus us out
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
        proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.5');
        proxyReq.setHeader('Accept-Encoding', 'gzip, deflate');
        proxyReq.setHeader('Connection', 'keep-alive');
        proxyReq.setHeader('Upgrade-Insecure-Requests', '1');
      },
      
      onProxyRes: (proxyRes, req, res) => {
        // delete these security headers like they're your browser history before your mom checks
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];
        delete proxyRes.headers['content-security-policy-report-only'];
        
        // make CORS more permissive than your parents when you were 5
        proxyRes.headers['access-control-allow-origin'] = '*';
        proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['access-control-allow-headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
        
        // if it's HTML, we're about to perform some sketchy script injection (totally legal btw)
        if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/html')) {
          this.modifyHtmlResponse(proxyRes, req, res);
        }
      },
      
      onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(500).json({ 
          error: 'Proxy request failed',
          message: err.message 
        });
      }
    });
  }

  modifyHtmlResponse(proxyRes, req, res) {
    let body = '';
    const originalWrite = res.write;
    const originalEnd = res.end;
    
    res.write = function(chunk) {
      if (chunk) {
        body += chunk.toString();
      }
    };
    
    res.end = function(chunk) {
      if (chunk) {
        body += chunk.toString();
      }
      
      // time to inject our script like we're mainlining JavaScript directly into the DOM's veins
      const injectionScript = `
        <script>
          // keep this page trapped in our iframe like it's grounded for bad behavior
          if (window.top !== window.self) {
            // nerf window.open harder than they nerfed your favorite video game character
            window.open = function() { return null; };
            
            // hijack location changes like we're stealing a car but it's totally legal
            const originalReplace = window.location.replace;
            window.location.replace = function(url) {
              if (url.startsWith('http')) {
                window.parent.postMessage({type: 'navigate', url: url}, '*');
                return;
              }
              originalReplace.call(window.location, url);
            };
          }
        </script>
      `;
      
      // shove our script in right before the body closes like we're sneaking into a movie theater
      if (body.includes('</body>')) {
        body = body.replace('</body>', injectionScript + '</body>');
      } else if (body.includes('</html>')) {
        body = body.replace('</html>', injectionScript + '</html>');
      } else {
        body += injectionScript;
      }
      
      // recalculate content length because we just made this HTML thicc with our script
      res.setHeader('content-length', Buffer.byteLength(body));
      
      originalEnd.call(res, body);
    };
  }

  clearCache() {
    this.proxyCache.clear();
  }
}

module.exports = ProxyHandler;
