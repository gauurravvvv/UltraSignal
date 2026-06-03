// Library imports
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createServer, Server as HttpServer } from 'http';
import morgan from 'morgan';
import { CODE, FE_URL } from '../config/config';
import authRoutes from './modules/auth/auth.routes';
import groupRoutes from './modules/groups/groups.routes';
import homeRoutes from './modules/home/home.routes';
import orgRoutes from './modules/orgs/orgs.routes';
import profileRoutes from './modules/profile/profile.routes';
import roleRoutes from './modules/roles/roles.routes';
import systemAdminRoutes from './modules/system-admins/system-admins.routes';
import userRoutes from './modules/users/users.routes';
import { GENERIC } from './shared/constants/response.messages';
import Database from './shared/db';
import LocaleMiddleware from './shared/middleware/locale.middleware';
import RequestContextMiddleware from './shared/middleware/requestContext.middleware';
import SanitizeOrgInputMiddleware from './shared/middleware/sanitizeOrgInput.middleware';
import TrimMiddleware from './shared/middleware/trimBody.middleware';
import { SUPPORTED_LOCALES, t } from './shared/utility/i18n';
import sendResponse from './shared/utility/response';

// Rate limiter for auth routes — max 20 attempts per 15 minutes per IP
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: false,
    code: 429,
    message: 'Too many requests, please try again later.',
  },
});

class Server {
  private app: express.Application;
  private httpServer: HttpServer;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.config();
    this.routerConfig();
  }

  // Configuration
  private config() {
    // Request context (id + start time) goes FIRST so even rejections
    // from helmet / cors / rate-limiter / auth carry the meta block.
    this.app.use(RequestContextMiddleware);
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(
      morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'),
    );
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(
      cors({
        origin: FE_URL,
        credentials: true,
      }),
    );
    this.app.use(LocaleMiddleware);
    this.app.use(TrimMiddleware);
  }

  // Routes
  private routerConfig() {
    // Health check — for PM2, load balancers, uptime monitors
    this.app.get('/health', (req, res) => {
      const locale: string = res.locals.locale;
      res.status(200).json({
        status: 'ok',
        message: t('health.ok', locale),
        uptime: process.uptime(),
        timestamp: Date.now(),
        locale,
        supported_locales: SUPPORTED_LOCALES,
      });
    });

    // All mounts use plural resource names (REST convention). Singletons —
    // /auth, /home, /profile, /search — stay singular because they don't
    // represent a collection. See ROUTING.md.
    this.app.use('/api/v1/auth', authRateLimiter, authRoutes);

    // Sanitize FE-supplied org keys on every protected route below.
    // Auth routes are mounted ABOVE this line so their pre-JWT
    // `organisation` body field is preserved. See
    // sanitizeOrgInput.middleware.ts for the rationale.
    this.app.use(SanitizeOrgInputMiddleware);

    this.app.use('/api/v1/system-admins', systemAdminRoutes);
    this.app.use('/api/v1/orgs', orgRoutes);
    this.app.use('/api/v1/users', userRoutes);
    this.app.use('/api/v1/home', homeRoutes);
    this.app.use('/api/v1/groups', groupRoutes);
    this.app.use('/api/v1/profile', profileRoutes);
    this.app.use('/api/v1/roles', roleRoutes);

    // Catch-all for unmatched routes
    this.app.all('*', (req, res) => {
      sendResponse(res, false, CODE.NOT_FOUND, GENERIC.ROUTE_NOT_FOUND);
    });
  }

  public connectDatabase = async (): Promise<void> => {
    const db = new Database();
    await db.connect();
  };

  public start = (port: number) => {
    return new Promise((resolve, reject) => {
      this.httpServer
        .listen(port, () => {
          resolve(port);
        })
        .on('error', (err: object) => reject(err));
    });
  };

  /**
   * Expose the underlying http.Server so the graceful-shutdown installer
   * can call .close() / .closeIdleConnections() / .closeAllConnections()
   * during SIGTERM. Read-only — callers must not start/stop it directly;
   * that's owned by start() and the shutdown sequence.
   */
  public getHttpServer = (): HttpServer => this.httpServer;
}
export default Server;
