const { admin } = require('../firebase-config');

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify the token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Role-based authorization middleware
const authorizeRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user role from Firestore
      const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const userRole = userData.role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.userRole = userRole;
      req.userData = userData;
      next();
    } catch (error) {
      console.error('Authorization failed:', error);
      return res.status(500).json({ error: 'Authorization failed' });
    }
  };
};

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  validateInput
};
