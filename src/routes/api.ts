import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiToken } from '../models/ApiToken';
import { Log } from '../models/Log';

const router = express.Router();

// Middleware to authenticate API requests
const authenticateApiToken = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    const apiToken = await ApiToken.findOne({ token, isActive: true }).populate('userId');
    
    if (!apiToken) {
      res.status(401).json({ error: 'Invalid or inactive API token' });
      return;
    }

    req.user = apiToken.userId as any;
    (req as any).apiToken = apiToken;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Create log entry
router.post('/logs', authenticateApiToken, async (req, res): Promise<void> => {
  try {
    const { level, namespace, message, metadata, timestamp } = req.body;
    
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const log = await Log.create({
      userId: req.user!._id,
      tokenId: (req as any).apiToken._id,
      level: level || 'info',
      namespace: namespace || 'default',
      message,
      metadata: metadata || {},
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    res.status(201).json({ 
      success: true, 
      log: {
        id: log._id,
        level: log.level,
        namespace: log.namespace,
        message: log.message,
        metadata: log.metadata,
        timestamp: log.timestamp
      }
    });
  } catch (error) {
    console.error('🚨 API Error - Log Creation:', error);
    res.status(500).json({ error: 'Failed to create log entry' });
  }
});

// Get logs with filtering and pagination
router.get('/logs', authenticateApiToken, async (req, res): Promise<void> => {
  try {
    const {
      level,
      namespace,
      startDate,
      endDate,
      search,
      page = '1',
      limit = '50'
    } = req.query;

    const query: any = { userId: req.user!._id };

    // Apply filters
    if (level) query.level = level;
    if (namespace) query.namespace = namespace;
    
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
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      Log.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Log.countDocuments(query)
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('🚨 API Error - Log Fetching:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Create API token (requires session authentication)
router.post('/tokens', async (req, res): Promise<void> => {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { label } = req.body;
    
    if (!label) {
      res.status(400).json({ error: 'Label is required' });
      return;
    }

    // Check for rate limiting (max 1 token per minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentToken = await ApiToken.findOne({
      userId: req.user!._id,
      createdAt: { $gte: oneMinuteAgo }
    });

    if (recentToken) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait before creating another token.' });
      return;
    }

    const token = `logs_${uuidv4().replace(/-/g, '')}`;
    
    const apiToken = await ApiToken.create({
      userId: req.user!._id,
      token,
      label
    });

    res.status(201).json({
      success: true,
      token: apiToken.token,
      label: apiToken.label,
      id: apiToken._id
    });
  } catch (error) {
    console.error('Error creating API token:', error);
    res.status(500).json({ error: 'Failed to create API token' });
  }
});

// Get user's API tokens
router.get('/tokens', async (req, res): Promise<void> => {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const tokens = await ApiToken.find({ 
      userId: req.user!._id,
      isActive: true 
    }).sort({ createdAt: -1 });

    res.json({
      tokens: tokens.map(token => ({
        id: token._id,
        label: token.label,
        createdAt: token.createdAt,
        // Don't return the actual token for security
      }))
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Delete API token
router.delete('/tokens/:id', async (req, res): Promise<void> => {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    
    const token = await ApiToken.findOneAndUpdate(
      { _id: id, userId: req.user!._id },
      { isActive: false },
      { new: true }
    );

    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting token:', error);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

export default router;