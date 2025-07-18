import mongoose, { Schema } from 'mongoose';
import { IApiToken } from '../types';

const apiTokenSchema = new Schema<IApiToken>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  label: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
apiTokenSchema.index({ userId: 1 });
apiTokenSchema.index({ token: 1 });
apiTokenSchema.index({ createdAt: 1 });

export const ApiToken = mongoose.model<IApiToken>('ApiToken', apiTokenSchema);