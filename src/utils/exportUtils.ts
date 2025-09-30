import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

// Helper function to format date for display
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
};

// Helper function to format currency
const formatCurrency = (amount: number | null) => {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// Asset Assignments Export Functions
export const exportAssetAssignmentsToExcel = (data: any[], filters?: any) => {
  // Transform data for Excel export
  const excelData = data.map(assignment => ({
    'Asset Name': assignment.asset?.name || 'N/A',
    'Asset Tag': assignment.asset?.asset_tag || 'N/A',
    'Asset Category': assignment.asset?.category?.name || 'N/A',
    'Brand': assignment.asset?.brand || 'N/A',
    'Model': assignment.asset?.model || 'N/A',
    'Assigned To': assignment.user?.full_name || 'N/A',
    'Employee ID': assignment.user?.employee_id || 'N/A',
    'Assigned Date': formatDate(assignment.assigned_date),
    'Return Date': formatDate(assignment.return_date),
    'Assigned By': assignment.assigned_by_user?.full_name || 'N/A',
    'Status': assignment.is_active ? 'Active' : (assignment.return_date ? 'Returned' : 'Inactive'),
    'Return Condition': assignment.return_condition || 'N/A',
    'Notes': assignment.notes || 'N/A'
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Asset Assignments');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Asset_Assignments_${timestamp}.xlsx`;

  // Write and download file
  XLSX.writeFile(workbook, filename);
};

export const exportAssetAssignmentsToPDF = (data: any[], filters?: any) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(20);
  doc.text('Asset Assignments Report', 14, 22);
  
  // Add generation date
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
  
  // Add filter information if any
  if (filters) {
    let yPos = 42;
    doc.text('Applied Filters:', 14, yPos);
    yPos += 6;
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        doc.text(`${key}: ${value}`, 20, yPos);
        yPos += 6;
      }
    });
  }

  // Prepare table data
  const tableData = data.map(assignment => [
    assignment.asset?.name || 'N/A',
    assignment.asset?.asset_tag || 'N/A',
    assignment.user?.full_name || 'N/A',
    formatDate(assignment.assigned_date),
    assignment.is_active ? 'Active' : (assignment.return_date ? 'Returned' : 'Inactive'),
    assignment.notes || 'N/A'
  ]);

  // Add table
  autoTable(doc, {
    head: [['Asset Name', 'Asset Tag', 'Assigned To', 'Assigned Date', 'Status', 'Notes']],
    body: tableData,
    startY: filters ? 65 : 45,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [71, 85, 105] },
    columnStyles: {
      5: { cellWidth: 40 } // Notes column wider
    }
  });

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Asset_Assignments_${timestamp}.pdf`;

  doc.save(filename);
};

// Assets Export Functions
export const exportAssetsToExcel = (data: any[], filters?: any) => {
  // Filter out virtual machine assets since they have their own export
  const filteredData = data.filter(asset => 
    asset.category?.name?.toLowerCase() !== 'virtual machine'
  );
  
  const excelData = filteredData.map(asset => ({
    'Asset Tag': asset.asset_tag || 'N/A',
    'Asset Name': asset.name || 'N/A',
    'Category': asset.category?.name || 'N/A',
    'Brand': asset.brand || 'N/A',
    'Model': asset.model || 'N/A',
    'Serial Number': asset.serial_number || 'N/A',
    'Purchase Date': formatDate(asset.purchase_date),
    'Purchase Cost': formatCurrency(asset.purchase_cost),
    'Current Value': formatCurrency(asset.current_value),
    'Warranty Expiry': formatDate(asset.warranty_expiry),
    'Location': asset.location || 'N/A',
    'Condition': asset.condition || 'N/A',
    'Status': asset.status || 'N/A',
    'Notes': asset.notes || 'N/A'
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Assets_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

export const exportAssetsToPDF = (data: any[], filters?: any) => {
  // Filter out virtual machine assets since they have their own export
  const filteredData = data.filter(asset => 
    asset.category?.name?.toLowerCase() !== 'virtual machine'
  );
  
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('Assets Report', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
  
  if (filters) {
    let yPos = 42;
    doc.text('Applied Filters:', 14, yPos);
    yPos += 6;
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        doc.text(`${key}: ${value}`, 20, yPos);
        yPos += 6;
      }
    });
  }

  const tableData = filteredData.map(asset => [
    asset.asset_tag || 'N/A',
    asset.name || 'N/A',
    asset.category?.name || 'N/A',
    asset.brand || 'N/A',
    asset.status || 'N/A',
    asset.location || 'N/A'
  ]);

  autoTable(doc, {
    head: [['Asset Tag', 'Name', 'Category', 'Brand', 'Status', 'Location']],
    body: tableData,
    startY: filters ? 65 : 45,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [71, 85, 105] }
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Assets_${timestamp}.pdf`;
  doc.save(filename);
};

