import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import logo from "@/assets/logo.png";

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
    borderBottom: '2px solid #000000',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ff0000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  companyInfo: {
    marginTop: 16,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 1.4,
  },
  headerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
    // gap: 170,
  },
  headerDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerDetailsColumn: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    // gap: 10,
  },
  headerDetailsColumnBottom: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    // gap: 10,
  },
  headerDetailsColumnText: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.4,
  },
  companyAddressText: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.4,
    textAlign: 'right',
  },
  headerDetailsText: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.4,
  },
  headerDetailsTextContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    // gap: 10,
  },
  headerRow: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    borderBottom: '2px solid #000000',
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
    // justifyContent: 'space-between',
    alignItems: 'stretch',
    backgroundColor: '#4a6d8c',
    // gap: 10,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    padding: 4,
    textAlign: 'center',
    // borderBottom: '1px solid #E5E7EB',
  },
  tableNoteText: {
    fontSize: 8,
    color: '#525252',
    padding: 4,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  tableBody: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    // gap: 10,
  },
  tableRow: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    alignItems: 'stretch',
    // gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#bfccda',
  },
  tableCell: {
    fontSize: 8,
    color: '#374151',
    padding: 4,
    textAlign: 'center',
  },
  borderRight: {
    borderRightWidth: 1,
    borderRightColor: '#bfccda',
  },
  col1: { width: '20%' },
  col2: { width: '30%' },
  col3: { width: '16%' },
  col4: { width: '18%' },
  col5: { width: '16%' },
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
  paymentDetailsBottomBorder:{
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: 5,
  },
  logoHeaderRow: {
    flex: 1,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 230,
    marginBottom: 10,
  },
  mechlinLogo: {
    width: 196.5,
    height: 45
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoSubtext: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  headerText: {
    flex: 1,
    marginLeft: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottom: '1px solid #E5E7EB',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  column: {
    flex: 1,
    marginRight: 16,
  },
  lastColumn: {
    flex: 1,
    marginRight: 0,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  value: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 1.3,
  },
  PaymentContainer: {
    marginTop: 20,
  },
  PaymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    display: 'flex',
    padding: 2,
    border: '2px solid #000000',
  },
  paymentDetailsTextContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  paymentDetailsColumn: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flex: 1,
    padding: 10,
    // borderRight: '2px solid #000000',
    // gap: 10,
  },
  paymentDetailsColumnText: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.4,
    textAlign: 'left',
  },
  totalBox: {
    backgroundColor: '#F1F5F9',
    padding: 24,
    borderRadius: 8,
    border: '2px solid #CBD5E1',
    marginBottom: 24,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  dueDateBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 6,
    border: '1px solid #F59E0B',
    marginTop: 8,
  },
  dueDateText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  notesSection: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    marginBottom: 24,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 1.4,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    borderTop: '1px solid #E5E7EB',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#9CA3AF',
  },
});

// Default table data if not provided in invoice
const defaultTableData = [
    {task: 'Task 1', description: 'Description 1', hours: 10, ratePerHour: 100},
    {task: 'Task 2', description: 'Description 2', hours: 20, ratePerHour: 200},
    {task: 'Task 3', description: 'Description 3', hours: 30, ratePerHour: 300},
  ];

interface LLCConfig {
  ach?: {
    bank_name?: string;
    account_name?: string;
    ach_routing_number?: string;
    account_number?: string;
  };
  wire?: {
    bank_name?: string;
    account_name?: string;
    wire_routing_number?: string;
    account_number?: string;
    domestic_swift_code?: string;
    foreign_swift_code?: string;
  };
  email?: string;
}

interface InvoicePDFTemplateProps {
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
  llcConfig?: LLCConfig | null;
}

