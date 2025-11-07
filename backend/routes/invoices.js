const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const { db } = require('../firebase-admin');
const InvoiceCalculationService = require('../services/invoiceCalculationService');
const invoiceCalculationService = new InvoiceCalculationService();
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const invoices = await Invoice.getAll();
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new invoice with server-side validation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const invoiceData = {
      ...req.body,
      freelancerId: req.user.uid
    };
    
    const result = await invoiceCalculationService.createInvoice(invoiceData);
    res.json({ success: true, data: result.invoice });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Client approve invoice
router.post('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await invoiceCalculationService.approveInvoice(id, req.user.uid);
    res.json({ success: true, message: 'Invoice approved successfully' });
  } catch (error) {
    console.error('Error approving invoice:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get invoice by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update invoice
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await Invoice.update(id, req.body);
    res.json({ success, message: 'Invoice updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete invoice
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await Invoice.delete(id);
    res.json({ success, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check and generate recurring invoices
router.post('/check-recurring', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all active recurring invoices
    const recurringSnapshot = await db.collection('recurring_invoices')
      .where('isActive', '==', true)
      .where('isPaused', '==', false)
      .get();
    
    let generatedCount = 0;
    const generatedInvoices = [];
    
    for (const doc of recurringSnapshot.docs) {
      const recurring = { id: doc.id, ...doc.data() };
      const nextDate = new Date(recurring.nextInvoiceDate.toDate());
      nextDate.setHours(0, 0, 0, 0);
      
      // Check if invoice should be generated
      if (today >= nextDate) {
        // Check if we've reached end date
        if (recurring.endDate) {
          const endDate = new Date(recurring.endDate.toDate());
          endDate.setHours(0, 0, 0, 0);
          if (today > endDate) {
            // Deactivate recurring invoice
            await doc.ref.update({ isActive: false, updatedAt: new Date() });
            continue;
          }
        }
        
        // Generate invoice
        const invoiceData = {
          invoiceType: 'recurring',
          invoiceNumber: `REC-${Date.now()}`,
          projectId: recurring.projectId,
          projectTitle: recurring.projectTitle,
          clientId: recurring.clientId,
          clientEmail: recurring.clientEmail,
          freelancerId: recurring.freelancerId,
          freelancerName: recurring.freelancerName,
          recurringInvoiceId: recurring.id,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'draft',
          subtotal: recurring.amount,
          taxRate: 0.06,
          taxAmount: recurring.amount * 0.06,
          totalAmount: recurring.amount * 1.06,
          lineItems: recurring.invoiceTemplate.lineItems,
          paymentTerms: recurring.invoiceTemplate.paymentTerms,
          notes: recurring.invoiceTemplate.notes,
          terms: recurring.invoiceTemplate.terms,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const invoiceRef = await db.collection('invoices').add(invoiceData);
        
        // Calculate next invoice date
        const nextInvoiceDate = calculateNextDate(nextDate, recurring.frequency);
        
        // Update recurring invoice
        await doc.ref.update({
          nextInvoiceDate: nextInvoiceDate,
          lastInvoiceDate: today,
          generatedInvoices: [...(recurring.generatedInvoices || []), invoiceRef.id],
          totalInvoicesGenerated: (recurring.totalInvoicesGenerated || 0) + 1,
          updatedAt: new Date()
        });
        
        generatedCount++;
        generatedInvoices.push(invoiceRef.id);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Generated ${generatedCount} recurring invoice(s)`,
      generatedInvoices
    });
  } catch (error) {
    console.error('Error checking recurring invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to calculate next date
function calculateNextDate(fromDate, frequency) {
  const nextDate = new Date(fromDate);
  
  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }
  
  return nextDate;
}

module.exports = router;
