const express = require('express');
const router = express.Router();
// Use the same initialized admin app and storage from one place
const { storage } = require('../firebase-admin');
const { authenticateToken } = require('../middleware/auth');

// Upload a progress attachment (base64) to Firebase Storage via Admin SDK
router.post('/progress-attachment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { projectId, name, type, base64 } = req.body || {};

    if (!projectId || !name || !type || !base64) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const resolvedBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;
    const effectiveBucket = resolvedBucket || (storage?.app?.options?.storageBucket);
    if (!effectiveBucket) {
      return res.status(500).json({ success: false, error: 'Storage bucket is not configured on the server' });
    }

    const buffer = Buffer.from(base64, 'base64');
    const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = `progress_updates/${projectId}/${Date.now()}_${safeName}`;

    const bucket = storage.bucket(effectiveBucket);
    console.log('Uploading to bucket:', effectiveBucket, 'path:', filePath, 'type:', type, 'user:', userId);
    const file = bucket.file(filePath);

    await file.save(buffer, {
      contentType: type,
      metadata: { contentType: type, customMetadata: { uploadedBy: userId, projectId } },
      resumable: false
    });

    // Generate a signed URL for downloading
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 7 }); // 7 days

    return res.json({
      success: true,
      attachment: { name, url, type, size: buffer.length }
    });
  } catch (error) {
    console.error('Error uploading progress attachment:', error);
    const details = error?.errors || error?.response || error?.toString?.() || null;
    return res.status(500).json({ success: false, error: error.message || 'Upload failed', details });
  }
});

module.exports = router;


