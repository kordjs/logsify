import express from 'express';
import session from 'express-session';
import passport from 'passport';
import nunjucks from 'nunjucks';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { connectDB } from './config/database';
import { configurePassport } from './config/passport';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import dashboardRoutes from './routes/dashboard';
import { createWebSocketServer } from './utils/websocket';

// Load environment variables
dotenv.config();

// Enhanced logging utilities
class Logger {
        private static formatMessage(level: string, message: string, meta?: any): string {
                const timestamp = new Date().toISOString();
                const emoji =
                        {
                                info: '📄',
                                success: '✅',
                                warning: '⚠️',
                                error: '🚨',
                                debug: '🔍',
                                server: '🚀',
                                auth: '🔐',
                                db: '🗄️',
                                api: '📡'
                        }[level] || '📝';

                let logMessage = `${emoji} [${timestamp}] [${level.toUpperCase()}] ${message}`;

                if (meta) {
                        logMessage += `\n   📋 Meta: ${JSON.stringify(meta, null, 2)}`;
                }

                return logMessage;
        }

        static info(message: string, meta?: any) {
                console.log(this.formatMessage('info', message, meta));
        }

        static success(message: string, meta?: any) {
                console.log(this.formatMessage('success', message, meta));
        }

        static warning(message: string, meta?: any) {
                console.warn(this.formatMessage('warning', message, meta));
        }

        static error(message: string, error?: any, meta?: any) {
                const errorMeta = {
                        ...meta,
                        ...(error && {
                                error: error.message || error,
                                stack: error.stack
                        })
                };
                console.error(this.formatMessage('error', message, errorMeta));
        }

        static debug(message: string, meta?: any) {
                if (process.env['NODE_ENV'] === 'development') {
                        console.log(this.formatMessage('debug', message, meta));
                }
        }

        static server(message: string, meta?: any) {
                console.log(this.formatMessage('server', message, meta));
        }

        static auth(message: string, meta?: any) {
                console.log(this.formatMessage('auth', message, meta));
        }

        static db(message: string, meta?: any) {
                console.log(this.formatMessage('db', message, meta));
        }

        static api(message: string, meta?: any) {
                console.log(this.formatMessage('api', message, meta));
        }
}

const app = express();
const PORT = process.env['PORT'] || 3000;

Logger.server('Initializing Logsify Server...', {
        port: PORT,
        env: process.env['NODE_ENV'],
        nodeVersion: process.version
});

// Connect to MongoDB
connectDB();

// Configure Nunjucks
Logger.server('Configuring Nunjucks template engine...');
const njk = nunjucks.configure('src/views', {
        autoescape: true,
        express: app,
        watch: process.env['NODE_ENV'] === 'development'
});

njk.addFilter('typeof', (obj) => typeof obj)
        .addFilter('max', (arr) => {
                if (!Array.isArray(arr)) return null;
                return Math.max(...arr);
        })
        .addFilter('min', (arr) => {
                if (!Array.isArray(arr)) return null;
                return Math.min(...arr);
        })
        .addFilter('safeStartsWith', (str, prefix) => {
                return typeof str === 'string' && str.startsWith(prefix);
        });

Logger.success('Nunjucks configured successfully');

// Security middleware
Logger.server('Applying security middleware...');
app.use(
        helmet({
                contentSecurityPolicy: {
                        directives: {
                                defaultSrc: ["'self'"],
                                styleSrc: [
                                        "'self'",
                                        "'unsafe-inline'",
                                        'https://cdnjs.cloudflare.com',
                                        'https://cdn.jsdelivr.net'
                                ],
                                scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
                                scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers for theme switching
                                imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
                                connectSrc: ["'self'"],
                                fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
                                objectSrc: ["'none'"],
                                mediaSrc: ["'self'"],
                                frameSrc: ["'none'"]
                        }
                }
        })
);

// CORS middleware
app.use(cors());

// Enhanced logging middleware with custom format
const morganFormat =
        process.env['NODE_ENV'] === 'development'
                ? ':method :url :status :res[content-length] - :response-time ms'
                : 'combined';

