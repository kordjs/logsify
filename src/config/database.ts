import mongoose from 'mongoose';

// Enhanced logging utilities (simplified version for config file)
const dbLogger = {
        info: (msg: string, meta?: any) => console.log(`🗄️ [DB] ${msg}`, meta ? JSON.stringify(meta) : ''),
        success: (msg: string, meta?: any) => console.log(`✅ [DB] ${msg}`, meta ? JSON.stringify(meta) : ''),
        error: (msg: string, error?: any) => console.error(`🚨 [DB] ${msg}`, error ? error.message || error : ''),
        warning: (msg: string, meta?: any) => console.warn(`⚠️ [DB] ${msg}`, meta ? JSON.stringify(meta) : '')
};

export const connectDB = async (): Promise<void> => {
        try {
                const mongoURI = process.env['MONGODB_URI'];

                if (!mongoURI) {
                        dbLogger.error('MONGODB_URI is not defined in environment variables');
                        throw new Error('MONGODB_URI is not defined in environment variables');
                }

                dbLogger.info('Connecting to MongoDB...', { 
                        uri: mongoURI.replace(/\/\/.*:.*@/, '//***:***@'), // Hide credentials in logs
                        options: { serverSelectionTimeoutMS: 5000 }
                });
                
                await mongoose.connect(mongoURI, {
                        serverSelectionTimeoutMS: 5000, // 5 second timeout
                        maxPoolSize: 10, // Maintain up to 10 socket connections
                        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                        bufferCommands: false // Disable mongoose buffering
                });
                
                dbLogger.success('MongoDB connected successfully', {
                        host: mongoose.connection.host,
                        port: mongoose.connection.port,
                        database: mongoose.connection.name,
                        readyState: mongoose.connection.readyState
                });
        } catch (error: any) {
                dbLogger.error('MongoDB connection failed', error);
                process.exit(1);
        }
};

// Handle connection events with enhanced logging
mongoose.connection.on('connected', () => {
        dbLogger.success('Mongoose connected to MongoDB Atlas', {
                connectionState: 'connected',
                host: mongoose.connection.host
        });
});

mongoose.connection.on('error', (err) => {
        dbLogger.error('Mongoose connection error', err);
});

mongoose.connection.on('disconnected', () => {
        dbLogger.warning('Mongoose disconnected from MongoDB', {
                connectionState: 'disconnected',
                timestamp: new Date().toISOString()
        });
});

mongoose.connection.on('reconnected', () => {
        dbLogger.success('Mongoose reconnected to MongoDB', {
                connectionState: 'reconnected',
                timestamp: new Date().toISOString()
        });
});

// Handle graceful shutdown with enhanced logging
const gracefulShutdown = async (signal: string) => {
        try {
                dbLogger.info(`Graceful shutdown initiated by ${signal}...`, {
                        signal,
                        timestamp: new Date().toISOString()
                });
                
                await mongoose.connection.close();
                dbLogger.success('MongoDB connection closed through app termination', {
                        signal,
                        timestamp: new Date().toISOString()
                });
                process.exit(0);
        } catch (error) {
                dbLogger.error('Error during graceful shutdown', error);
                process.exit(1);
        }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
