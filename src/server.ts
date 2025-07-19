import express from 'express';
import session from 'express-session';
import passport from 'passport';
import nunjucks from 'nunjucks';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { connectDB } from './config/database';
import { configurePassport } from './config/passport';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import dashboardRoutes from './routes/dashboard';

// Load environment variables
dotenv.config();

// Enhanced logging utilities
class Logger {
        private static formatMessage(level: string, message: string, meta?: any): string {
                const timestamp = new Date().toISOString();
                const emoji = {
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

// Security middleware
app.use(
        helmet({
                contentSecurityPolicy: {
                        directives: {
                                defaultSrc: ["'self'"],
                                styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                                scriptSrc: ["'self'", "'unsafe-inline'"],
                                imgSrc: ["'self'", 'data:', 'https:'],
                                connectSrc: ["'self'"]
                        }
                }
        })
);

// CORS middleware
app.use(cors());

// Enhanced logging middleware
app.use(morgan('combined'));

// Add request context to all templates
app.use((req, res, next) => {
        res.locals.currentPath = String(req.path || '');
        res.locals.currentUrl = req.url;
        next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(
        session({
                secret: process.env['SESSION_SECRET'] || 'your-secret-key',
                resave: false,
                saveUninitialized: false,
                cookie: {
                        secure: process.env['NODE_ENV'] === 'production',
                        maxAge: 24 * 60 * 60 * 1000 // 24 hours
                }
        }) as any
);

// Passport middleware
configurePassport();
app.use(passport.initialize() as any);
app.use(passport.session() as any);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/dashboard', dashboardRoutes);

// Home route
app.get('/', (req, res) => {
        res.render('index.njk', {
                title: 'Logsify - Modern Logging Dashboard',
                user: req.user
        });
});

// Temporary test route to access dashboard without auth for theme testing
app.get('/test-dashboard', async (req, res) => {
        try {
                const mockUser = {
                        _id: 'test-user-id',
                        name: 'Test User',
                        username: 'testuser',
                        avatar: '/images/default-avatar.png'
                };
                
                res.render('dashboard/logs.njk', {
                        title: 'Logs - Logsify',
                        user: mockUser,
                        logs: [],
                        pagination: { page: 1, limit: 50, total: 0, pages: 0, hasNext: false, hasPrev: false },
                        namespaces: ['default', 'app', 'system'],
                        currentPath: '/dashboard/logs',
                        filters: {
                                level: 'all',
                                namespace: 'all',
                                startDate: '',
                                endDate: '',
                                search: ''
                        }
                });
        } catch (error) {
                res.status(500).send('Error loading test dashboard');
        }
});

// Test route with sample logs for UI testing
app.get('/test-dashboard-with-logs', async (req, res) => {
        try {
                const mockUser = {
                        _id: 'test-user-id',
                        name: 'Test User',
                        username: 'testuser',
                        avatar: '/images/default-avatar.png'
                };
                
                // Create sample log data
                const sampleLogs = [
                        {
                                _id: '1',
                                level: 'error',
                                namespace: 'auth-service',
                                message: 'Failed to authenticate user with invalid credentials provided by client from IP 192.168.1.100',
                                metadata: {
                                        userId: 'user_12345',
                                        ip: '192.168.1.100',
                                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                        attemptCount: 3,
                                        errorCode: 'AUTH_001',
                                        timestamp: new Date().toISOString(),
                                        requestId: 'req_abc123def456',
                                        sessionId: 'sess_xyz789'
                                },
                                timestamp: new Date(Date.now() - 300000) // 5 minutes ago
                        },
                        {
                                _id: '2',
                                level: 'info',
                                namespace: 'payment-service',
                                message: 'Payment processed successfully for order #ORD-2024-001',
                                metadata: {
                                        orderId: 'ORD-2024-001',
                                        amount: 299.99,
                                        currency: 'USD',
                                        paymentMethod: 'credit_card',
                                        cardLast4: '4532',
                                        transactionId: 'txn_1234567890',
                                        processingTime: '2.3s'
                                },
                                timestamp: new Date(Date.now() - 600000) // 10 minutes ago
                        },
                        {
                                _id: '3',
                                level: 'warn',
                                namespace: 'api-gateway',
                                message: 'Rate limit exceeded for client API key',
                                metadata: {
                                        apiKey: 'ak_test_1234...5678',
                                        endpoint: '/api/v1/users',
                                        requestsCount: 1001,
                                        limitPerHour: 1000,
                                        clientId: 'client_789'
                                },
                                timestamp: new Date(Date.now() - 900000) // 15 minutes ago
                        },
                        {
                                _id: '4',
                                level: 'debug',
                                namespace: 'database',
                                message: 'Database query executed',
                                metadata: {
                                        query: 'SELECT * FROM users WHERE status = $1',
                                        params: ['active'],
                                        executionTime: '45ms',
                                        rowsReturned: 1250
                                },
                                timestamp: new Date(Date.now() - 1200000) // 20 minutes ago
                        }
                ];
                
                res.render('dashboard/logs.njk', {
                        title: 'Logs - Logsify',
                        user: mockUser,
                        logs: sampleLogs,
                        pagination: { page: 1, limit: 50, total: 4, pages: 1, hasNext: false, hasPrev: false },
                        namespaces: ['auth-service', 'payment-service', 'api-gateway', 'database'],
                        currentPath: '/dashboard/logs',
                        filters: {
                                level: 'all',
                                namespace: 'all',
                                startDate: '',
                                endDate: '',
                                search: ''
                        }
                });
        } catch (error) {
                res.status(500).send('Error loading test dashboard with logs');
        }
});

// Enhanced error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error('🚨 ERROR OCCURRED:');
        console.error('📍 Path:', req.path);
        console.error('🔍 Method:', req.method);
        console.error('💥 Error:', err.message);
        console.error('📋 Stack:', err.stack);
        console.error('🕐 Time:', new Date().toISOString());
        console.error('---');

        res.status(500).render('error.njk', {
                title: 'Error',
                message:
                        process.env['NODE_ENV'] === 'development'
                                ? err.message
                                : 'Something went wrong!',
                currentPath: req.path
        });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
        console.log('🔍 404 Not Found:', req.path);
        res.status(404).render('404.njk', {
                title: '404 - Page Not Found',
                currentPath: req.path
        });
});

app.listen(PORT, () => {
        console.log('🚀 ================================');
        console.log('🚀 Logsify Server Started!');
        console.log('🚀 ================================');
        console.log(`🌐 Server running: http://localhost:${PORT}`);
        console.log(`📝 Environment: ${process.env['NODE_ENV']}`);
        console.log(`🗄️ Database: MongoDB Atlas`);
        console.log(`🔐 Auth: GitHub OAuth`);
        console.log(`🎨 UI: Nunjucks + TailwindCSS + DaisyUI`);
        console.log('🚀 ================================');
});

export default app;
