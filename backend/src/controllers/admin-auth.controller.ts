import { Router, Request, Response, NextFunction } from 'express';
import { SupabaseService } from '@/services/supabase.service';
import { logger } from '@/utils/logger';
import { AppError } from '@/types';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();
const supabaseService = new SupabaseService();

const JWT_SECRET =
  process.env.JWT_SECRET || 'kova-admin-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Helper to hash passwords
function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + JWT_SECRET)
    .digest('hex');
}

// Helper to verify password
function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Helper to resolve the real tenant plan from the tenants table
async function resolveRealPlan(user: any): Promise<string> {
  if (!user.shop_domain) return user.plan || 'free';
  try {
    const { data: tenant } = await (supabaseService as any).serviceClient
      .from('tenants')
      .select('plan')
      .eq('shop_domain', user.shop_domain)
      .single();
    if (tenant?.plan) return tenant.plan;
  } catch {
    // Fall through to default
  }
  return user.plan || 'free';
}

// Helper to generate JWT
function generateToken(user: any): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      userType: user.user_type || 'admin',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * POST /api/auth/register
 * Register a new admin user
 */
router.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, email, password, company, plan, userType } =
        req.body;

      if (!firstName || !lastName || !email || !password) {
        throw new AppError('Todos los campos son requeridos', 400);
      }

      // Validate userType if provided
      const validUserTypes = ['admin', 'client'];
      const finalUserType = validUserTypes.includes(userType)
        ? userType
        : 'client';

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError('Email invalido', 400);
      }

      // Validate password
      if (password.length < 8) {
        throw new AppError(
          'La contrasena debe tener al menos 8 caracteres',
          400
        );
      }

      logger.info('Registering new admin user', { email });

      // Check if user already exists
      const { data: existingUser } = await (
        supabaseService as any
      ).serviceClient
        .from('admin_users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        throw new AppError('Ya existe una cuenta con este email', 409);
      }

      // Create user
      const hashedPassword = hashPassword(password);
      const { data: user, error } = await (supabaseService as any).serviceClient
        .from('admin_users')
        .insert({
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          company: company || null,
          role: finalUserType === 'admin' ? 'admin' : 'viewer',
          plan: plan || 'starter',
          status: 'active',
          user_type: finalUserType,
          onboarding_completed: finalUserType === 'admin',
          onboarding_step: finalUserType === 'client' ? 0 : 4,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating admin user:', error);
        throw new AppError('Error al crear la cuenta', 500);
      }

      // Generate token
      const token = generateToken(user);

      // Resolve real plan from tenants table
      const realPlan = await resolveRealPlan(user);

      logger.info('Admin user registered successfully', {
        userId: user.id,
        email,
      });

      res.status(201).json({
        success: true,
        message: 'Cuenta creada exitosamente',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          company: user.company,
          role: user.role,
          plan: realPlan,
          userType: user.user_type,
          onboardingCompleted: user.onboarding_completed,
          onboardingStep: user.onboarding_step,
        },
      });
    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Login admin user
 */
router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email y contrasena son requeridos', 400);
      }

      logger.info('Login attempt', { email });

      // Find user
      const { data: user, error } = await (supabaseService as any).serviceClient
        .from('admin_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !user) {
        throw new AppError('Credenciales invalidas', 401);
      }

      // Verify password
      if (!verifyPassword(password, user.password_hash)) {
        throw new AppError('Credenciales invalidas', 401);
      }

      // Check if user is active
      if (user.status !== 'active') {
        throw new AppError('Tu cuenta esta suspendida. Contacta soporte.', 403);
      }

      // Update last login
      await (supabaseService as any).serviceClient
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      // Generate token
      const token = generateToken(user);

      // Resolve real plan from tenants table
      const realPlan = await resolveRealPlan(user);

      logger.info('Login successful', { userId: user.id, email });

      res.json({
        success: true,
        message: 'Login exitoso',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          company: user.company,
          role: user.role,
          plan: realPlan,
          userType: user.user_type || 'admin',
          onboardingCompleted: user.onboarding_completed ?? true,
          onboardingStep: user.onboarding_step ?? 4,
        },
      });
    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token no proporcionado', 401);
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Get fresh user data
      const { data: user, error } = await (supabaseService as any).serviceClient
        .from('admin_users')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        throw new AppError('Usuario no encontrado', 404);
      }

      // Resolve real plan from tenants table
      const realPlan = await resolveRealPlan(user);

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          company: user.company,
          role: user.role,
          plan: realPlan,
          status: user.status,
          userType: user.user_type || 'admin',
          onboardingCompleted: user.onboarding_completed ?? true,
          onboardingStep: user.onboarding_step ?? 4,
        },
      });
    } catch (jwtError) {
      throw new AppError('Token invalido o expirado', 401);
    }
  } catch (error) {
    logger.error('Get user error:', error);
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, just acknowledge)
 */
router.post('/logout', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logout exitoso',
  });
});

/**
 * PUT /api/auth/password
 * Change password
 */
router.put(
  '/password',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const { currentPassword, newPassword } = req.body;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Token no proporcionado', 401);
      }

      if (!currentPassword || !newPassword) {
        throw new AppError('Contrasenas requeridas', 400);
      }

      if (newPassword.length < 8) {
        throw new AppError(
          'La nueva contrasena debe tener al menos 8 caracteres',
          400
        );
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // Get user
      const { data: user, error } = await (supabaseService as any).serviceClient
        .from('admin_users')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        throw new AppError('Usuario no encontrado', 404);
      }

      // Verify current password
      if (!verifyPassword(currentPassword, user.password_hash)) {
        throw new AppError('Contrasena actual incorrecta', 401);
      }

      // Update password
      const newHashedPassword = hashPassword(newPassword);
      await (supabaseService as any).serviceClient
        .from('admin_users')
        .update({
          password_hash: newHashedPassword,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      logger.info('Password changed', { userId: user.id });

      res.json({
        success: true,
        message: 'Contrasena actualizada exitosamente',
      });
    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }
);

export default router;
