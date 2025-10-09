const Joi = require('joi');

// Project validation schemas
const projectSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  budget: Joi.number().min(0).required(),
  hourlyRate: Joi.number().min(0).max(10000).required(),
  estimatedHours: Joi.number().min(1).max(8760).required(),
  startDate: Joi.date().min('now').required(),
  dueDate: Joi.date().min(Joi.ref('startDate')).required(),
  clientEmail: Joi.string().email().optional(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium')
});

const projectUpdateSchema = Joi.object({
  title: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  budget: Joi.number().min(0).optional(),
  hourlyRate: Joi.number().min(0).max(10000).optional(),
  estimatedHours: Joi.number().min(1).max(8760).optional(),
  dueDate: Joi.date().optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  status: Joi.string().valid('active', 'completed', 'cancelled', 'on_hold').optional()
});

// Task validation schemas
const taskSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  estimatedHours: Joi.number().min(0).max(1000).required(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').default('pending')
});

const taskUpdateSchema = Joi.object({
  title: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  estimatedHours: Joi.number().min(0).max(1000).optional(),
  actualHours: Joi.number().min(0).max(1000).optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').optional()
});

// Invoice validation schemas
const invoiceSchema = Joi.object({
  projectId: Joi.string().required(),
  clientEmail: Joi.string().email().required(),
  lineItems: Joi.array().items(
    Joi.object({
      description: Joi.string().required(),
      quantity: Joi.number().min(1).required(),
      rate: Joi.number().min(0).required(),
      amount: Joi.number().min(0).required()
    })
  ).min(1).required(),
  subtotal: Joi.number().min(0).required(),
  taxAmount: Joi.number().min(0).default(0),
  totalAmount: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('RM'),
  issueDate: Joi.date().default(Date.now),
  dueDate: Joi.date().min(Joi.ref('issueDate')).required(),
  notes: Joi.string().max(500).optional()
});

// Transaction validation schemas
const transactionSchema = Joi.object({
  projectId: Joi.string().required(),
  amount: Joi.number().min(0).required(),
  type: Joi.string().valid('payment', 'expense', 'refund', 'milestone').required(),
  description: Joi.string().max(200).required(),
  paymentMethod: Joi.string().max(50).optional(),
  paymentReference: Joi.string().max(100).optional()
});

// User validation schemas
const userSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('freelancer', 'client').required(),
  company: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  address: Joi.string().max(200).optional()
});

module.exports = {
  projectSchema,
  projectUpdateSchema,
  taskSchema,
  taskUpdateSchema,
  invoiceSchema,
  transactionSchema,
  userSchema
};
