// const { 
//   generateRegistrationOptions,
//   verifyRegistrationResponse,
//   generateAuthenticationOptions,
//   verifyAuthenticationResponse
// } = require('@simplewebauthn/server');
// const base64url = require('base64url');
// const crypto = require('crypto');
// const User = require('../models/User');
// const Device = require('../models/Device');

// // WebAuthn configuration
// const rpName = 'Banko Simulate';
// const rpID = process.env.RP_ID || 'localhost';
// const origin = process.env.ORIGIN || `http://${rpID}:5000`;

// /**
//  * Generate registration options for a new device
//  */
// const generateDeviceRegistrationOptions = async (userId) => {
//   const user = await User.findById(userId);
//   if (!user) throw new Error('User not found');

//   // Get existing devices for the user
//   const devices = await Device.find({ user: userId });
//   const excludeCredentials = devices.map(device => ({
//     id: base64url.toBuffer(device.credentialID),
//     type: 'public-key',
//     transports: device.transports || [],
//   }));

//   // Generate a new challenge
//   const challenge = crypto.randomBytes(32);
//   const challengeBase64 = base64url.encode(challenge);
  
//   // Save the challenge to the user
//   user.currentChallenge = challengeBase64;
//   await user.save();

//   // Convert userId to Buffer for SimpleWebAuthn
//   const userIdBuffer = Buffer.from(userId.toString());

//   // Generate registration options
//   const options = generateRegistrationOptions({
//     rpName,
//     rpID,
//     userID: userIdBuffer,
//     userName: user.username,
//     userDisplayName: user.username,
//     timeout: 60000,
//     attestationType: 'none',
//     excludeCredentials,
//     authenticatorSelection: {
//       userVerification: 'preferred',
//       residentKey: 'preferred',
//     },
//     supportedAlgorithmIDs: [-7, -257],
//     challenge,
//   });

//   return options;
// };

// /**
//  * Verify registration response and save the device
//  */
// const verifyDeviceRegistration = async (userId, response, deviceInfo) => {
//   const user = await User.findById(userId);
//   if (!user) throw new Error('User not found');

//   const expectedChallenge = user.currentChallenge;
//   if (!expectedChallenge) throw new Error('No challenge found');

//   try {
//     // Verify the registration response
//     const verification = await verifyRegistrationResponse({
//       response,
//       expectedChallenge: base64url.toBuffer(expectedChallenge),
//       expectedOrigin: origin,
//       expectedRPID: rpID,
//       requireUserVerification: false,
//     });

//     const { verified, registrationInfo } = verification;

//     if (!verified) throw new Error('Registration verification failed');

//     // Create a new device
//     const { credentialID, credentialPublicKey, counter } = registrationInfo;

//     const device = new Device({
//       user: userId,
//       credentialID: base64url.encode(credentialID),
//       credentialPublicKey: credentialPublicKey,
//       counter,
//       transports: response.transports || [],
//       deviceName: deviceInfo.deviceName || 'Unknown Device',
//       browser: deviceInfo.browser,
//       platform: deviceInfo.platform,
//     });

//     await device.save();

//     // Add the device to the user's devices array
//     user.devices.push(device._id);
//     user.currentChallenge = null;
//     await user.save();

//     return { verified, device };
//   } catch (error) {
//     console.error('Device registration verification error:', error);
//     throw error;
//   }
// };

// /**
//  * Generate authentication options for an existing device
//  */
// const generateDeviceAuthenticationOptions = async (userId) => {
//   const user = await User.findById(userId);
//   if (!user) throw new Error('User not found');

//   // Get existing devices for the user
//   const devices = await Device.find({ user: userId });
  
//   if (devices.length === 0) {
//     // No devices registered yet
//     return null;
//   }

//   const allowCredentials = devices.map(device => ({
//     id: base64url.toBuffer(device.credentialID),
//     type: 'public-key',
//     transports: device.transports || [],
//   }));

//   // Generate a new challenge
//   const challenge = crypto.randomBytes(32);
//   const challengeBase64 = base64url.encode(challenge);
  
//   // Save the challenge to the user
//   user.currentChallenge = challengeBase64;
//   await user.save();

//   // Generate authentication options
//   const options = generateAuthenticationOptions({
//     rpID,
//     timeout: 60000,
//     allowCredentials,
//     userVerification: 'preferred',
//     challenge,
//   });

//   return options;
// };

// /**
//  * Verify authentication response and update the device
//  */
// const verifyDeviceAuthentication = async (userId, response) => {
//   const user = await User.findById(userId);
//   if (!user) throw new Error('User not found');

//   const expectedChallenge = user.currentChallenge;
//   if (!expectedChallenge) throw new Error('No challenge found');

//   // Find the device by credential ID
//   const credentialID = response.id;
//   const device = await Device.findOne({ credentialID: credentialID });
  
//   if (!device) throw new Error('Device not found');

//   try {
//     // Verify the authentication response
//     const verification = await verifyAuthenticationResponse({
//       response,
//       expectedChallenge: base64url.toBuffer(expectedChallenge),
//       expectedOrigin: origin,
//       expectedRPID: rpID,
//       authenticator: {
//         credentialID: base64url.toBuffer(device.credentialID),
//         credentialPublicKey: device.credentialPublicKey,
//         counter: device.counter,
//       },
//       requireUserVerification: false,
//     });

//     const { verified, authenticationInfo } = verification;

//     if (!verified) throw new Error('Authentication verification failed');

//     // Update the device counter
//     device.counter = authenticationInfo.newCounter;
//     device.lastUsed = new Date();
//     await device.save();

//     // Clear the challenge
//     user.currentChallenge = null;
//     await user.save();

//     return { verified, device };
//   } catch (error) {
//     console.error('Device authentication verification error:', error);
//     throw error;
//   }
// };

// /**
//  * Check if a user has any registered devices
//  */
// const hasRegisteredDevices = async (userId) => {
//   const count = await Device.countDocuments({ user: userId });
//   return count > 0;
// };

// module.exports = {
//   generateDeviceRegistrationOptions,
//   verifyDeviceRegistration,
//   generateDeviceAuthenticationOptions,
//   verifyDeviceAuthentication,
//   hasRegisteredDevices
// };
