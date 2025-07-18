import mongoose, { Schema } from 'mongoose';
import { IUser } from '../types';

const userSchema = new Schema<IUser>({
  githubId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false,
    index: true
  },
  avatar: {
    type: String,
    required: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Remove duplicate indexes - unique: true already creates an index
// userSchema.index({ githubId: 1 }); // Removed - already unique
// userSchema.index({ email: 1 }); // Removed - already indexed above

export const User = mongoose.model<IUser>('User', userSchema);