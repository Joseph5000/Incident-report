/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { IncidentReport } from '../types';
import { format } from 'date-fns';

export async function exportReportPDF(report: IncidentReport) {
  const doc = new jsPDF() as any;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('TACTICAL INCIDENT REPORT', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`CASE ID: INC-${report.tempId.split('-')[0].toUpperCase()}`, 14, 30);
  doc.text(`DATE: ${format(new Date(report.createdAt), 'yyyy-MM-dd HH:mm')}`, 150, 30);

  // Divider
  doc.setDrawColor(241, 245, 249);
  doc.line(14, 35, 196, 35);

  // Info Table
  doc.autoTable({
    startY: 40,
    head: [['Field', 'Information']],
    body: [
      ['Incident Type', report.type],
      ['Location', report.location.address || `${report.location.latitude}, ${report.location.longitude}`],
      ['Status', report.status.toUpperCase()],
      ['Witnesses', (report.witnesses || []).length],
      ['Vehicles', report.vehicles.length],
    ],
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }, // indigo-600
  });

  // Narrative
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('OFFICER NARRATIVE', 14, finalY);
  
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const splitText = doc.splitTextToSize(report.description, 180);
  doc.text(splitText, 14, finalY + 10);

  // Add Signatures
  let currentY = finalY + 20 + (splitText.length * 5);
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('VERIFICATION SIGNATURES', 14, currentY);

  report.signatures.forEach((sig, index) => {
    const sigY = currentY + 10 + (index * 40);
    if (sigY > 260) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(9);
    doc.text(`${sig.type}: ${sig.name}`, 14, sigY + 5);
    try {
      doc.addImage(sig.data, 'PNG', 14, sigY + 8, 50, 20);
    } catch (e) {
      console.warn("Could not add signature image to PDF", e);
    }
  });

  doc.save(`Incident-Report-${report.tempId.split('-')[0]}.pdf`);
}
