const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
require('./firebase-config'); 
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const invoiceRoutes = require('./routes/invoices');
const freelancerRoutes = require('./routes/freelancer');
const paymentRoutes = require('./routes/payments');
const invitationRoutes = require('./routes/invitations');
const emailRoutes = require('./routes/email');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/freelancer', freelancerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/email', emailRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
