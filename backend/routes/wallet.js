 
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

router.post('/reserve', async (req, res) => {
  try {
    const { email, amount } = req.body; // Retrieve email from body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user_id = String(user._id); // Convert ObjectId to string
 
    if (!amount || amount <= 0 || amount > user.balance) {
      return res.status(400).json({ message: 'Invalid amount specified' });
    }

    await User.updateOne(
      { _id: user_id },
      { 
          $inc: { 
              balance: -amount, 
              offline_credits: amount 
          } 
      }
      );

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

router.post('/release', async (req, res) => {
  try {
    const { email, amount } = req.body; // Retrieve email from body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user_id = String(user._id); // Convert ObjectId to string

    if (!amount || amount <= 0 || amount > user.offline_credits) {
      return res.status(400).json({ message: 'Invalid amount specified' });
    }

    await User.updateOne(
      { _id: user_id },
      { 
        $inc: { 
          balance: amount, 
          offline_credits: -amount 
        } 
      }
    );

    res.json({ 
      user_id, 
      balance: user.balance, 
      reserved_Balance: user.offline_credits 
    });

  } catch (err) {
    console.error('Error processing release request:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;
