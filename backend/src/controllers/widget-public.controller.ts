import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Serve widget script with complete CORS freedom
router.get('/kova-widget.js', (req: Request, res: Response) => {
  try {
    const widgetPath = path.join(__dirname, '..', 'public', 'kova-widget.js');

    if (!fs.existsSync(widgetPath)) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Set complete CORS and security headers for widget loading
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Access-Control-Allow-Credentials', 'false');

    // Remove problematic security headers
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');

    // Set permissive headers
    res.setHeader('Content-Security-Policy', '');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Anti-cache headers
    res.setHeader(
      'Cache-Control',
      'no-cache, no-store, must-revalidate, max-age=0'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', 'v2.1.0-' + Date.now());

    // Set content type
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

    console.log(
      '🔥 Widget script served with CORS headers to:',
      req.get('Origin') || 'no-origin'
    );

    // Send file content
    const widgetContent = fs.readFileSync(widgetPath, 'utf8');
    res.send(widgetContent);
  } catch (error) {
    console.error('Error serving widget:', error);
    res.status(500).json({ error: 'Failed to serve widget' });
  }
});

// Handle OPTIONS for CORS preflight
router.options('/kova-widget.js', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Length', '0');
  res.status(204).end();
});

export default router;
