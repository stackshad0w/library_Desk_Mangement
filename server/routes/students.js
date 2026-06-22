const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const studentController = require('../controllers/studentController');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', studentController.getAll);

router.get('/courses', studentController.getCourses);

router.get('/:id',
  param('id').notEmpty(),
  validate,
  studentController.getById
);

router.post('/',
  authorize('admin', 'teacher'),
  body('name').isLength({ min: 2, max: 100 }).trim(),
  body('phone').matches(/^[0-9+\- ]{7,15}$/).withMessage('Invalid phone number'),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('course').notEmpty().trim(),
  body('total_fees').isFloat({ min: 0 }).withMessage('Total fees must be a positive number'),
  body('paid_fees').optional().isFloat({ min: 0 }),
  body('admission_date').optional().isDate(),
  body('due_date').optional({ values: 'falsy' }).isDate(),
  body('photo').optional({ values: 'falsy' }).isLength({ max: 1500000 }).withMessage('Photo is too large (please use a smaller image)'),
  validate,
  studentController.create
);

router.put('/:id',
  authorize('admin', 'teacher'),
  param('id').notEmpty(),
  body('name').optional().isLength({ min: 2, max: 100 }).trim(),
  body('phone').optional().matches(/^[0-9+\- ]{7,15}$/),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('total_fees').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['active', 'inactive', 'graduated']),
  body('photo').optional({ values: 'falsy' }).isLength({ max: 1500000 }).withMessage('Photo is too large (please use a smaller image)'),
  validate,
  studentController.update
);

router.delete('/:id',
  authorize('admin'),
  param('id').notEmpty(),
  validate,
  studentController.remove
);

module.exports = router;
