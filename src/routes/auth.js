const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // In a production environment, you would validate against a database
  // For now, we'll use a simple check
  if (username === process.env.ADMIN_USERNAME && 
      password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } else {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid credentials'
    });
  }
});

module.exports = router; 