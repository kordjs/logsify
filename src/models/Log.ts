import mongoose, { Schema } from 'mongoose';
import { ILog } from '../types';

const logSchema = new Schema<ILog>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  tokenId: {
    type: String,
    required: true,
    ref: 'ApiToken'
  },
  level: {
    type: String,
    required: true,
    enum: ['debug', 'info', 'warn', 'error', 'fatal'],
    default: 'info'
  },
  namespace: {
    type: String,
    required: true,
    default: 'default'
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance and querying
logSchema.index({ userId: 1 });
logSchema.index({ tokenId: 1 });
logSchema.index({ level: 1 });
logSchema.index({ namespace: 1 });
logSchema.index({ timestamp: -1 });
logSchema.index({ createdAt: -1 });

// Compound indexes for common queries
logSchema.index({ userId: 1, level: 1 });
logSchema.index({ userId: 1, namespace: 1 });
logSchema.index({ userId: 1, timestamp: -1 });

export const Log = mongoose.model<ILog>('Log', logSchema);