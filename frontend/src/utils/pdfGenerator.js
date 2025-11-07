import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 20, 30);

    // Invoice number and date
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice #: ${invoice.invoiceNumber || "N/A"}`, 20, 50);
    doc.text(
      `Date: ${invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : "N/A"}`,
      20,
      60,
    );
    doc.text(
      `Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A"}`,
      20,
      70,
    );

    // Freelancer information
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("From:", 20, 90);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.freelancerName || "", 20, 100);
    if (invoice.freelancerEmail) {
      doc.text(invoice.freelancerEmail, 20, 110);
    }
    if (invoice.freelancerAddress) {
      const addressLines = invoice.freelancerAddress.split("\n");
      addressLines.forEach((line, index) => {
        doc.text(line, 20, 120 + index * 10);
      });
    }

    // Client information
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("To:", 120, 90);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.clientName || "", 120, 100);
    if (invoice.clientEmail) {
      doc.text(invoice.clientEmail, 120, 110);
    }
    if (invoice.clientAddress) {
      const addressLines = invoice.clientAddress.split("\n");
      addressLines.forEach((line, index) => {
        doc.text(line, 120, 120 + index * 10);
      });
    }

    // Project information
    if (invoice.projectTitle) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Project: ${invoice.projectTitle}`, 20, 160);
    }

    // Line items table
    const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
    const tableData = lineItems.map((item) => [
      item.description || "",
      item.quantity != null ? item.quantity : "",
      item.rate != null ? `RM${Number(item.rate).toFixed(2)}` : "",
      item.amount != null ? `RM${Number(item.amount).toFixed(2)}` : "",
    ]);

    autoTable(doc, {
      head: [["Description", "Qty", "Rate", "Amount"]],
      body: tableData.length > 0 ? tableData : [["No items", "", "", ""]],
      startY: 180,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });

    // Get the final Y position after the table
    const finalY = doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : 200;

    // Totals
    const totalsY = finalY + 20;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", 150, totalsY);
    doc.text(`RM${invoice.subtotal != null ? Number(invoice.subtotal).toFixed(2) : "0.00"}`, 170, totalsY);

    if (invoice.taxAmount > 0) {
      doc.text(
        `Tax (${invoice.taxRate != null ? (Number(invoice.taxRate) * 100).toFixed(1) : "0.0"}%):`,
        150,
        totalsY + 10,
      );
      doc.text(`RM${Number(invoice.taxAmount).toFixed(2)}`, 170, totalsY + 10);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Total:", 150, totalsY + 25);
    doc.text(`RM${invoice.totalAmount != null ? Number(invoice.totalAmount).toFixed(2) : "0.00"}`, 170, totalsY + 25);

    // Payment terms
    if (invoice.paymentTerms) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Payment Terms: ${invoice.paymentTerms}`, 20, totalsY + 50);
    }

    // Notes
    if (invoice.notes) {
      doc.text("Notes:", 20, totalsY + 70);
      const notesLines = invoice.notes.split("\n");
      notesLines.forEach((line, index) => {
        doc.text(line, 20, totalsY + 80 + index * 10);
      });
    }

    // Terms and conditions
    if (invoice.terms) {
      doc.setFontSize(8);
      doc.text("Terms and Conditions:", 20, totalsY + 120);
      const termsLines = invoice.terms.split("\n");
      termsLines.forEach((line, index) => {
        doc.text(line, 20, totalsY + 130 + index * 5);
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
    return doc.output("blob");
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

// Contract PDF Generator
export class ContractPDFGenerator {
  constructor() {
    this.doc = new jsPDF();
  }

  // Generate contract PDF
  generateContractPDF(contract, project, freelancer, client) {
    const doc = new jsPDF();

    // Set up the document
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("SERVICE CONTRACT", 105, 30, { align: "center" });

    // Contract title
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text(contract.title || "Project Contract", 105, 45, {
      align: "center",
    });

    // Date and status
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const createdDate = contract.createdAt?.toDate
      ? contract.createdAt.toDate()
      : new Date();
    doc.text(`Contract Date: ${createdDate.toLocaleDateString()}`, 20, 60);
    doc.text(`Status: ${contract.status?.toUpperCase() || "PENDING"}`, 150, 60);

    // Parties Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PARTIES TO THIS AGREEMENT", 20, 75);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Freelancer information
    doc.setFont("helvetica", "bold");
    doc.text("Service Provider (Freelancer):", 20, 90);
    doc.setFont("helvetica", "normal");
    doc.text(contract.freelancerName || freelancer?.username || "N/A", 20, 97);
    if (freelancer?.email) {
      doc.text(`Email: ${freelancer.email}`, 20, 104);
    }
    if (
      contract.freelancerAddress &&
      contract.freelancerAddress !== "Address not provided"
    ) {
      const addressLines = contract.freelancerAddress.split("\n");
      addressLines.forEach((line, index) => {
        doc.text(line, 20, 111 + index * 7);
      });
    }

    // Client information
    doc.setFont("helvetica", "bold");
    doc.text("Client:", 120, 90);
    doc.setFont("helvetica", "normal");
    doc.text(contract.clientName || client?.username || "Pending", 120, 97);
    if (project?.clientEmail || client?.email) {
      doc.text(`Email: ${project?.clientEmail || client?.email}`, 120, 104);
    }
    if (contract.clientAddress) {
      const addressLines = contract.clientAddress.split("\n");
      addressLines.forEach((line, index) => {
        doc.text(line, 120, 111 + index * 7);
      });
    }

    // Scope of Work
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("SCOPE OF WORK", 20, 140);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const scopeText = doc.splitTextToSize(
      contract.scope || "No scope defined",
      170,
    );
    doc.text(scopeText, 20, 150);

    let currentY = 150 + scopeText.length * 7;

    // Payment Terms
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT TERMS", 20, currentY + 10);
    currentY += 20;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    if (contract.hourlyRate) {
      doc.text(`Hourly Rate: RM${contract.hourlyRate}/hour`, 20, currentY);
      currentY += 7;
    }
    if (contract.fixedPrice) {
      doc.text(`Fixed Price: RM${contract.fixedPrice}`, 20, currentY);
      currentY += 7;
    }
    if (contract.depositAmount) {
      doc.text(`Deposit Amount: RM${contract.depositAmount}`, 20, currentY);
      currentY += 7;
    }

    const paymentTermsText = doc.splitTextToSize(
      contract.paymentTerms || "Payment upon completion",
      170,
    );
    doc.text(paymentTermsText, 20, currentY);
    currentY += paymentTermsText.length * 7 + 10;

    // Timeline
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PROJECT TIMELINE", 20, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const startDate = contract.startDate?.toDate
      ? contract.startDate.toDate()
      : new Date(contract.startDate);
    doc.text(`Start Date: ${startDate.toLocaleDateString()}`, 20, currentY);
    currentY += 7;

    if (contract.endDate) {
      const endDate = contract.endDate?.toDate
        ? contract.endDate.toDate()
        : new Date(contract.endDate);
      doc.text(`End Date: ${endDate.toLocaleDateString()}`, 20, currentY);
      currentY += 7;
    }

    // Milestones (if any)
    if (contract.milestones && contract.milestones.length > 0) {
      currentY += 5;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PROJECT MILESTONES", 20, currentY);
      currentY += 10;

      const milestoneData = contract.milestones.map((milestone, index) => [
        `${index + 1}. ${milestone.name}`,
        milestone.dueDate
          ? new Date(milestone.dueDate).toLocaleDateString()
          : "TBD",
        `RM${milestone.amount?.toFixed(2) || "0.00"}`,
        `${milestone.percentage || 0}%`,
      ]);

      autoTable(doc, {
        head: [["Milestone", "Due Date", "Amount", "Percentage"]],
        body: milestoneData,
        startY: currentY,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "center" },
        },
      });

      currentY = doc.lastAutoTable.finalY + 10;
    }

    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    // Additional Terms
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ADDITIONAL TERMS AND CONDITIONS", 20, currentY);
    currentY += 10;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    if (contract.revisionPolicy) {
      doc.setFont("helvetica", "bold");
      doc.text("Revision Policy:", 20, currentY);
      doc.setFont("helvetica", "normal");
      currentY += 5;
      const revisionText = doc.splitTextToSize(contract.revisionPolicy, 170);
      doc.text(revisionText, 20, currentY);
      currentY += revisionText.length * 5 + 5;
    }

    if (contract.terminationClause) {
      doc.setFont("helvetica", "bold");
      doc.text("Termination Clause:", 20, currentY);
      doc.setFont("helvetica", "normal");
      currentY += 5;
      const terminationText = doc.splitTextToSize(
        contract.terminationClause,
        170,
      );
      doc.text(terminationText, 20, currentY);
      currentY += terminationText.length * 5 + 5;
    }

    if (contract.confidentialityClause) {
      doc.setFont("helvetica", "bold");
      doc.text("Confidentiality:", 20, currentY);
      doc.setFont("helvetica", "normal");
      currentY += 5;
      const confidentialityText = doc.splitTextToSize(
        contract.confidentialityClause,
        170,
      );
      doc.text(confidentialityText, 20, currentY);
      currentY += confidentialityText.length * 5 + 5;
    }

    if (contract.intellectualPropertyClause) {
      doc.setFont("helvetica", "bold");
      doc.text("Intellectual Property:", 20, currentY);
      doc.setFont("helvetica", "normal");
      currentY += 5;
      const ipText = doc.splitTextToSize(
        contract.intellectualPropertyClause,
        170,
      );
      doc.text(ipText, 20, currentY);
      currentY += ipText.length * 5 + 10;
    }

    // Check if we need a new page for signatures
    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }

    // Signatures Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("SIGNATURES", 20, currentY);
    currentY += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Freelancer signature
    doc.text("Service Provider (Freelancer):", 20, currentY);
    currentY += 7;
    if (contract.freelancerSignature) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(14);
      doc.text(contract.freelancerSignature, 20, currentY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      currentY += 7;
      const signedDate = contract.freelancerSignedAt?.toDate
        ? contract.freelancerSignedAt.toDate()
        : new Date(contract.freelancerSignedAt);
      doc.text(`Signed: ${signedDate.toLocaleString()}`, 20, currentY);
    } else {
      doc.text("_________________________________", 20, currentY);
      currentY += 7;
      doc.text("(Signature pending)", 20, currentY);
    }

    currentY += 15;

    // Client signature
    doc.text("Client:", 20, currentY);
    currentY += 7;
    if (contract.clientSignature) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(14);
      doc.text(contract.clientSignature, 20, currentY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      currentY += 7;
      const signedDate = contract.clientSignedAt?.toDate
        ? contract.clientSignedAt.toDate()
        : new Date(contract.clientSignedAt);
      doc.text(`Signed: ${signedDate.toLocaleString()}`, 20, currentY);
    } else {
      doc.text("_________________________________", 20, currentY);
      currentY += 7;
      doc.text("(Signature pending)", 20, currentY);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      "This is a legally binding contract. Both parties should retain a copy for their records.",
      105,
      280,
      { align: "center" },
    );

    return doc;
  }

  // Download PDF
  downloadPDF(contract, project, freelancer, client, filename = null) {
    const doc = this.generateContractPDF(contract, project, freelancer, client);
    const fileName = filename || `contract-${contract.id || "document"}.pdf`;
    doc.save(fileName);
  }

  // Generate PDF blob for email attachment
  generatePDFBlob(contract, project, freelancer, client) {
    const doc = this.generateContractPDF(contract, project, freelancer, client);
    return doc.output("blob");
  }
}

// Contract utility functions
export const downloadContractPDF = (
  contract,
  project,
  freelancer,
  client,
  filename = null,
) => {
  const generator = new ContractPDFGenerator();
  generator.downloadPDF(contract, project, freelancer, client, filename);
};

export const generateContractPDFBlob = (
  contract,
  project,
  freelancer,
  client,
) => {
  const generator = new ContractPDFGenerator();
  return generator.generatePDFBlob(contract, project, freelancer, client);
};
