import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// PDF Generator for Invoices
export class InvoicePDFGenerator {
  constructor() {
    this.doc = new jsPDF();
  }

  // Generate invoice PDF
  generateInvoicePDF(invoice) {
    const doc = new jsPDF();
    
    // Set up the document
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 20, 30);
    
    // Invoice number and date
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 50);
    doc.text(`Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 20, 60);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 20, 70);
    
    // Freelancer information
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('From:', 20, 90);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.freelancerName, 20, 100);
    if (invoice.freelancerEmail) {
      doc.text(invoice.freelancerEmail, 20, 110);
    }
    if (invoice.freelancerAddress) {
      const addressLines = invoice.freelancerAddress.split('\n');
      addressLines.forEach((line, index) => {
        doc.text(line, 20, 120 + (index * 10));
      });
    }
    
    // Client information
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('To:', 120, 90);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.clientName, 120, 100);
    if (invoice.clientEmail) {
      doc.text(invoice.clientEmail, 120, 110);
    }
    if (invoice.clientAddress) {
      const addressLines = invoice.clientAddress.split('\n');
      addressLines.forEach((line, index) => {
        doc.text(line, 120, 120 + (index * 10));
      });
    }
    
    // Project information
    if (invoice.projectTitle) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Project: ${invoice.projectTitle}`, 20, 160);
    }
    
    // Line items table
    const tableData = invoice.lineItems.map(item => [
      item.description,
      item.quantity,
      `RM${item.rate.toFixed(2)}`,
      `RM${item.amount.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      head: [['Description', 'Qty', 'Rate', 'Amount']],
      body: tableData,
      startY: 180,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });
    
    // Get the final Y position after the table
    const finalY = doc.lastAutoTable.finalY || 200;
    
    // Totals
    const totalsY = finalY + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', 150, totalsY);
    doc.text(`RM${invoice.subtotal.toFixed(2)}`, 170, totalsY);
    
    if (invoice.taxAmount > 0) {
      doc.text(`Tax (${(invoice.taxRate * 100).toFixed(1)}%):`, 150, totalsY + 10);
      doc.text(`RM${invoice.taxAmount.toFixed(2)}`, 170, totalsY + 10);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total:', 150, totalsY + 25);
    doc.text(`RM${invoice.totalAmount.toFixed(2)}`, 170, totalsY + 25);
    
    // Payment terms
    if (invoice.paymentTerms) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Payment Terms: ${invoice.paymentTerms}`, 20, totalsY + 50);
    }
    
    // Notes
    if (invoice.notes) {
      doc.text('Notes:', 20, totalsY + 70);
      const notesLines = invoice.notes.split('\n');
      notesLines.forEach((line, index) => {
        doc.text(line, 20, totalsY + 80 + (index * 10));
      });
    }
    
    // Terms and conditions
    if (invoice.terms) {
      doc.setFontSize(8);
      doc.text('Terms and Conditions:', 20, totalsY + 120);
      const termsLines = invoice.terms.split('\n');
      termsLines.forEach((line, index) => {
        doc.text(line, 20, totalsY + 130 + (index * 5));
      });
    }
    
    return doc;
  }

  // Download PDF
  downloadPDF(invoice, filename = null) {
    const doc = this.generateInvoicePDF(invoice);
    const fileName = filename || `invoice-${invoice.invoiceNumber}.pdf`;
    doc.save(fileName);
  }

  // Generate PDF blob for email attachment
  generatePDFBlob(invoice) {
    const doc = this.generateInvoicePDF(invoice);
    return doc.output('blob');
  }
}

// Utility functions
export const generateInvoicePDF = (invoice) => {
  const generator = new InvoicePDFGenerator();
  return generator.generateInvoicePDF(invoice);
};

export const downloadInvoicePDF = (invoice, filename = null) => {
  const generator = new InvoicePDFGenerator();
  generator.downloadPDF(invoice, filename);
};

export const generateInvoicePDFBlob = (invoice) => {
  const generator = new InvoicePDFGenerator();
  return generator.generatePDFBlob(invoice);
};