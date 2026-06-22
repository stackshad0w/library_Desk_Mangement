const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const seatController = require('../controllers/seatController');

const router = express.Router();

router.use(authenticate);

router.get('/', seatController.getAll);

router.post('/',
  authorize('admin', 'teacher'),
  // The floor id and per-floor seat range are validated against the configurable
  // layout inside the controller, so only basic shape is checked here.
  body('seat_number').isInt({ min: 1 }).withMessage('Seat number must be a positive integer'),
  body('student_id').notEmpty(),
  body('floor').notEmpty().withMessage('Floor is required'),
  body('from_date').optional({ values: 'falsy' }).isDate(),
  body('due_date').optional({ values: 'falsy' }).isDate(),
  validate,
  seatController.create
);

router.delete('/:id',
  authorize('admin', 'teacher'),
  param('id').notEmpty(),
  validate,
  seatController.remove
);

module.exports = router;
