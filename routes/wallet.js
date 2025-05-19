 
const auth = require('../middleware/auth');
const express = require('express');
const TokenReservation = require('../models/TokenReservation');
const router = express.Router();
const User = require('../models/User');

// Endpoint to get the amount reserved for a specific user
router.post('/balance', async (req, res) => {
  try {
    const { email } = req.body; // Retrieve email from body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user_id = String(user._id); // Convert ObjectId to string
    console.log(user_id)

    res.json({ 
      user_id, 
      balance: user.balance, 
      reserved_Balance: user.offline_credits 
    });

  } catch (err) {
    console.error('Error fetching user balance:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



router.post('/update-balance', async (req, res) => {
  try {
    const { email, newBalance } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!newBalance || typeof newBalance !== 'number') {
      return res.status(400).json({ message: 'New balance must be a number' });
    }

    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the balance
    const updatedUser = await User.findOneAndUpdate(
      { email },
      { balance: newBalance },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Balance updated successfully',
      balance: updatedUser.balance,
      offlineCredits: updatedUser.offline_credits
    });

  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
