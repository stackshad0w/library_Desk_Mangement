const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, settingsController.getSettings);
router.put('/', protect, authorize('admin'), settingsController.updateSetting);

module.exports = router;
