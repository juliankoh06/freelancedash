const { admin } = require('../firebase-admin');

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

      console.log('Authorization check for user:', req.user.uid);
      console.log('Allowed roles:', allowedRoles);

      // Get user role from Firestore
      const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
      if (!userDoc.exists) {
        console.error('User document not found in Firestore:', req.user.uid);
        return res.status(404).json({ error: 'User not found in database' });
      }

      const userData = userDoc.data();
      const userRole = userData.role;

      console.log('User role from Firestore:', userRole);

      if (!userRole) {
        console.error('User has no role assigned:', req.user.uid);
        return res.status(403).json({ error: 'User role not assigned' });
      }

      if (!allowedRoles.includes(userRole)) {
        console.error(`User role ${userRole} not in allowed roles:`, allowedRoles);
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          details: `Required role: ${allowedRoles.join(' or ')}, User role: ${userRole}`
        });
      }

      req.user.role = userRole; // Add role to req.user
      req.userRole = userRole;
      req.userData = userData;
      
      console.log('Authorization successful for user:', req.user.uid);
      next();
    } catch (error) {
      console.error('Authorization failed with error:', error);
      return res.status(500).json({ 
        error: 'Authorization failed',
        details: error.message 
      });
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
