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

const app = express();
const PORT = process.env['PORT'] || 3000;

// Connect to MongoDB
connectDB();

// Configure Nunjucks
nunjucks.configure('src/views', {
  autoescape: true,
  express: app,
  watch: process.env['NODE_ENV'] === 'development'
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS middleware
app.use(cors());

// Enhanced logging middleware
app.use(morgan('combined'));

// Add request context to all templates
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.currentUrl = req.url;
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env['SESSION_SECRET'] || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}) as any);

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
    message: process.env['NODE_ENV'] === 'development' ? err.message : 'Something went wrong!',
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env['NODE_ENV']}`);
});

export default app;