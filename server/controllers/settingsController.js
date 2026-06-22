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

const ALLOWED_SETTINGS_KEYS = ['fee_tiers', 'theme', 'seat_config', 'courses'];

exports.updateSetting = (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ message: 'Key and value are required' });
  }

  if (!ALLOWED_SETTINGS_KEYS.includes(key)) {
    return res.status(400).json({ message: `Unknown setting key: ${key}` });
  }

  // Validation
  if (key === 'theme') {
    const validThemes = ['default', 'warm', 'light', 'sepia', 'cool'];
    if (!validThemes.includes(value)) {
      return res.status(400).json({ message: `Invalid theme: ${value}` });
    }
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

  // Validate courses list
  if (key === 'courses') {
    if (!Array.isArray(value) || value.length === 0) {
      return res.status(400).json({ message: 'courses must be a non-empty array' });
    }
    for (const c of value) {
      if (typeof c !== 'string' || !c.trim()) {
        return res.status(400).json({ message: 'Each course must be a non-empty name' });
      }
    }
  }

  // Validate seat_config structure (configurable library layout)
  if (key === 'seat_config') {
    if (!value || !Array.isArray(value.floors) || value.floors.length === 0) {
      return res.status(400).json({ message: 'seat_config must have a non-empty floors array' });
    }
    const ids = new Set();
    for (const f of value.floors) {
      if (!f.id || typeof f.id !== 'string' || !/^[a-z0-9_-]+$/i.test(f.id)) {
        return res.status(400).json({ message: 'Each floor needs a simple id (letters, numbers, - or _)' });
      }
      if (ids.has(f.id)) {
        return res.status(400).json({ message: `Duplicate floor id: ${f.id}` });
      }
      ids.add(f.id);
      if (!f.label || typeof f.label !== 'string') {
        return res.status(400).json({ message: 'Each floor needs a label' });
      }
      if (!Number.isInteger(f.seats) || f.seats < 1 || f.seats > 1000) {
        return res.status(400).json({ message: 'Each floor needs seats between 1 and 1000' });
      }
      if (!Number.isInteger(f.cols) || f.cols < 1 || f.cols > 30) {
        return res.status(400).json({ message: 'Each floor needs columns between 1 and 30' });
      }
    }
  }

  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, stringValue);

    // If the layout shrank, cancel active bookings that no longer fit (removed
    // floor, or seat number now beyond that floor's capacity) so they don't
    // linger as invisible "ghost" occupancy.
    if (key === 'seat_config') {
      const active = db.prepare("SELECT id, floor, seat_number FROM seat_bookings WHERE status = 'active'").all();
      const cancel = db.prepare("UPDATE seat_bookings SET status = 'cancelled' WHERE id = ?");
      for (const b of active) {
        const fc = value.floors.find(f => f.id === b.floor);
        if (!fc || b.seat_number > fc.seats) cancel.run(b.id);
      }
    }

    res.json({ message: 'Setting updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update setting' });
  }
};