app.use(
        morgan(morganFormat, {
                stream: {
                        write: (message: string) => {
                                const cleanMessage = message.trim();
                                if (
                                        cleanMessage.includes(' 200 ') ||
                                        cleanMessage.includes(' 304 ')
                                ) {
                                        Logger.api(`HTTP Request: ${cleanMessage}`);
                                } else if (
                                        cleanMessage.includes(' 4') ||
                                        cleanMessage.includes(' 5')
                                ) {
                                        Logger.warning(`HTTP Request: ${cleanMessage}`);
                                } else {
                                        Logger.info(`HTTP Request: ${cleanMessage}`);
                                }
                        }
                }
        })
);

// Add request context and user preferences to all templates
app.use(async (req, res, next) => {
        res.locals.currentPath = String(req.path || '');
        res.locals.currentUrl = req.url;

        // If user is authenticated, load their preferences
        if (req.user) {
                const user = req.user as any;
                res.locals.userPreferences = user.preferences || {
                        theme: 'dark',
                        autoRefresh: false,
                        defaultLogLevel: 'all',
                        defaultNamespace: 'all',
                        logsPerPage: 50,
                        timezone: 'UTC'
                };
        } else {
                // Default preferences for non-authenticated users
                res.locals.userPreferences = {
                        theme: 'dark',
                        autoRefresh: false,
                        defaultLogLevel: 'all',
                        defaultNamespace: 'all',
                        logsPerPage: 50,
                        timezone: 'UTC'
                };
        }

        next();
});

Logger.server('Setting up middleware stack...');

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware - Enhanced for better persistence
Logger.server('Configuring session management...');
app.use(
        session({
                secret: process.env['SESSION_SECRET'] || 'your-secret-key',
                name: 'logsify.sid', // Custom session name
                resave: false,
                saveUninitialized: false,
                rolling: true, // Reset expiration on each request
                cookie: {
                        secure: process.env['NODE_ENV'] === 'production',
                        httpOnly: true,
                        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                        sameSite: 'lax'
                }
        }) as any
);

// Passport middleware
Logger.server('Initializing authentication...');
configurePassport();
app.use(passport.initialize() as any);
app.use(passport.session() as any);

// Static files
Logger.server('Setting up static file serving...');
app.use(express.static(path.join(__dirname, '../public')));

// Routes
Logger.server('Registering application routes...');
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/dashboard', dashboardRoutes);

// Home route
app.get('/', (req, res) => {
        Logger.debug('Home route accessed', {
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                authenticated: req.isAuthenticated()
        });

        res.render('index.njk', {
                title: 'Logsify - Modern Logging Dashboard',
                user: req.user
        });
});

// Enhanced error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const errorDetails = {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString(),
                userId: req.user ? (req.user as any)._id : 'anonymous',
                error: {
                        message: err.message,
                        stack: err.stack,
                        name: err.name
                }
        };

        Logger.error('Unhandled application error occurred', err, errorDetails);

        res.status(err.status || 500).render('error.njk', {
                title: 'Error',
                message:
                        process.env['NODE_ENV'] === 'development'
                                ? err.message
                                : 'Something went wrong!',
                currentPath: req.path
        });
});

// Enhanced 404 handler
app.use((req: express.Request, res: express.Response) => {
        Logger.warning('404 - Page not found', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                referer: req.get('Referer')
        });

        res.status(404).render('404.njk', {
                title: '404 - Page Not Found',
                currentPath: req.path
        });
});

// Create HTTP server and add WebSocket support
const httpServer = createServer(app);

// Initialize WebSocket server
createWebSocketServer(httpServer);

// Start the HTTP server
httpServer.listen(PORT, () => {
        Logger.server('🚀 ================================');
        Logger.server('🚀 Logsify Server Started!');
        Logger.server('🚀 ================================');
        Logger.success(`HTTP Server running on http://localhost:${PORT}`, {
                port: PORT,
                environment: process.env['NODE_ENV'],
                database: 'MongoDB Atlas',
                auth: 'GitHub OAuth',
                ui: 'Nunjucks + TailwindCSS + DaisyUI',
                features: [
                        'Theme Switching',
                        'Enhanced Logging',
                        'Modal Metadata Viewer',
                        'WebSocket API'
                ]
        });
        Logger.success(`WebSocket Server available at ws://localhost:${PORT}/ws`, {
                authentication: 'Token-based (?token=logs_xxxxx)',
                format: 'JSON Array of logs'
        });
        Logger.server('🚀 ================================');
});

export default app;
