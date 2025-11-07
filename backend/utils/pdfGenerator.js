const PDFDocument = require('pdfkit');
const { db } = require('../firebase-admin');

// Generate invoice PDF and return as base64 string
async function generateInvoicePDFBase64(invoiceData) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const base64 = pdfBuffer.toString('base64');
        resolve(base64);
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown();

      // Invoice details
      doc.fontSize(12).font('Helvetica');
      doc.text(`Invoice #: ${invoiceData.invoiceNumber || 'N/A'}`, { align: 'left' });
      
      const issueDate = invoiceData.issueDate?.toDate ? invoiceData.issueDate.toDate() : 
                        (invoiceData.issueDate ? new Date(invoiceData.issueDate) : new Date());
      doc.text(`Date: ${issueDate.toLocaleDateString()}`);
      
      const dueDate = invoiceData.dueDate?.toDate ? invoiceData.dueDate.toDate() : 
                      (invoiceData.dueDate ? new Date(invoiceData.dueDate) : null);
      if (dueDate) {
        doc.text(`Due Date: ${dueDate.toLocaleDateString()}`);
      }
      
      doc.moveDown();

      // Freelancer info (From)
      doc.fontSize(14).font('Helvetica-Bold').text('From:', { continued: false });
      doc.fontSize(10).font('Helvetica');
      
      doc.text(invoiceData.freelancerName || '');
      
      if (invoiceData.freelancerEmail) {
        doc.text(invoiceData.freelancerEmail);
      }
      
      // Fetch freelancer address from users collection if needed
      if (invoiceData.freelancerId) {
        try {
          const freelancerDoc = await db.collection('users').doc(invoiceData.freelancerId).get();
          if (freelancerDoc.exists && freelancerDoc.data().address) {
            const addressLines = freelancerDoc.data().address.split('\n');
            addressLines.forEach(line => doc.text(line));
          }
        } catch (err) {
          console.warn('Could not fetch freelancer address for PDF:', err.message);
        }
      }

      doc.moveDown();

      // Client info (To)
      doc.fontSize(14).font('Helvetica-Bold').text('To:', { continued: false });
      doc.fontSize(10).font('Helvetica');
      doc.text(invoiceData.clientName || '');
      if (invoiceData.clientEmail) {
        doc.text(invoiceData.clientEmail);
      }
      
      // Fetch client address and company from users collection if needed
      if (invoiceData.clientId) {
        try {
          const clientDoc = await db.collection('users').doc(invoiceData.clientId).get();
          if (clientDoc.exists) {
            const clientData = clientDoc.data();
            if (clientData.company) {
              doc.text(clientData.company);
            }
            if (clientData.address) {
              const addressLines = clientData.address.split('\n');
              addressLines.forEach(line => doc.text(line));
            }
          }
        } catch (err) {
          console.warn('Could not fetch client details for PDF:', err.message);
        }
      }

      doc.moveDown();

      // Project title
      if (invoiceData.projectTitle) {
        doc.fontSize(12).font('Helvetica-Bold').text(`Project: ${invoiceData.projectTitle}`);
        doc.moveDown();
      }

      // Line items table
      const lineItems = Array.isArray(invoiceData.lineItems) ? invoiceData.lineItems : [];
      const tableTop = doc.y;
      const itemHeight = 30;
      let tableY = tableTop;

      // Table headers
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Description', 50, tableY);
      doc.text('Qty', 300, tableY, { width: 50, align: 'center' });
      doc.text('Rate', 350, tableY, { width: 80, align: 'right' });
      doc.text('Amount', 430, tableY, { width: 100, align: 'right' });
      
      tableY += itemHeight;
      doc.moveTo(50, tableY).lineTo(530, tableY).stroke();

      // Table rows
      doc.font('Helvetica');
      lineItems.forEach(item => {
        if (tableY > 700) {
          doc.addPage();
          tableY = 50;
        }
        
        const description = (item.description || '').substring(0, 40);
        doc.text(description, 50, tableY, { width: 240 });
        doc.text((item.quantity != null ? item.quantity : '').toString(), 300, tableY, { width: 50, align: 'center' });
        doc.text(`RM${Number(item.rate || 0).toFixed(2)}`, 350, tableY, { width: 80, align: 'right' });
        doc.text(`RM${Number(item.amount || 0).toFixed(2)}`, 430, tableY, { width: 100, align: 'right' });
        
        tableY += itemHeight;
      });

      // Totals section
      doc.moveTo(50, tableY).lineTo(530, tableY).stroke();
      tableY += 10;

      doc.fontSize(10).font('Helvetica');
      doc.text('Subtotal:', 350, tableY, { width: 80, align: 'right' });
      doc.text(`RM${Number(invoiceData.subtotal || invoiceData.amount || 0).toFixed(2)}`, 430, tableY, { width: 100, align: 'right' });
      tableY += 20;

      const taxAmount = invoiceData.taxAmount || invoiceData.tax || 0;
      if (taxAmount > 0) {
        const taxRate = invoiceData.taxRate || 0;
        doc.text(`Tax (${(taxRate * 100).toFixed(1)}%):`, 350, tableY, { width: 80, align: 'right' });
        doc.text(`RM${Number(taxAmount).toFixed(2)}`, 430, tableY, { width: 100, align: 'right' });
        tableY += 20;
      }

      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('Total:', 350, tableY, { width: 80, align: 'right' });
      const totalAmount = invoiceData.totalAmount || invoiceData.total || 
                         ((invoiceData.subtotal || invoiceData.amount || 0) + taxAmount);
      doc.text(`RM${Number(totalAmount).toFixed(2)}`, 430, tableY, { width: 100, align: 'right' });
      tableY += 30;

      // Payment terms
      if (invoiceData.paymentTerms) {
        doc.fontSize(10).font('Helvetica');
        doc.text(`Payment Terms: ${invoiceData.paymentTerms}`, 50, tableY);
        tableY += 20;
      }

      // Bank details for payment
      if (invoiceData.freelancerBankAccount) {
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Payment Details:', 50, tableY);
        tableY += 15;
        doc.fontSize(9).font('Helvetica');
        doc.text(`Bank Account: ${invoiceData.freelancerBankAccount}`, 50, tableY);
        tableY += 15;
      }

      // Notes
      if (invoiceData.notes) {
        doc.fontSize(10).font('Helvetica');
        doc.text('Notes:', 50, tableY);
        tableY += 15;
        doc.fontSize(9);
        const notesLines = invoiceData.notes.split('\n');
        notesLines.forEach(line => {
          doc.text(line, 50, tableY, { width: 480 });
          tableY += 12;
        });
      }

      // Terms and conditions
      if (invoiceData.terms) {
        tableY += 10;
        doc.fontSize(8).font('Helvetica');
        doc.text('Terms and Conditions:', 50, tableY);
        tableY += 10;
        const termsLines = invoiceData.terms.split('\n');
        termsLines.forEach(line => {
          doc.text(line, 50, tableY, { width: 480 });
          tableY += 10;
        });
      }

      // Footer text (at bottom of page)
      doc.fontSize(8).font('Helvetica').fillColor('gray');
      doc.text('This is a computer-generated invoice', 50, 750, { align: 'center', width: 480 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Generate signed contract PDF and return as base64 string
function generateContractPDFBase64(contractData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const base64 = pdfBuffer.toString('base64');
        resolve(base64);
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(22).font('Helvetica-Bold').text('SERVICE AGREEMENT', { align: 'center' });
      doc.moveDown(2);

      // Contract details
      doc.fontSize(10).font('Helvetica');
      doc.text(`Contract ID: ${contractData.id || 'N/A'}`, { align: 'left' });
      doc.text(`Project: ${contractData.projectTitle || contractData.title || 'N/A'}`);
      
      const startDate = contractData.startDate?.toDate ? contractData.startDate.toDate() : 
                        (contractData.startDate ? new Date(contractData.startDate) : new Date());
      doc.text(`Start Date: ${startDate.toLocaleDateString()}`);
      
      const endDate = contractData.endDate?.toDate ? contractData.endDate.toDate() : 
                      (contractData.endDate ? new Date(contractData.endDate) : null);
      if (endDate) {
        doc.text(`End Date: ${endDate.toLocaleDateString()}`);
      }
      
      doc.moveDown(2);

      // Parties
      doc.fontSize(14).font('Helvetica-Bold').text('BETWEEN:', { continued: false });
      doc.moveDown();
      
      doc.fontSize(12).font('Helvetica-Bold').text('Freelancer (Service Provider):', { continued: false });
      doc.fontSize(10).font('Helvetica');
      doc.text(contractData.freelancerName || '');
      doc.text(contractData.freelancerEmail || '');
      doc.moveDown();
      
      doc.fontSize(12).font('Helvetica-Bold').text('Client:', { continued: false });
      doc.fontSize(10).font('Helvetica');
      doc.text(contractData.clientName || '');
      doc.text(contractData.clientEmail || '');
      doc.moveDown(2);

      // Scope of work
      if (contractData.scopeOfWork) {
        doc.fontSize(14).font('Helvetica-Bold').text('SCOPE OF WORK:', { continued: false });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica');
        doc.text(contractData.scopeOfWork, { align: 'justify' });
        doc.moveDown(2);
      }

      // Milestones
      if (contractData.milestones && contractData.milestones.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('MILESTONES & PAYMENT:', { continued: false });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica');
        
        contractData.milestones.forEach((milestone, index) => {
          doc.font('Helvetica-Bold').text(`${index + 1}. ${milestone.title || milestone.name}`, { continued: false });
          doc.font('Helvetica');
          if (milestone.description) {
            doc.text(`   ${milestone.description}`);
          }
          doc.text(`   Amount: RM${Number(milestone.amount || 0).toFixed(2)}`);
          doc.text(`   Percentage: ${milestone.percentage || 0}%`);
          doc.moveDown(0.5);
        });
        doc.moveDown();
      }

      // Payment terms
      doc.fontSize(14).font('Helvetica-Bold').text('PAYMENT TERMS:', { continued: false });
      doc.moveDown();
      doc.fontSize(10).font('Helvetica');
      doc.text(`Payment Policy: ${contractData.paymentPolicy === 'milestone' ? 'Per Milestone' : 'End of Project'}`, { continued: false });
      doc.text(`Payment Terms: ${contractData.paymentTerms || 'Net 30'}`);
      if (contractData.hourlyRate) {
        doc.text(`Hourly Rate: RM${contractData.hourlyRate}/hour`);
      }
      doc.moveDown(2);

      // Billable hours cap (if enabled)
      if (contractData.enableBillableHours && contractData.maxBillableHours) {
        doc.fontSize(12).font('Helvetica-Bold').text('BILLABLE HOURS CAP:', { continued: false });
        doc.fontSize(10).font('Helvetica');
        doc.text(`Maximum Billable Hours: ${contractData.maxBillableHours} hours`);
        doc.moveDown(2);
      }

      // Terms and conditions
      if (contractData.terms || contractData.additionalTerms) {
        doc.fontSize(14).font('Helvetica-Bold').text('TERMS & CONDITIONS:', { continued: false });
        doc.moveDown();
        doc.fontSize(9).font('Helvetica');
        const terms = contractData.terms || contractData.additionalTerms || '';
        const termsLines = terms.split('\n');
        termsLines.forEach(line => {
          doc.text(line, { align: 'justify', width: 480 });
        });
        doc.moveDown(2);
      }

      // Signatures
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('SIGNATURES:', { continued: false });
      doc.moveDown(2);

      // Freelancer signature
      doc.fontSize(12).font('Helvetica-Bold').text('Freelancer:', { continued: false });
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${contractData.freelancerName || ''}`);
      if (contractData.freelancerSignature) {
        doc.text(`Signature: ${contractData.freelancerSignature}`);
      }
      if (contractData.freelancerSignedAt) {
        const signedDate = contractData.freelancerSignedAt.toDate ? 
                          contractData.freelancerSignedAt.toDate() : 
                          new Date(contractData.freelancerSignedAt);
        doc.text(`Date: ${signedDate.toLocaleDateString()}`);
      }
      doc.moveDown(2);

      // Client signature
      doc.fontSize(12).font('Helvetica-Bold').text('Client:', { continued: false });
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${contractData.clientName || ''}`);
      if (contractData.clientSignature) {
        doc.text(`Signature: ${contractData.clientSignature}`);
      }
      if (contractData.clientSignedAt) {
        const signedDate = contractData.clientSignedAt.toDate ? 
                          contractData.clientSignedAt.toDate() : 
                          new Date(contractData.clientSignedAt);
        doc.text(`Date: ${signedDate.toLocaleDateString()}`);
      }

      // Footer
      doc.fontSize(8).font('Helvetica').fillColor('gray');
      doc.text('This is a legally binding agreement. Both parties agree to the terms outlined above.', 50, 750, { align: 'center', width: 480 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateInvoicePDFBase64,
  generateContractPDFBase64
};

