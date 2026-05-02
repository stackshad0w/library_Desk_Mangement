const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.use(authenticate);

router.post('/',
  authorize('admin', 'accountant'),
  body('student_id').notEmpty(),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('payment_date').isDate(),
  body('payment_method').isIn(['cash', 'online_transfer', 'cheque', 'upi', 'dd']),
  body('notes').optional().trim().isLength({ max: 500 }),
  validate,
  paymentController.recordPayment
);

router.get('/:studentId',
  param('studentId').notEmpty(),
  validate,
  paymentController.getStudentPayments
);

router.delete('/:id',
  authorize('admin'),
  param('id').notEmpty(),
  validate,
  paymentController.deletePayment
);

module.exports = router;
