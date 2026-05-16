import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PayrollEntry } from './entities/payroll-entry.entity';
import { Employee } from '../employees/entities/employee.entity';

export interface PayslipAdvanceItem {
  expenseId: string;
  expenseDate: Date | string;
  amount: number;
  description: string;
}

export interface PayslipAdvanceData {
  advances: PayslipAdvanceItem[];
  advancesSubtotal: number;
  carryForwardIn: number;
  carryForwardOut: number;
}

@Injectable()
export class PdfService {
  async generatePayslip(
    payrollEntry: PayrollEntry & { employee?: Employee },
    month: number,
    year: number,
    advanceData?: PayslipAdvanceData
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const employee = payrollEntry.employee;
        const monthNames = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        const monthName = monthNames[month - 1];

        // Colors
        const borderColor = '#000000';

        // Header - Company Name
        doc.fontSize(20).font('Helvetica-Bold').text('SAGUN MOLDIFY', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').text('Salary Slip / Paystub', { align: 'center' });
        doc.moveDown(2);

        // Month and Year
        doc.fontSize(14).font('Helvetica-Bold').text(`${monthName} - ${year}`, { align: 'center' });
        doc.moveDown(2);

        // Draw border
        doc.rect(50, doc.y, 495, 0).strokeColor(borderColor).stroke();
        doc.moveDown(1);

        // Employee Details Section
        doc.fontSize(12).font('Helvetica-Bold').text('Employee Details:', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica');
        const employeeDetails = [
          ['Employee Name:', employee?.name || 'N/A'],
          ['Employee ID:', employee?.id?.substring(0, 8).toUpperCase() || 'N/A'],
          ['Designation:', employee?.designation || 'N/A'],
          ['Employee Type:', employee?.employeeType || 'N/A'],
        ];

        let yPos = doc.y;
        employeeDetails.forEach(([label, value]) => {
          doc.text(label, 50, yPos, { continued: true });
          doc.text(value, { align: 'left' });
          yPos += 15;
        });

        doc.moveDown(2);

        // Earnings Section
        doc.fontSize(12).font('Helvetica-Bold').text('Earnings:', { underline: true });
        doc.moveDown(0.5);

        // Table Header
        const tableTop = doc.y;
        doc.rect(50, tableTop, 495, 20).fill('#f0f0f0').stroke();

        doc.fontSize(10).font('Helvetica-Bold');
        doc.fillColor('#000000');
        doc.text('Description', 55, tableTop + 5, { width: 200 });
        doc.text('Days/Rate', 280, tableTop + 5, { width: 100 });
        doc.text('Amount (₹)', 400, tableTop + 5, { width: 140, align: 'right' });

        doc.moveDown(2);

        // Earnings Data
        doc.font('Helvetica').fontSize(10);
        const earnings = [
          {
            description: 'Monthly Salary',
            rate: '30 days',
            amount: Number(employee?.monthlySalary) || 0,
          },
          {
            description: 'Working Days',
            rate: `${payrollEntry.workingDays} days`,
            amount: Number(payrollEntry.baseSalary),
          },
        ];

        if (payrollEntry.overtimeAmount > 0) {
          earnings.push({
            description: `Overtime (${payrollEntry.overtimeMultiplier}x)`,
            rate: `${payrollEntry.overtimeDays} days`,
            amount: Number(payrollEntry.overtimeAmount),
          });
        }

        let y = tableTop + 25;
        earnings.forEach(item => {
          doc.text(item.description, 55, y, { width: 200 });
          doc.text(item.rate, 280, y, { width: 100 });
          doc.text(`₹${item.amount.toFixed(2)}`, 400, y, { width: 140, align: 'right' });
          y += 18;
        });

        // Total Earnings
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Gross Salary:', 280, y, { width: 115 });
        doc.text(`₹${Number(payrollEntry.grossSalary).toFixed(2)}`, 400, y, {
          width: 140,
          align: 'right',
        });

        doc.moveDown(2);

        // Deductions Section
        y += 25;
        doc.font('Helvetica-Bold').fontSize(12).text('Deductions:', { underline: true });
        doc.moveDown(0.5);

        const deductions = [
          {
            description: 'Half Day Deductions',
            rate: `${payrollEntry.halfDayCount} days`,
            amount: Number(payrollEntry.halfDaysDeduction),
          },
        ];

        // Add carry-forward from previous month if applicable
        if (advanceData && advanceData.carryForwardIn > 0) {
          deductions.push({
            description: 'Carry-forward from previous month',
            rate: '-',
            amount: advanceData.carryForwardIn,
          });
        }

        // Add individual Employee Advance line items
        if (advanceData && advanceData.advances.length > 0) {
          advanceData.advances.forEach(advance => {
            const dateStr = typeof advance.expenseDate === 'string'
              ? advance.expenseDate.substring(0, 10)
              : new Date(advance.expenseDate).toISOString().split('T')[0];
            deductions.push({
              description: `Advance (${dateStr}): ${advance.description}`,
              rate: '-',
              amount: advance.amount,
            });
          });

          // Add Total Advances Deducted row
          deductions.push({
            description: 'Total Advances Deducted',
            rate: '-',
            amount: advanceData.advancesSubtotal,
          });
        }

        doc.font('Helvetica').fontSize(10);
        y = doc.y;
        deductions.forEach(item => {
          doc.text(item.description, 55, y, { width: 200 });
          doc.text(item.rate, 280, y, { width: 100 });
          doc.text(`₹${item.amount.toFixed(2)}`, 400, y, { width: 140, align: 'right' });
          y += 18;
        });

        // Total Deductions
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Total Deductions:', 280, y, { width: 115 });
        doc.text(
          `₹${Number(payrollEntry.deductions + payrollEntry.halfDaysDeduction).toFixed(2)}`,
          400,
          y,
          { width: 140, align: 'right' }
        );

        doc.moveDown(2);

        // Net Salary (Highlighted)
        y += 30;
        doc.rect(50, y, 495, 35).fill('#000000').stroke();
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#ffffff');
        doc.text('NET SALARY:', 60, y + 10, { width: 200 });
        doc.text(`₹${Number(payrollEntry.netSalary).toFixed(2)}`, 300, y + 10, {
          width: 240,
          align: 'right',
        });

        doc.moveDown(4);

        // Carry-forward to next month footer note
        if (advanceData && advanceData.carryForwardOut > 0) {
          doc.moveDown(1);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
          doc.text(
            `Note: ₹${advanceData.carryForwardOut.toFixed(2)} carried forward to next month (advance exceeds salary).`,
            { align: 'center' }
          );
          doc.moveDown(1);
        }

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text('This is a computer-generated document. No signature required.', {
          align: 'center',
        });
        doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });

        // Finalize
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  getFilename(employeeName: string, employeeId: string, month: number, year: number): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const sanitizedName = employeeName.replace(/[^a-zA-Z0-9]/g, '_');
    const shortId = employeeId.substring(0, 8).toUpperCase();
    return `${sanitizedName}_${shortId}_${monthNames[month - 1]}_${year}.pdf`;
  }
}
