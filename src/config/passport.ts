import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { User } from '../models/User';

export const configurePassport = (): void => {
        passport.use(
                new GitHubStrategy(
                        {
                                clientID: process.env['GITHUB_CLIENT_ID']!,
                                clientSecret: process.env['GITHUB_CLIENT_SECRET']!,
                                callbackURL: process.env['GITHUB_CALLBACK_URL']!
                        },
                        async (
                                _accessToken: string,
                                _refreshToken: string,
                                profile: any,
                                done: any
                        ) => {
                                try {
                                        // Check if user already exists
                                        let user = await User.findOne({ githubId: profile.id });

                                        if (user) {
                                                // Update existing user
                                                user.name = profile.displayName || profile.username;
                                                user.email = profile.emails?.[0]?.value || '';
                                                user.avatar = profile.photos?.[0]?.value || '';
                                                user.isActive = true;
                                                await user.recordLogin(); // Use the new method
                                                return done(null, user);
                                        }

                                        // Create new user with default preferences
                                        user = await User.create({
                                                githubId: profile.id,
                                                username: profile.username,
                                                name: profile.displayName || profile.username,
                                                email: profile.emails?.[0]?.value || '',
                                                avatar: profile.photos?.[0]?.value || '',
                                                lastLogin: new Date(),
                                                loginCount: 1,
                                                preferences: {
                                                        theme: 'dark',
                                                        autoRefresh: false,
                                                        defaultLogLevel: 'all',
                                                        defaultNamespace: 'all',
                                                        logsPerPage: 50,
                                                        timezone: 'UTC'
                                                },
                                                sessionData: {},
                                                isActive: true
                                        });

                                        return done(null, user);
                                } catch (error) {
                                        return done(error, null);
                                }
                        }
                )
        );

        passport.serializeUser((user: any, done) => {
                done(null, user._id);
        });

        passport.deserializeUser(async (id: string, done) => {
                try {
                        const user = await User.findById(id);
                        if (user && user.isActive) {
                                done(null, user);
                        } else {
                                done(null, false);
                        }
                } catch (error) {
                        done(error, null);
                }
        });
};
