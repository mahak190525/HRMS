import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import logo from "@/assets/colourLogo.png";

// Register NotoSans font for Indian Rupee symbol (₹) support
// Helvetica doesn't include the ₹ symbol, so we need NotoSans for INR invoices
// Font file is in public/fonts/ folder for @react-pdf/renderer to access it
try {
  Font.register({
    family: 'NotoSans',
    src: '/fonts/NotoSans.ttf', // Public folder path
  });
  console.log('NotoSans font registered successfully for ₹ symbol support');
} catch (error) {
  console.warn('NotoSans font registration failed. ₹ symbol may not render correctly.');
  console.warn('Error:', error);
  // Component will still work, but ₹ symbol may not render correctly
}

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 32,
    paddingBottom: 24,
    borderBottom: '2px solid #436784',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#436784',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#436784',
    marginBottom: 4,
  },
  companyInfo: {
    marginTop: 16,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#436784',
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 12,
    color: '#436784',
    lineHeight: 1.4,
  },
  headerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 5,
    borderBottom: '2px solid #436784',
  },
  headerDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 4,
    paddingBottom: 10,
    marginLeft: 40,
  },
  headerDetailsColumn: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  headerDetailsColumnBottom: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  headerDetailsColumnText: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.4,
    color: '#436784',
  },
  companyAddressText: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.4,
    textAlign: 'right',
    color: '#436784',
  },
  headerDetailsText: {
    fontSize: 8,
    color: '#436784',
    lineHeight: 1.4,
  },
  headerDetailsTextContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  headerRow: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 10,
  },
  logoContainer: {
    marginBottom: 16,
  },
  tableSection: {
    marginTop: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bfccda',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#4a6d8c',
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    padding: 4,
    textAlign: 'center',
  },
  tableBody: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#bfccda',
  },
  tableCell: {
    fontSize: 8,
    color: '#374151',
    padding: 4,
    textAlign: 'center',
  },
  col1: { width: '20%' },
  col2: { width: '30%' },
  col3: { width: '16%' },
  col4: { width: '18%' },
  col5: { width: '16%' },
  borderRight: {
    borderRightWidth: 1,
    borderRightColor: '#bfccda',
  },
  summarySection: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
  },
  summaryLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'right',
    marginRight: 10,
  },
  summaryValue: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'right',
    minWidth: 70,
  },
  logoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 5,
    borderBottom: '2px solid #436784',
  },
  mechlinLogo: {
    width: 196.5,
    height: 45
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#436784',
  },
  tableNoteText: {
    fontSize: 8,
    color: '#525252',
    padding: 4,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  PaymentContainer: {
    marginBottom: 24,
    flexDirection: 'row',
    // justifyContent: 'space-between',
    alignItems: 'center',
  },
  PaymentDetails: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'solid',
  },
  paymentDetailsColumn: {
    flex: 1,
    padding: 12,
    flexDirection: 'column',
  },
  paymentDetailsColumnText: {
    fontSize: 8,
    lineHeight: 1.4,
    marginBottom: 2,
    color: '#436784',
  },
  paymentDetailsBottomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    fontWeight: 'bold',
  },
  notesSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  notesText: {
    fontSize: 10,
    lineHeight: 1.4,
    color: '#64748B',
  },
  signatureSection: {
    // marginTop: 24,
    // marginBottom: 16,
    // paddingRight: 40,
    textAlign: 'center',
  },
  signatureText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#436784',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 10,
    textAlign: 'center',
    color: '#000000',
    marginBottom: 8,
  },
  marginTopFooterText: {
    borderTopWidth: 2,
    borderTopColor: '#436784',
    paddingTop: 8,
  },
  boldFont: {
    fontWeight: 'bold',
  },
  blackFont: {
    color: '#000000',
  },
  notoSansFont: {
    fontFamily: 'NotoSans',
    fontWeight: 600,
  }
});

// Default table data for empty invoices
const defaultTableData = [
  { task: 'Sample Task', description: 'Task description', hours: 0, ratePerHour: 0 },
];

interface IndianBankDetails {
  account_name?: string;
  bank_name?: string;
  account_no?: string;
  ifsc_code?: string;
  gstin?: string;
  pan?: string;
  registration_number?: string;
}

interface IndianConfig {
  bank?: IndianBankDetails;
  email?: string;
}

