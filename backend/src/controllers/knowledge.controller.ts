import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { SupabaseService } from '@/services/supabase.service';
import { knowledgeService } from '@/services/knowledge.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import jwt from 'jsonwebtoken';

const router = Router();
const supabaseService = new SupabaseService();

const JWT_SECRET =
  process.env.JWT_SECRET || 'kova-admin-secret-key-change-in-production';

// Multer config: memory storage, 10MB limit, PDF/TXT/MD only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(txt|md|pdf)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt, .md and .pdf files are allowed'));
    }
  },
});

// Auth middleware (same as client.controller.ts)
async function requireClientAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token no proporcionado', 401);
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const { data: user, error } = await (supabaseService as any).serviceClient
      .from('admin_users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) throw new AppError('Usuario no encontrado', 404);
    if (user.status !== 'active') throw new AppError('Cuenta suspendida', 403);

    (req as any).user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Token invalido', 401));
    } else {
      next(error);
    }
  }
}

// Helper: get shop_domain from authenticated user
async function getShopDomain(req: Request): Promise<string> {
  const user = (req as any).user;
  const { data: stores } = await (supabaseService as any).serviceClient
    .from('client_stores')
    .select('shop_domain')
    .eq('user_id', user.id)
    .limit(1);

  if (!stores?.[0]?.shop_domain) {
    throw new AppError('Tienda no encontrada', 404);
  }
  return stores[0].shop_domain;
}

/**
 * GET /api/client/knowledge
 * List all knowledge documents for the tenant
 */
router.get(
  '/',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = await getShopDomain(req);
      const documents = await knowledgeService.listDocuments(shopDomain);

      res.json({ success: true, data: documents });
    } catch (error) {
      logger.error('List knowledge documents error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/client/knowledge
 * Create a document from text input
 */
router.post(
  '/',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = await getShopDomain(req);
      const { title, content } = req.body;

      if (!title || !content) {
        throw new AppError('Title and content are required', 400);
      }

      const document = await knowledgeService.createDocument(shopDomain, {
        title,
        content,
        sourceType: 'text',
      });

      res.status(201).json({ success: true, data: document });
    } catch (error) {
      logger.error('Create knowledge document error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/client/knowledge/upload
 * Upload a file (PDF/TXT/MD)
 */
router.post(
  '/upload',
  requireClientAuth,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = await getShopDomain(req);
      const file = req.file;

      if (!file) {
        throw new AppError('File is required', 400);
      }

      const title = req.body.title || file.originalname;
      let content: string;

      // Extract text based on file type
      if (
        file.mimetype === 'application/pdf' ||
        file.originalname.endsWith('.pdf')
      ) {
        const pdfData = await pdfParse(file.buffer);
        content = pdfData.text;
      } else {
        content = file.buffer.toString('utf-8');
      }

      if (!content.trim()) {
        throw new AppError('File contains no extractable text', 400);
      }

      const document = await knowledgeService.createDocument(shopDomain, {
        title,
        content,
        sourceType: 'file',
        originalFilename: file.originalname,
      });

      res.status(201).json({ success: true, data: document });
    } catch (error) {
      logger.error('Upload knowledge document error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/knowledge/:documentId
 * Get a single document
 */
router.get(
  '/:documentId',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = await getShopDomain(req);
      const document = await knowledgeService.getDocument(
        req.params.documentId,
        shopDomain
      );

      if (!document) {
        throw new AppError('Documento no encontrado', 404);
      }

      res.json({ success: true, data: document });
    } catch (error) {
      logger.error('Get knowledge document error:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/client/knowledge/:documentId
 * Delete a document and its chunks
 */
router.delete(
  '/:documentId',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = await getShopDomain(req);
      await knowledgeService.deleteDocument(req.params.documentId, shopDomain);

      res.json({ success: true });
    } catch (error) {
      logger.error('Delete knowledge document error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/client/knowledge/:documentId/status
 * Get document processing status
 */
router.get(
  '/:documentId/status',
  requireClientAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = await getShopDomain(req);
      const status = await knowledgeService.getDocumentStatus(
        req.params.documentId,
        shopDomain
      );

      if (!status) {
        throw new AppError('Documento no encontrado', 404);
      }

      res.json({ success: true, data: status });
    } catch (error) {
      logger.error('Get knowledge document status error:', error);
      next(error);
    }
  }
);

export default router;
