const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
 

const router = express.Router();

router.get('/user', async (req, res) => {
  console.log(req.body.email)
  try {
  
    const user = await User.findOne({email: req.body.email});

    if (!user) throw new Error('User not found');
    
    res.json({ user: user });
  } catch (error) {
    console.log(error)
    res.status(400).json({ error: error.message });
  }
});
// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this email or username already exists' 
      });
    }
    
    
    // Create new user
    const user = new User({ 
      username, 
      email, 
      password: password
    });
    
    await user.save();
    res.status(201).json({ message: 'User registered successfully', user:user});
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});
 
 

// Legacy login endpoint (kept for reference)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // // Create JWT token
    // const token = jwt.sign(
    //   { userId: user._id }, 
    //   process.env.JWT_SECRET, 
    //   { expiresIn: '1h' }
    // );
    
    // // Check if user has any registered devices
    // const hasDevices = await hasRegisteredDevices(user._id);
    
    console.log('Login successful for user');
    
    res.json({user:user});
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message });
  }
});
 

module.exports = router;

