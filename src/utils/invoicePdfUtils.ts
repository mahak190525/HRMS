import React from 'react';
import { supabase } from '@/services/supabase';

// Dynamic import to handle potential module resolution issues
const loadReactPDF = async () => {
  try {
    const reactPDF = await import('@react-pdf/renderer');
    return reactPDF;
  } catch (error) {
    console.error('Failed to load @react-pdf/renderer:', error);
    throw new Error('PDF library not available. Please ensure @react-pdf/renderer is properly installed.');
  }
};

/**
 * Fetches app configuration from app_config table
 * @returns Promise that resolves with app config data
 */
const fetchAppConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('llc_deets, indian_deets')
      .eq('id', 1)
      .single();

    if (error) {
      console.warn('Failed to fetch app config, using defaults:', error);
      return { llcConfig: null, indianConfig: null };
    }

    return {
      llcConfig: data?.llc_deets || null,
      indianConfig: data?.indian_deets || null
    };
  } catch (error) {
    console.warn('Error fetching app config, using defaults:', error);
    return { llcConfig: null, indianConfig: null };
  }
};


/**
 * Generates a PDF from an invoice using @react-pdf/renderer
 * @param invoice - The invoice data object
 * @returns Promise that resolves when PDF is generated and downloaded
 */

export const generateInvoicePDF = async (invoice: any): Promise<void> => {
  try {
    console.log('Starting PDF generation for invoice:', invoice);
    
    // Validate invoice data
    if (!invoice) {
      throw new Error('Invoice data is required');
    }
    
    // Fetch app config (both LLC and Indian configs)
    const { llcConfig, indianConfig } = await fetchAppConfig();
    console.log('App config fetched:', { llcConfig, indianConfig });
    
    // Load react-pdf dynamically
    const reactPDF = await loadReactPDF();
    console.log('React PDF loaded successfully');
    
    // Determine which template to use based on invoice type
    const isIndianInvoice = invoice.invoice_type === 'Mechlin Indian';
    
    let pdfDocument;
    
    if (isIndianInvoice) {
      // Import the Indian InvoicePDFTemplate component dynamically
      const { InvoicePDFTemplateIndian } = await import('../components/invoice/InvoicePDFTemplateIndian');
      console.log('InvoicePDFTemplateIndian imported successfully');
      
      // Create the PDF document using the Indian template
      pdfDocument = React.createElement(InvoicePDFTemplateIndian, { invoice, indianConfig });
    } else {
      // Import the LLC InvoicePDFTemplate component dynamically
      const { InvoicePDFTemplate } = await import('../components/invoice/InvoicePDFTemplate');
      console.log('InvoicePDFTemplate imported successfully');
      
      // Create the PDF document using the LLC template
      pdfDocument = React.createElement(InvoicePDFTemplate, { invoice, llcConfig });
    }
    
    console.log('PDF document element created for type:', invoice.invoice_type);
    
    const blob = await reactPDF.pdf(pdfDocument as any).toBlob();
    console.log('PDF blob created successfully:', blob);
    
    // Generate filename with invoice number if available
    const invoiceIdentifier = invoice.invoice_number || invoice.invoice_title || 'invoice';
    const filename = `${invoiceIdentifier.replace(/[^a-z0-9\s]/gi, '_')}_${Date.now()}.pdf`;
    console.log('Generated filename:', filename);
    
    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('PDF download initiated successfully');
  } catch (error: any) {
    console.error('Detailed error generating PDF:', error);
    console.error('Error stack:', error?.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error occurred';
    if (error?.message?.includes('Cannot read properties')) {
      errorMessage = 'Invalid invoice data - some required fields are missing or null';
    } else if (error?.message?.includes('getTime')) {
      errorMessage = 'Invalid date format in invoice data';
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    throw new Error(`Failed to generate PDF: ${errorMessage}`);
  }
};

/**
 * Alternative function name for backward compatibility
 * @param invoice - The invoice data
 * @returns Promise that resolves when PDF is generated
 */
export const generatePDFFromComponent = async (invoice: any): Promise<void> => {
  return generateInvoicePDF(invoice);
};