// Virtual Machines Export Functions
export const exportVMsToExcel = (data: any[], filters?: any) => {
  const excelData = data.map(vm => ({
    'VM Number': vm.vm_number || 'N/A',
    'VM Location': vm.vm_location || 'N/A',
    'Access Type': vm.access_type || 'N/A',
    'Current User Type': vm.current_user_type || 'N/A',
    'Purpose': vm.purpose || 'N/A',
    'Project Name': vm.project_name || 'N/A',
    'Requested By': vm.requested_by || 'N/A',
    'Approved By': vm.approved_by || 'N/A',
    'Created By': vm.created_by || 'N/A',
    'Username': vm.username || 'N/A',
    'IP Address': vm.ip_address || 'N/A',
    'Ghost IP': vm.ghost_ip || 'N/A',
    'VPN Required': vm.vpn_requirement || 'N/A',
    'MFA Enabled': vm.mfa_enabled || 'N/A',
    'Cloud Provider': vm.cloud_provider || 'N/A',
    'Backup Enabled': vm.backup_enabled || 'N/A',
    'Audit Status': vm.audit_status || 'N/A',
    'Approval Date': formatDate(vm.approval_date),
    'Expiry Date': formatDate(vm.expiry_date),
    'Request Ticket ID': vm.request_ticket_id || 'N/A'
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Virtual Machines');

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Virtual_Machines_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

export const exportVMsToPDF = (data: any[], filters?: any) => {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('Virtual Machines Report', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
  
  if (filters) {
    let yPos = 42;
    doc.text('Applied Filters:', 14, yPos);
    yPos += 6;
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        doc.text(`${key}: ${value}`, 20, yPos);
        yPos += 6;
      }
    });
  }

  const tableData = data.map(vm => [
    vm.vm_number || 'N/A',
    vm.vm_location || 'N/A',
    vm.project_name || 'N/A',
    vm.cloud_provider || 'N/A',
    vm.audit_status || 'N/A',
    vm.ip_address || 'N/A'
  ]);

  autoTable(doc, {
    head: [['VM Number', 'Location', 'Project', 'Cloud Provider', 'Audit Status', 'IP Address']],
    body: tableData,
    startY: filters ? 65 : 45,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [71, 85, 105] }
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Virtual_Machines_${timestamp}.pdf`;
  doc.save(filename);
};

// Generic filter function
export const applyFilters = (data: any[], filters: any) => {
  if (!filters || Object.keys(filters).length === 0) return data;

  return data.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value === '' || value === 'all') return true;
      
      let itemValue: any;
      
      // Handle specific mappings for different filter types
      switch (key) {
        case 'asset_name':
          itemValue = item.asset?.name;
          break;
        case 'user_name':
          itemValue = item.user?.full_name;
          break;
        case 'status':
          // Handle assignment status vs asset status
          if (item.hasOwnProperty('is_active')) {
            // This is an assignment
            itemValue = item.is_active ? 'active' : (item.return_date ? 'returned' : 'inactive');
          } else {
            // This is an asset
            itemValue = item.status;
          }
          break;
        case 'category':
          itemValue = item.asset?.category?.name || item.category?.name;
          break;
        case 'assigned_by':
          itemValue = item.assigned_by_user?.full_name;
          break;
        case 'name':
          itemValue = item.name;
          break;
        case 'asset_tag':
          itemValue = item.asset_tag;
          break;
        case 'brand':
          itemValue = item.brand;
          break;
        case 'condition':
          itemValue = item.condition;
          break;
        case 'location':
          itemValue = item.location;
          break;
        case 'vm_number':
          itemValue = item.vm_number;
          break;
        case 'vm_location':
          itemValue = item.vm_location;
          break;
        case 'project_name':
          itemValue = item.project_name;
          break;
        case 'cloud_provider':
          itemValue = item.cloud_provider;
          break;
        case 'audit_status':
          itemValue = item.audit_status;
          break;
        case 'purpose':
          itemValue = item.purpose;
          break;
        case 'employee_status':
          // Handle employee status filtering for assignments
          if (item.user_id && item.user) {
            // Use the user status from the assignment data
            const userStatus = item.user?.status || 'active';
            itemValue = userStatus.toLowerCase() === 'inactive' ? 'inactive' : 'active';
          } else {
            itemValue = 'active'; // Default for non-assignment items
          }
          break;
        default:
          // Handle nested properties with dot notation
          const keys = key.split('.');
          itemValue = item;
          for (const k of keys) {
            itemValue = itemValue?.[k];
          }
      }
      
      if (typeof itemValue === 'string') {
        // Use exact matching for employee_status to avoid "active" matching "inactive"
        if (key === 'employee_status') {
          return itemValue.toLowerCase() === value.toString().toLowerCase();
        }
        return itemValue.toLowerCase().includes(value.toString().toLowerCase());
      }
      
      return itemValue === value;
    });
  });
};

// Complaints Export Functions
export const exportComplaintsToExcel = (data: any[], filters?: any) => {
  // Transform data for Excel export
  const excelData = data.map(complaint => ({
    'Asset Name': complaint.asset?.name || 'N/A',
    'Asset Tag': complaint.asset?.asset_tag || 'N/A',
    'Asset Category': complaint.asset?.category?.name || 'N/A',
    'User': complaint.user?.full_name || 'N/A',
    'Employee ID': complaint.user?.employee_id || 'N/A',
    'Department': complaint.user?.department?.name || 'N/A',
    'Problem Description': complaint.problem_description || 'N/A',
    'Priority': (complaint.priority || 'medium').toUpperCase(),
    'Status': (complaint.status || 'open').toUpperCase(),
    'Submitted Date': formatDate(complaint.created_at),
    'Resolved By': complaint.resolved_by_user?.full_name || 'N/A',
    'Resolution Date': formatDate(complaint.resolved_at),
    'Resolution Notes': complaint.resolution_notes || 'N/A',
    'Additional Info': complaint.additional_info || 'N/A'
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Asset Complaints');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Asset_Complaints_${timestamp}.xlsx`;

  // Write and download file
  XLSX.writeFile(workbook, filename);
};

export const exportComplaintsToPDF = (data: any[], filters?: any) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(16);
  doc.text('Asset Complaints Report', 14, 22);
  
  // Add export info
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
  doc.text(`Total Records: ${data.length}`, 14, 38);
  
  // Add filters info if provided
  if (filters) {
    let filterY = 44;
    doc.text('Applied Filters:', 14, filterY);
    filterY += 6;
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '') {
        const filterText = `${key.replace('_', ' ')}: ${value}`;
        doc.text(filterText, 20, filterY);
        filterY += 6;
      }
    });
  }
  
  // Table data
  const tableData = data.map(complaint => [
    complaint.asset?.name || 'N/A',
    complaint.user?.full_name || 'N/A',
    complaint.problem_description || 'N/A',
    (complaint.priority || 'medium').toUpperCase(),
    (complaint.status || 'open').toUpperCase(),
    formatDate(complaint.created_at),
    complaint.resolved_by_user?.full_name || 'N/A',
    formatDate(complaint.resolved_at),
    complaint.resolution_notes || 'N/A'
  ]);
  
  // Add table
  autoTable(doc, {
    head: [['Asset', 'User', 'Problem', 'Priority', 'Status', 'Submitted', 'Resolved By', 'Resolved Date', 'Resolution Notes']],
    body: tableData,
    startY: filters ? 70 : 50,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [63, 81, 181], fontSize: 7 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 20 },
    columnStyles: {
      2: { cellWidth: 25 }, // Problem Description
      8: { cellWidth: 25 }  // Resolution Notes
    }
  });
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Asset_Complaints_${timestamp}.pdf`;
  
  // Save file
  doc.save(filename);
};
