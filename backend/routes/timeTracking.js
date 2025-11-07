const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const timeTrackingService = require("../services/timeTrackingService");
const { authenticateToken } = require("../middleware/auth");

// Log every request to this router
router.use((req, res, next) => {
  console.log("timeTracking.js router received:", req.method, req.originalUrl);
  next();
});

// Start time tracking
router.post("/start/:taskId", authenticateToken, async (req, res) => {
  console.log("--- [POST] /start/:taskId called ---");
  console.log("Headers:", req.headers);
  console.log("Params:", req.params);
  console.log("Body:", req.body);
  try {
    const { taskId } = req.params;
    const { projectId } = req.body;
    const userId = req.user?.uid;
    console.log("Extracted:", { taskId, projectId, userId });
    if (!taskId || !projectId || !userId) {
      console.error("Missing required parameter:", {
        taskId,
        projectId,
        userId,
      });
      return res
        .status(400)
        .json({ success: false, error: "Missing required parameter" });
    }
    const result = await timeTrackingService.startTracking(
      taskId,
      projectId,
      userId,
    );
    console.log("Time tracking started successfully:", result);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error starting time tracking:", error);
    res
      .status(400)
      .json({ success: false, error: error.message, stack: error.stack });
  }
});

// Stop time tracking
router.post("/stop/:taskId", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { notes } = req.body;
    const userId = req.user.uid;

    const result = await timeTrackingService.stopTracking(
      taskId,
      userId,
      notes,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error stopping time tracking:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update activity (for idle detection)
router.post("/activity/:taskId", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.uid;

    await timeTrackingService.updateActivity(taskId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating activity:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get time sessions for a project
router.get("/project/:projectId", authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.uid;

    // Verify user has access to this project
    const projectDoc = await admin
      .firestore()
      .collection("projects")
      .doc(projectId)
      .get();
    if (!projectDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Project not found" });
    }

    const projectData = projectDoc.data();
    if (
      projectData.freelancerId !== userId &&
      projectData.clientId !== userId
    ) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Get time sessions for this project
    const sessionsSnapshot = await admin
      .firestore()
      .collection("time_sessions")
      .where("projectId", "==", projectId)
      .orderBy("createdAt", "desc")
      .get();

    const sessions = sessionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error("Error fetching time sessions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
