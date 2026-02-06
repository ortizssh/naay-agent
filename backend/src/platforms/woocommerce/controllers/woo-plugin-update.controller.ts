/**
 * WooCommerce Plugin Update Controller
 * Provides update information for the WordPress plugin auto-updater
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Plugin metadata - update this when releasing new versions
const PLUGIN_INFO = {
  slug: 'kova-agent',
  name: 'Kova Agent - AI Shopping Assistant',
  version: '1.0.0', // Current version available for download
  tested: '6.4',
  requires: '5.8',
  requires_php: '7.4',
  author: 'Kova AI',
  author_profile: 'https://kova.ai',
  homepage: 'https://kova.ai',
  description:
    'AI-powered shopping assistant for WooCommerce stores. Provides intelligent product search, recommendations, and cart management through a chat widget.',
  changelog: `
        <h4>1.0.0 - Initial Release</h4>
        <ul>
            <li>AI-powered chat widget</li>
            <li>Semantic product search</li>
            <li>Cart management</li>
            <li>WooCommerce Store API integration</li>
            <li>Modern admin panel</li>
        </ul>
    `,
  installation: `
        <ol>
            <li>Upload the plugin files to <code>/wp-content/plugins/kova-agent</code></li>
            <li>Activate the plugin through the 'Plugins' menu in WordPress</li>
            <li>Navigate to WooCommerce → Kova Agent to configure the plugin</li>
            <li>Enter your API credentials and enable the widget</li>
        </ol>
    `,
  icons: {
    '1x': 'https://naay-agent-app1763504937.azurewebsites.net/assets/plugin-icon-128.png',
    '2x': 'https://naay-agent-app1763504937.azurewebsites.net/assets/plugin-icon-256.png',
  },
  banners: {
    low: 'https://naay-agent-app1763504937.azurewebsites.net/assets/plugin-banner-772x250.png',
    high: 'https://naay-agent-app1763504937.azurewebsites.net/assets/plugin-banner-1544x500.png',
  },
};

/**
 * GET /api/woo/plugin/update-info
 * POST /api/woo/plugin/update-info
 * Returns plugin update information for WordPress auto-updater
 */
router.all('/update-info', async (req: Request, res: Response) => {
  try {
    const requestData = req.method === 'POST' ? req.body : req.query;

    // Log update check for analytics (optional)
    const siteUrl =
      requestData.site_url || req.headers['x-kova-site'] || 'unknown';
    const currentVersion = requestData.version || 'unknown';

    console.log(
      `[Plugin Update Check] Site: ${siteUrl}, Current Version: ${currentVersion}`
    );

    // Get the download URL - this should point to the latest plugin ZIP
    const baseUrl =
      process.env.API_URL ||
      process.env.SHOPIFY_APP_URL ||
      'https://api.kova.ai';
    const downloadUrl = `${baseUrl}/api/woo/plugin/download`;

    const response = {
      ...PLUGIN_INFO,
      download_url: downloadUrl,
      last_updated: new Date().toISOString().split('T')[0],
      downloaded: 1000, // Placeholder download count
    };

    res.json(response);
  } catch (error) {
    console.error('[Plugin Update Check Error]', error);
    res.status(500).json({ error: 'Failed to fetch update info' });
  }
});

/**
 * GET /api/woo/plugin/download
 * Returns the latest plugin ZIP file
 */
router.get('/download', async (req: Request, res: Response) => {
  try {
    // The plugin ZIP should be pre-built and stored somewhere accessible
    // Options:
    // 1. Build and store in a cloud storage (S3, Azure Blob, etc.)
    // 2. Serve from local filesystem during development
    // 3. GitHub releases URL

    // For now, we'll check if a local ZIP exists or redirect to GitHub
    const pluginZipPath = path.join(
      __dirname,
      '../../../../public/downloads/kova-agent.zip'
    );

    if (fs.existsSync(pluginZipPath)) {
      // Serve local ZIP file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="kova-agent-${PLUGIN_INFO.version}.zip"`
      );
      res.sendFile(pluginZipPath);
    } else {
      // Redirect to GitHub releases or return error
      // You can configure PLUGIN_DOWNLOAD_URL in environment
      const downloadUrl = process.env.PLUGIN_DOWNLOAD_URL;

      if (downloadUrl) {
        res.redirect(downloadUrl);
      } else {
        res.status(404).json({
          error: 'Plugin download not available',
          message:
            'Please download the plugin from the Kova Agent admin panel or contact support.',
        });
      }
    }
  } catch (error) {
    console.error('[Plugin Download Error]', error);
    res.status(500).json({ error: 'Failed to serve plugin download' });
  }
});

/**
 * GET /api/woo/plugin/version
 * Simple endpoint to check current version
 */
router.get('/version', (req: Request, res: Response) => {
  res.json({
    version: PLUGIN_INFO.version,
    slug: PLUGIN_INFO.slug,
    name: PLUGIN_INFO.name,
  });
});

export default router;