interface InvoicePDFTemplateIndianProps {
  invoice: {
    id?: string;
    invoice_title?: string;
    invoice_number?: string;
    invoice_date?: string;
    due_date?: string;
    client_name?: string;
    client_email?: string;
    client_address?: string;
    client_state?: string;
    client_zip_code?: string;
    project?: string;
    billing_reference?: string;
    reference_invoice_numbers?: Array<string>;
    invoice_amount?: number;
    currency?: string;
    payment_terms?: string;
    invoice_type?: string;
    service_period_start?: string;
    service_period_end?: string;
    assigned_poc?: string;
    notes?: string;
    notes_to_finance?: string;
    status?: string;
    amount_paid?: number;
    amount_received?: number;
    pending_amount?: number;
    payment_receive_date?: string;
    payment_remarks?: string;
    created_at?: string;
    updated_at?: string;
    assigned_finance_poc_user?: {
      full_name?: string;
      email?: string;
    };
    created_by_user?: {
      full_name?: string;
    };
    tasks?: Array<{
      id?: string;
      task_name?: string;
      task_description?: string;
      hours?: number;
      rate_per_hour?: number;
      total_amount?: number;
      display_order?: number;
    }>;
    line_items?: Array<{
      task?: string;
      description?: string;
      hours?: number;
      ratePerHour?: number;
    }>;
  };
  indianConfig?: IndianConfig | null;
}

