import mongoose, { Schema } from 'mongoose';
import { IUser, IUserPreferences } from '../types';

const userPreferencesSchema = new Schema<IUserPreferences>(
        {
                theme: {
                        type: String,
                        enum: [
                                'light',
                                'dark',
                                'cupcake',
                                'synthwave',
                                'retro',
                                'cyberpunk',
                                'bumblebee',
                                'emerald',
                                'corporate',
                                'valentine',
                                'halloween',
                                'garden',
                                'forest',
                                'aqua',
                                'lofi',
                                'pastel',
                                'fantasy',
                                'wireframe',
                                'black',
                                'luxury',
                                'dracula',
                                'cmyk',
                                'autumn',
                                'business',
                                'acid',
                                'lemonade',
                                'night',
                                'coffee',
                                'winter',
                                'dim',
                                'nord',
                                'sunset'
                        ],
                        default: 'dark'
                },
                autoRefresh: {
                        type: Boolean,
                        default: false
                },
                defaultLogLevel: {
                        type: String,
                        enum: ['all', 'debug', 'info', 'warn', 'error', 'fatal'],
                        default: 'all'
                },
                defaultNamespace: {
                        type: String,
                        default: 'all'
                },
                logsPerPage: {
                        type: Number,
                        default: 50,
                        min: 10,
                        max: 200
                },
                timezone: {
                        type: String,
                        default: 'UTC'
                }
        },
        { _id: false }
);

const userSchema = new Schema<IUser>(
        {
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
                },
                preferences: {
                        type: userPreferencesSchema,
                        default: () => ({
                                theme: 'dark',
                                autoRefresh: false,
                                defaultLogLevel: 'all',
                                defaultNamespace: 'all',
                                logsPerPage: 50,
                                timezone: 'UTC'
                        })
                },
                sessionData: {
                        type: Schema.Types.Mixed,
                        default: {}
                },
                isActive: {
                        type: Boolean,
                        default: true
                },
                loginCount: {
                        type: Number,
                        default: 0
                }
        },
        {
                timestamps: true
        }
);

// Instance method to update user preferences
userSchema.methods.updatePreferences = function (newPreferences: Partial<IUserPreferences>) {
        this.preferences = { ...this.preferences.toObject(), ...newPreferences };
        return this.save();
};

// Instance method to increment login count and update last login
userSchema.methods.recordLogin = function () {
        this.loginCount = (this.loginCount || 0) + 1;
        this.lastLogin = new Date();
        return this.save();
};

// Static method to find active users
userSchema.statics.findActive = function () {
        return this.find({ isActive: true });
};

export const User = mongoose.model<IUser>('User', userSchema);
