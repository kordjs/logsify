import express from 'express';
import passport from 'passport';

const router = express.Router();

// GitHub OAuth login
router.get('/github', passport.authenticate('github', { 
  scope: ['user:email'] 
}));

// GitHub OAuth callback
router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/' }),
  (_req, res) => {
    // Successful authentication, redirect to dashboard
    res.redirect('/dashboard');
  }
);

// Logout
router.post('/logout', (req, res): void => {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.redirect('/');
  });
});

// Check authentication status
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;