export const InvoicePDFTemplate: React.FC<InvoicePDFTemplateProps> = ({ invoice, llcConfig }) => {
  // Use LLC config if available, otherwise use defaults
  const achConfig = llcConfig?.ach || {};
  const wireConfig = llcConfig?.wire || {};
  const llcEmail = llcConfig?.email || 'Invoice@mechlintech.com';

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
                <View style={styles.headerDetailsRow}>
                    <Text style={styles.headerDetailsText}>Invoice to: </Text>
                    <View style={styles.headerDetailsTextContainer}>
                        <Text style={styles.headerDetailsText}>{invoice.client_name || 'Client Name'}</Text>
                        <Text style={styles.headerDetailsText}>{invoice.client_address || 'Client Address'}</Text>
                        <Text style={styles.headerDetailsText}>{invoice.client_state && invoice.client_zip_code ? `${invoice.client_state}, ${invoice.client_zip_code}` : 'State and Zip Code'}</Text>
                    </View>
                </View>
                <View style={styles.headerDetailsColumn}>
                    <Text style={styles.companyAddressText}>Mechlin Technologies LLC</Text>
                    <Text style={styles.companyAddressText}>548 Market St</Text>
                    <Text style={styles.companyAddressText}>San Francisco, CA 94104</Text>
                    <Text style={styles.companyAddressText}>United States</Text>
                    <Text style={styles.companyAddressText}>TEL : +1 (805) 776-3451</Text>
                    <Text style={styles.companyAddressText}>Email: {llcEmail}</Text>
                </View>
            </View>

            <View style={styles.headerDetailsColumnBottom}>
                <Text style={styles.headerDetailsColumnText}>Invoice No:  {invoice.invoice_number}</Text>
                <Text style={styles.headerDetailsColumnText}>Invoice Date:  {invoice.invoice_date}</Text>
                {/* <Text style={styles.headerDetailsColumnText}>Due Date:  {invoice.due_date}</Text>
                {invoice.project && (
                  <Text style={styles.headerDetailsColumnText}>Project:  {invoice.project}</Text>
                )}
                {invoice.billing_reference && (
                  <Text style={styles.headerDetailsColumnText}>Reference:  {invoice.billing_reference}</Text>
                )}
                {invoice.service_period_start && invoice.service_period_end && (
                  <Text style={styles.headerDetailsColumnText}>
                    Service Period:  {invoice.service_period_start} - {invoice.service_period_end}
                  </Text>
                )}
                <Text style={styles.headerDetailsColumnText}>Payment Terms:  {invoice.payment_terms?.replace('_', ' ') || 'Net 30'}</Text> */}
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
                    <Text style={styles.summaryLabel}>Total ({invoice.currency || 'USD'}) $:</Text>
                    <Text style={styles.summaryValue}>{total.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount Paid ({invoice.currency || 'USD'}) $:</Text>
                    <Text style={styles.summaryValue}>{amountPaid > 0 ? amountPaid.toFixed(2) : '-'}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Balance Due ({invoice.currency || 'USD'}) $:</Text>
                    <Text style={styles.summaryValue}>{balanceDue.toFixed(2)}</Text>
                </View>
            </View>
        </View>

        <Text style={styles.tableNoteText}>When submitting payments electronically, please email to {llcEmail}</Text>

        <View style={styles.PaymentContainer}>
            <View style={styles.PaymentDetails}>
                <View style={[styles.paymentDetailsColumn, styles.borderRight]}>
                    <Text style={[styles.paymentDetailsColumnText, styles.paymentDetailsBottomBorder]}>Pay By ACH (Preferred):</Text>
                    <View style={styles.headerDetailsTextContainer}>
                        <Text style={styles.paymentDetailsColumnText}>Bank Name: {achConfig.bank_name || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Account Name: {achConfig.account_name || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>ACH Routing Number: {achConfig.ach_routing_number || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Account Number: {achConfig.account_number || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Reference: {invoice.reference_invoice_numbers?.join(', ') || ''}</Text>
                    </View>
                </View>
                <View style={styles.paymentDetailsColumn}>
                    <Text style={[styles.paymentDetailsColumnText, styles.paymentDetailsBottomBorder]}>Pay By Wire:</Text>
                    <View style={styles.headerDetailsTextContainer}>
                        <Text style={styles.paymentDetailsColumnText}>Bank Name: {wireConfig.bank_name || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Account Name: {wireConfig.account_name || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Wire Routing Number: {wireConfig.wire_routing_number || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Account Number: {wireConfig.account_number || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Domestic SWIFT Code: {wireConfig.domestic_swift_code || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Foreign SWIFT Code: {wireConfig.foreign_swift_code || ''}</Text>
                        <Text style={styles.paymentDetailsColumnText}>Reference: {invoice.reference_invoice_numbers?.join(', ') || ''}</Text>
                    </View>
                </View>
            </View>
        </View>

        {/* Notes */}
        {/* {(invoice.notes || invoice.notes_to_finance) && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            {invoice.notes && (
              <Text style={styles.notesText}>{invoice.notes}</Text>
            )}
            {invoice.notes_to_finance && (
              <Text style={styles.notesText}>{invoice.notes_to_finance}</Text>
            )}
          </View>
        )} */}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for your business.
          </Text>
          <Text style={styles.footerText}>
            For questions about this invoice, please contact us at {llcEmail}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
