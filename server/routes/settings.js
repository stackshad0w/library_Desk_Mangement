const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.get('/', authenticate, settingsController.getSettings);
router.put('/', authenticate, authorize('admin'), settingsController.updateSetting);

module.exports = router;
