const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const { loginLimiter } = require('../middleware/rateLimiter');
const authController = require('../controllers/authController');

const router = express.Router();

// Only an existing admin may create new accounts (prevents privilege escalation).
router.post('/register',
  authenticate,
  authorize('admin'),
  body('username').isLength({ min: 3, max: 50 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['admin', 'teacher', 'accountant']),
  validate,
  authController.register
);

router.post('/login',
  loginLimiter,
  body('username').notEmpty().trim(),
  body('password').notEmpty(),
  validate,
  authController.login
);

router.post('/logout', authenticate, authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.get('/me', authenticate, authController.getMe);

// User management (admin only)
router.get('/users', authenticate, authorize('admin'), authController.listUsers);
router.put('/users/:id',
  authenticate,
  authorize('admin'),
  body('role').optional().isIn(['admin', 'teacher', 'accountant']),
  body('is_active').optional().isBoolean(),
  validate,
  authController.updateUser
);
router.delete('/users/:id', authenticate, authorize('admin'), authController.deleteUser);

module.exports = router;
