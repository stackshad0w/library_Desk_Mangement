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

exports.updateSetting = (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ message: 'Key and value are required' });
  }

  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, stringValue);
    res.json({ message: 'Setting updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update setting' });
  }
};
