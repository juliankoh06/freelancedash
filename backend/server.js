const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
require('./firebase-config'); 
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
