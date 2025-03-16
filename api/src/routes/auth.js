const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Validate API key
router.post('/validate', authenticate, (req, res) => {
  res.json({ valid: true });
});

module.exports = router; 