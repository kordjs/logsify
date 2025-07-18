import { Document } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  githubId: string;
  username: string;
  name: string;
  email: string;
  avatar: string;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApiToken extends Document {
  _id: string;
  userId: string;
  token: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILog extends Document {
  _id: string;
  userId: string;
  tokenId: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  namespace: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
}

export interface LogQuery {
  userId?: string;
  tokenId?: string;
  level?: string;
  namespace?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}