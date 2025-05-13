const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Device = require('../models/Device');
const { hasRegisteredDevices } = require('../utils/webauthn');
const crypto = require('crypto');

// Get all devices for the current user
router.get('/', auth, async (req, res) => {
  try {
    const devices = await Device.find({ user: req.user.userId })
      .select('-credentialPublicKey');
    
    res.json({ devices });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices. Please try again later.' });
  }
});

// Check if a specific device is registered for a user
router.post('/check-device', async (req, res) => {
  try {
    const { userId, deviceInfo } = req.body;
    
    if (!userId || !deviceInfo) {
      return res.status(400).json({ error: 'User ID and device information are required' });
    }
    
    console.log('Checking device for user:', userId);
    console.log('Device info:', deviceInfo);
    
    // Generate a device fingerprint based on browser, platform, and user agent
    const userAgent = deviceInfo.browser + deviceInfo.platform;
    const fingerprint = crypto
      .createHash('sha256')
      .update(userId + userAgent)
      .digest('hex');
    
    // Check if this device fingerprint exists
    const device = await Device.findOne({ 
      user: userId,
      deviceFingerprint: fingerprint
    });
    
    if (device) {
      console.log('Device found:', device._id);
      res.json({ 
        isRegistered: true,
        deviceId: device._id
      });
    } else {
      console.log('Device not found for user:', userId);
      res.json({ isRegistered: false });
    }
  } catch (error) {
    console.error('Error checking device:', error);
    res.status(500).json({ error: 'Failed to check device. Please try again later.' });
  }
});

// Verify if a specific device ID is valid for a user
router.post('/verify-device', async (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    
    if (!userId || !deviceId) {
      return res.status(400).json({ error: 'User ID and device ID are required' });
    }
    
    console.log('Verifying device ID for user:', userId);
    
    // Check if this device exists and belongs to the user
    const device = await Device.findOne({ 
      _id: deviceId,
      user: userId
    });
    
    if (device) {
      console.log('Device verified:', device._id);
      
      // Update last used timestamp
      device.lastUsed = new Date();
      await device.save();
      
      res.json({ 
        isValid: true,
        device: {
          id: device._id,
          name: device.deviceName,
          lastUsed: device.lastUsed
        }
      });
    } else {
      console.log('Device not valid for user:', userId);
      res.json({ isValid: false });
    }
  } catch (error) {
    console.error('Error verifying device:', error);
    res.status(500).json({ error: 'Failed to verify device. Please try again later.' });
  }
});

// Register a new device
router.post('/register', async (req, res) => {
  try {
    const { userId, deviceInfo } = req.body;
    
    if (!userId || !deviceInfo) {
      return res.status(400).json({ error: 'User ID and device information are required' });
    }
    
    console.log('Registering device for user:', userId);
    console.log('Device info:', deviceInfo);
    
    // Generate a unique device fingerprint
    const userAgent = deviceInfo.browser + deviceInfo.platform;
    const fingerprint = crypto
      .createHash('sha256')
      .update(userId + userAgent)
      .digest('hex');
    
    // Check if device already exists
    let device = await Device.findOne({ 
      user: userId, 
      deviceFingerprint: fingerprint 
    });
    
    // Find user (needed in both cases)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(device)
    if (!device) {
      // Create a new device record if it doesn't exist
      device = new Device({
        user: userId,
        deviceName: deviceInfo.deviceName,
        browser: deviceInfo.browser,
        platform: deviceInfo.platform,
        deviceFingerprint: fingerprint,
        lastUsed: new Date()
      });
      
      await device.save();
    } else {
      // Update lastUsed timestamp for existing device
      device.lastUsed = new Date();
      await device.save();
    }
    
    // Add the device to the user's devices array if not already present
    if (!user.devices.includes(device._id)) {
      user.devices.push(device._id);
      await user.save();
    }
    
    res.json({ 
      success: true,
      device: {
        id: device._id,
        name: device.deviceName,
        lastUsed: device.lastUsed
      }
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(400).json({ error: 'Failed to register device. Please try again.' });
  }
});
// Check if current device is registered
router.get('/check-current', auth, async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'];
    const devices = await Device.find({ user: req.user.userId });
    
    // Simple check based on user agent
    const isRegistered = devices.some(device => 
      userAgent.includes(device.browser) && userAgent.includes(device.platform)
    );
    
    res.json({ isRegistered });
  } catch (error) {
    console.error('Error checking device:', error);
    res.status(500).json({ error: 'Failed to check device. Please try again later.' });
  }
});

module.exports = router;
