import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import { ApiToken } from '../models/ApiToken';
import { Log } from '../models/Log';

// Logger utility for WebSocket operations
const wsLogger = {
        info: (msg: string, meta?: any) =>
                console.log(`🔌 [WS] ${msg}`, meta ? JSON.stringify(meta) : ''),
        success: (msg: string, meta?: any) =>
                console.log(`✅ [WS] ${msg}`, meta ? JSON.stringify(meta) : ''),
        error: (msg: string, error?: any) =>
                console.error(`🚨 [WS] ${msg}`, error ? error.message || error : ''),
        warning: (msg: string, meta?: any) =>
                console.warn(`⚠️ [WS] ${msg}`, meta ? JSON.stringify(meta) : '')
};

// Validate log entry structure
function validateLogEntry(log: any): boolean {
        if (!log || typeof log !== 'object') return false;

        // Required fields
        if (!log.message || typeof log.message !== 'string') return false;

        // Optional but validated fields
        if (log.level && !['debug', 'info', 'warn', 'error', 'fatal'].includes(log.level))
                return false;
        if (log.namespace && typeof log.namespace !== 'string') return false;
        if (log.metadata && typeof log.metadata !== 'object') return false;
        if (log.timestamp && isNaN(Date.parse(log.timestamp))) return false;

        return true;
}

// Persist logs to database
async function persistLogs(logs: any[], userId: string, tokenId: string): Promise<number> {
        try {
                const validLogs = logs.filter(validateLogEntry);

                if (validLogs.length === 0) {
                        throw new Error('No valid logs to persist');
                }

                // Create log entries in database
                const logEntries = validLogs.map((log) => ({
                        userId,
                        tokenId,
                        level: log.level || 'info',
                        namespace: log.namespace || 'default',
                        message: log.message,
                        metadata: log.metadata || {},
                        timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
                }));

                await Log.insertMany(logEntries);

                wsLogger.success(`Persisted ${validLogs.length} logs to database`, {
                        userId,
                        tokenId,
                        logsCount: validLogs.length
                });

                return validLogs.length;
        } catch (error) {
                wsLogger.error('Failed to persist logs', error);
                throw error;
        }
}

// Authenticate WebSocket connection using token query parameter
async function authenticateWebSocket(token: string): Promise<{ user: any; apiToken: any } | null> {
        try {
                if (!token || !token.startsWith('logs_')) {
                        return null;
                }

                const apiToken = await ApiToken.findOne({ token, isActive: true }).populate(
                        'userId'
                );

                if (!apiToken) {
                        return null;
                }

                return {
                        user: apiToken.userId,
                        apiToken
                };
        } catch (error) {
                wsLogger.error('Authentication failed', error);
                return null;
        }
}

// Create and configure WebSocket server
export function createWebSocketServer(httpServer: Server): void {
        const wss = new WebSocketServer({
                server: httpServer,
                path: '/ws'
        });

        wsLogger.info('WebSocket server created on path /ws');

        wss.on('connection', async (ws, req) => {
                const { query } = parse(req.url!, true);
                const token = query.token as string;

                wsLogger.info('WebSocket connection attempt', {
                        origin: req.headers.origin,
                        userAgent: req.headers['user-agent'],
                        hasToken: !!token
                });

                // Authenticate the connection
                const auth = await authenticateWebSocket(token);

                if (!auth) {
                        wsLogger.warning('WebSocket authentication failed', {
                                token: token ? 'provided' : 'missing'
                        });
                        ws.close(4001, 'Invalid token');
                        return;
                }

                const { user, apiToken } = auth;

                wsLogger.success('WebSocket connection authenticated', {
                        userId: user._id,
                        username: user.username,
                        tokenLabel: apiToken.label
                });

                // Handle incoming messages
                ws.on('message', async (data) => {
                        try {
                                let logs;

                                // Parse incoming message
                                try {
                                        logs = JSON.parse(data.toString());
                                } catch (parseError) {
                                        wsLogger.error('Invalid JSON received', parseError);
                                        ws.send(JSON.stringify({ error: 'Invalid JSON format' }));
                                        return;
                                }

                                // Validate that logs is an array
                                if (!Array.isArray(logs)) {
                                        wsLogger.error('Logs must be an array', {
                                                receivedType: typeof logs
                                        });
                                        ws.send(
                                                JSON.stringify({
                                                        error: 'Invalid log format - expected array'
                                                })
                                        );
                                        return;
                                }

                                // Validate log entries
                                const invalidLogs = logs.filter((log) => !validateLogEntry(log));
                                if (invalidLogs.length > 0) {
                                        wsLogger.error('Invalid log entries received', {
                                                invalidCount: invalidLogs.length,
                                                totalCount: logs.length
                                        });
                                        ws.send(JSON.stringify({ error: 'Invalid log format' }));
                                        return;
                                }

                                // Persist logs to database
                                const count = await persistLogs(logs, user._id, apiToken._id);

                                // Send success response
                                ws.send(
                                        JSON.stringify({
                                                status: 'ok',
                                                count
                                        })
                                );

                                wsLogger.success('Successfully processed WebSocket logs', {
                                        userId: user._id,
                                        count,
                                        tokenLabel: apiToken.label
                                });
                        } catch (error) {
                                wsLogger.error('Error processing WebSocket message', error);
                                ws.send(JSON.stringify({ error: 'Failed to process logs' }));
                        }
                });

                // Handle connection close
                ws.on('close', (code, reason) => {
                        wsLogger.info('WebSocket connection closed', {
                                userId: user._id,
                                code,
                                reason: reason.toString()
                        });
                });

                // Handle errors
                ws.on('error', (error) => {
                        wsLogger.error('WebSocket error', error);
                });

                // Send initial connection confirmation
                ws.send(
                        JSON.stringify({
                                status: 'connected',
                                message: 'WebSocket connection established',
                                user: user.username
                        })
                );
        });

        // Handle WebSocket server errors
        wss.on('error', (error) => {
                wsLogger.error('WebSocket server error', error);
        });

        wsLogger.success('WebSocket server configured and listening for connections');
}
