const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const backupController = require('../controllers/backupController');

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.get('/', backupController.exportData);
router.post('/restore', backupController.importData);

module.exports = router;
