const { db } = require('../config/database');

exports.getSettings = (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch (e) {
        settings[r.key] = r.value;
      }
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

const ALLOWED_SETTINGS_KEYS = ['fee_tiers'];

exports.updateSetting = (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ message: 'Key and value are required' });
  }

  if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
    return res.status(400).json({ message: `Unknown setting key: ${key}` });
  }

  // Validate fee_tiers structure
  if (key === 'fee_tiers') {
    if (!Array.isArray(value) || value.length === 0) {
      return res.status(400).json({ message: 'fee_tiers must be a non-empty array' });
    }
    const validGenders = ['Male', 'Female', 'Other'];
    const validShifts = ['Day', 'Night', 'Both'];
    for (const tier of value) {
      if (!tier.months || !Number.isInteger(tier.months) || tier.months < 1) {
        return res.status(400).json({ message: 'Each tier must have a valid months value (integer >= 1)' });
      }
      if (!tier.fee || tier.fee <= 0) {
        return res.status(400).json({ message: 'Each tier must have a positive fee value' });
      }
      if (tier.gender && !validGenders.includes(tier.gender)) {
        return res.status(400).json({ message: `Invalid gender in tier: ${tier.gender}` });
      }
      if (tier.shift && !validShifts.includes(tier.shift)) {
        return res.status(400).json({ message: `Invalid shift in tier: ${tier.shift}` });
      }
    }
  }

  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, stringValue);
    res.json({ message: 'Setting updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update setting' });
  }
};
