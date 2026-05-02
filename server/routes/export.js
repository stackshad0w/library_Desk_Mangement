const express = require('express');
const { authenticate } = require('../middleware/auth');
const exportController = require('../controllers/exportController');

const router = express.Router();

router.use(authenticate);

router.get('/students', exportController.exportStudents);
router.get('/payments', exportController.exportPayments);

module.exports = router;
