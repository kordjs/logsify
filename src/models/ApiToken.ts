import mongoose, { Schema } from 'mongoose';
import { IApiToken } from '../types';

const apiTokenSchema = new Schema<IApiToken>(
        {
                userId: {
                        type: String,
                        required: true,
                        ref: 'User',
                        index: true
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
        },
        {
                timestamps: true
        }
);

// Remove duplicate indexes
// apiTokenSchema.index({ userId: 1 }); // Removed - already indexed above
// apiTokenSchema.index({ token: 1 }); // Removed - already unique
apiTokenSchema.index({ createdAt: 1 });

export const ApiToken = mongoose.model<IApiToken>('ApiToken', apiTokenSchema);
