const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
require("./firebase-admin");
require("dotenv").config();
const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require("./routes/auth");
const emailRoutes = require("./routes/email");
const projectRoutes = require("./routes/projects");
const invoiceRoutes = require("./routes/invoices");
const freelancerRoutes = require("./routes/freelancer");
const invitationRoutes = require("./routes/invitations");
const paymentRoutes = require("./routes/payments");
const transactionRoutes = require("./routes/transactions");
const contractRoutes = require("./routes/contracts");
const timeTrackingRoutes = require("./routes/timeTracking");
const approvalsRoutes = require("./routes/approvals");
const reminderRoutes = require("./routes/reminders");
const progressRoutes = require("./routes/progress");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/invoices", invoiceRoutes); 
app.use("/api/freelancer", freelancerRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/approvals", approvalsRoutes);
app.use("/api/progress", progressRoutes);
app.use(
  "/api/time-tracking",
  (req, res, next) => {
    console.log(
      "Incoming request to /api/time-tracking:",
      req.method,
      req.originalUrl,
    );
    next();
  },
  timeTrackingRoutes,
);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error("❌ Express Error Handler:", err);
  console.error("Stack:", err.stack);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Debug logging middleware before 404 handler
app.use((req, res, next) => {
  console.log('DEBUG:', req.method, req.url, req.originalUrl, req.path);
  next();
});

// 404 handler
app.use((req, res) => {
  console.error("404 handler triggered:", {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    headers: req.headers,
    body: req.body,
  });
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    url: req.url,
    originalUrl: req.originalUrl,
    headers: req.headers,
    body: req.body,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start payment reminder cron job
  const { startReminderCron } = require('./jobs/reminderCron');
  startReminderCron();
});

// Global error handlers to prevent server crashes
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  console.error("Stack trace:", error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  console.error("Reason:", reason);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});
