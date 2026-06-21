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
  body('seat_number').isInt({ min: 1, max: 90 }).withMessage('Seat number must be between 1 and 90'),
  body('student_id').notEmpty(),
  body('floor').optional().isIn(['basement', 'floor2']),
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
