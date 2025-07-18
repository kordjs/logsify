import express from 'express';
import { Log } from '../models/Log';
import { ApiToken } from '../models/ApiToken';

const router = express.Router();

// Middleware to ensure authentication
const requireAuth = (_req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (!_req.isAuthenticated()) {
    res.redirect('/');
    return;
  }
  next();
};

// Dashboard home - redirect to logs view
router.get('/', requireAuth, (_req, res) => {
  res.redirect('/dashboard/logs');
});

// Logs view page
router.get('/logs', requireAuth, async (req, res) => {
  try {
    const {
      level,
      namespace,
      startDate,
      endDate,
      search,
      page = '1'
    } = req.query;

    const query: any = { userId: req.user!._id };
    
    // Apply filters
    if (level && level !== 'all') query.level = level;
    if (namespace && namespace !== 'all') query.namespace = namespace;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { namespace: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limit = 50;
    const skip = (pageNum - 1) * limit;

    const [logs, total, namespaces] = await Promise.all([
      Log.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Log.countDocuments(query),
      Log.distinct('namespace', { userId: req.user!._id })
    ]);

    const pagination = {
      page: pageNum,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: pageNum < Math.ceil(total / limit),
      hasPrev: pageNum > 1
    };

    res.render('dashboard/logs.njk', {
      title: 'Logs - Logsify',
      user: req.user,
      logs,
      pagination,
      namespaces,
      currentPath: req.path,
      filters: {
        level: level || 'all',
        namespace: namespace || 'all',
        startDate: startDate || '',
        endDate: endDate || '',
        search: search || ''
      }
    });
  } catch (error) {
    console.error('🚨 Error fetching logs:', error);
    res.status(500).render('error.njk', { 
      title: 'Error',
      message: 'Failed to fetch logs',
      currentPath: req.path
    });
  }
});

// Settings page
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const tokens = await ApiToken.find({ 
      userId: req.user!._id,
      isActive: true 
    }).sort({ createdAt: -1 });

    res.render('dashboard/settings.njk', {
      title: 'Settings - Logsify',
      user: req.user,
      currentPath: req.path,
      tokens
    });
  } catch (error) {
    console.error('🚨 Error fetching tokens:', error);
    res.status(500).render('error.njk', { 
      title: 'Error',
      message: 'Failed to fetch settings',
      currentPath: req.path
    });
  }
});

export default router;