export const InvoicePDFTemplateIndian: React.FC<InvoicePDFTemplateIndianProps> = ({ invoice, indianConfig }) => {
  // Use Indian config if available, otherwise use defaults
  const bankConfig = indianConfig?.bank || {};
  const indianEmail = indianConfig?.email || 'invoice@mechlintech.com';

  // Use tasks from invoice, or line_items as fallback, or default table data
  const tableData = invoice.tasks && invoice.tasks.length > 0 
    ? invoice.tasks.map(task => ({
        task: task.task_name || '',
        description: task.task_description || '',
        hours: task.hours || 0,
        ratePerHour: task.rate_per_hour || 0
      }))
    : invoice.line_items && invoice.line_items.length > 0 
      ? invoice.line_items 
      : defaultTableData;

  // Use invoice amount if available, otherwise calculate from table data
  const calculatedTotal = tableData.reduce((sum, row) => {
    const amount = (row.hours || 0) * (row.ratePerHour || 0);
    return sum + amount;
  }, 0);
  
  const total = invoice.invoice_amount || calculatedTotal;

  // Get amount paid from invoice (check both amount_paid and amount_received)
  const amountPaid = invoice.amount_received || invoice.amount_paid || 0;

  // Calculate balance due (use pending_amount if available, otherwise calculate)
  const balanceDue = invoice.pending_amount !== null && invoice.pending_amount !== undefined 
    ? invoice.pending_amount 
    : total - amountPaid;

  const currencySign = invoice.currency === 'USD' ? '$' : invoice.currency === 'INR' ? '₹' : invoice.currency === 'EUR' ? '€' : '£';
  const isINR = invoice.currency === 'INR';
  const currencyFontStyle = isINR ? styles.notoSansFont : {};

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
            <View style={styles.logoHeaderRow}>
                <Image
                src={logo} style={styles.mechlinLogo}
                />
                <Text style={styles.logoText}>Invoice</Text>
            </View>

            <View style={styles.headerDetails}>
                <View style={styles.headerDetailsColumn}>
                    <Text style={styles.companyAddressText}>Mechlin Technologies Pvt. Ltd.</Text>
                    <Text style={styles.companyAddressText}>2nd Floor Plot No. 146-147 Sector A</Text>
                    <Text style={styles.companyAddressText}>Shrinath Puram Kota -324005 Rajasthan</Text>
                    <Text style={styles.companyAddressText}>Email: {indianEmail}</Text>
                    {bankConfig.gstin && (
                      <Text style={styles.companyAddressText}>GSTIN: {bankConfig.gstin} | PAN: {bankConfig.pan}</Text>
                    )}
                </View>
                <View style={styles.headerDetailsColumnBottom}>
                    <Text style={styles.headerDetailsColumnText}>Date: {invoice.invoice_date}</Text>
                    <Text style={styles.headerDetailsColumnText}>Invoice #: {invoice.invoice_number}</Text>
                    {invoice.service_period_start && invoice.service_period_end && (
                    <Text style={styles.headerDetailsColumnText}>
                        Service Period: {invoice.service_period_start} to {invoice.service_period_end}
                    </Text>
                    )}
                </View>
            </View>

            <View style={styles.headerDetailsRow}>
                <Text style={[styles.headerDetailsText, styles.boldFont]}>Bill to: </Text>
                <View style={styles.headerDetailsTextContainer}>
                    <Text style={[styles.headerDetailsText, styles.blackFont]}>{invoice.client_name || 'Client Name'}</Text>
                    <Text style={[styles.headerDetailsText, styles.blackFont]}>{invoice.client_address || 'Client Address'}</Text>
                    <Text style={[styles.headerDetailsText, styles.blackFont]}>{invoice.client_state && invoice.client_zip_code ? `${invoice.client_state}, ${invoice.client_zip_code}` : 'State and Zip Code'}</Text>
                </View>
            </View>
        </View>

        {/* Table Section */}
        <View style={styles.tableSection}>
            <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.col1, styles.borderRight]}>Task</Text>
                <Text style={[styles.tableHeaderText, styles.col2, styles.borderRight]}>Description</Text>
                <Text style={[styles.tableHeaderText, styles.col3, styles.borderRight]}>Hours</Text>
                <Text style={[styles.tableHeaderText, styles.col4, styles.borderRight]}>Rate Per Hour</Text>
                <Text style={[styles.tableHeaderText, styles.col5]}>Amount</Text>
            </View>
            <View style={styles.tableBody}>
                {tableData.map((row, index) => (
                    <View style={styles.tableRow} key={index}>
                        <Text style={[styles.tableCell, styles.col1, styles.borderRight]}>{row.task || ''}</Text>
                        <Text style={[styles.tableCell, styles.col2, styles.borderRight]}>{row.description || ''}</Text>
                        <Text style={[styles.tableCell, styles.col3, styles.borderRight]}>{row.hours || 0}</Text>
                        <Text style={[styles.tableCell, styles.col4, styles.borderRight]}>{row.ratePerHour || 0}</Text>
                        <Text style={[styles.tableCell, styles.col5]}>{(row.hours || 0) * (row.ratePerHour || 0)}</Text>
                    </View>
                ))}
            </View>
            
            {/* Summary Section */}
            <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total ({invoice.currency || 'USD'}):</Text>
                    <Text style={[styles.summaryValue, currencyFontStyle]}>{currencySign} {total.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount Paid ({invoice.currency || 'USD'}):</Text>
                    <Text style={[styles.summaryValue, currencyFontStyle]}>{amountPaid > 0 ? `${currencySign} ${amountPaid.toFixed(2)}` : '-'}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Balance Due ({invoice.currency || 'USD'}):</Text>
                    <Text style={[styles.summaryValue, currencyFontStyle]}>{currencySign} {balanceDue.toFixed(2)}</Text>
                </View>
            </View>
        </View>

        {/* Remittance Details */}
        <View style={styles.PaymentContainer}>
            <View style={styles.paymentDetailsColumn}>
                <Text style={[styles.paymentDetailsColumnText, styles.paymentDetailsBottomBorder]}>Remittance Details:</Text>
                <View style={styles.headerDetailsTextContainer}>
                    <Text style={[styles.paymentDetailsColumnText, styles.blackFont]}>Account Name: {bankConfig.account_name || 'XYZ'}</Text>
                    <Text style={[styles.paymentDetailsColumnText, styles.blackFont]}>Bank Name: {bankConfig.bank_name || ''}</Text>
                    <Text style={[styles.paymentDetailsColumnText, styles.blackFont]}>Account No: {bankConfig.account_no || '123456789'}</Text>
                    <Text style={[styles.paymentDetailsColumnText, styles.blackFont]}>IFSC Code: {bankConfig.ifsc_code || ''}</Text>
                </View>
            </View>
            <View style={styles.paymentDetailsColumn}>
                <View style={styles.signatureSection}>
                    <Text style={styles.signatureText}>For Mechlin Technologies</Text>
                    <Text style={styles.signatureText}>Private Limited</Text>
                </View>
            </View>
        </View>
        

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a computer-generated invoice and does not require any signature and stamp.
          </Text>
          <Text style={[styles.footerText, styles.marginTopFooterText]}>
            <Text style={styles.boldFont}>Registration Number: </Text>
            <Text style={styles.footerText}>{bankConfig.registration_number || ''}</Text>
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoicePDFTemplateIndian;
