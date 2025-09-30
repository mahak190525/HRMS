# Employee Documents Feature Setup

This document contains instructions for setting up the Employee Documents feature in the HRMS system.

## Overview

The Employee Documents feature allows HR/Admin users to:
- Upload employee documents (PDF only)
- Request documents from employees
- View, edit, and delete documents
- Create custom document types
- Manage predefined document types with different categories

## Database Setup

### Step 1: Run Database Migration

Execute the SQL migration file to create the necessary tables and policies:

```bash
# In Supabase SQL Editor, run:
create_employee_documents_tables.sql
```

### Step 2: Create Storage Bucket

Execute the storage bucket creation script:

```bash
# In Supabase SQL Editor, run:
create_employee_documents_bucket.sql
```

**Alternative**: Create the bucket manually in Supabase Dashboard:
1. Go to Storage in Supabase Dashboard
2. Create a new bucket named `employee-documents`
3. Set it as public
4. Apply the storage policies from the SQL file

## Features

### Document Categories

1. **Personal Documents**
   - Latest passport-size photograph
   - Police Clearance Certificate (PCC)
   - Copy of Birth Certificate / School Leaving Certificate
   - Aadhaar Card
   - PAN Card / PAN Details
   - One Professional Photograph (plain white background)

2. **Educational Documents**
   - 10th Certificate
   - 12th Certificate
   - Degree Certificate
   - Copy of Educational Qualification Certificates

3. **Bank Documents**
   - Bank Account Details
   - Cancelled Cheque

4. **Professional Documents**
   - Offer Letter
   - Signed Copy Received
   - Relieving Letter and Experience Certificates (not for associates)
   - Copy of Resignation Email (not for associates)
   - Last Drawn Salary Slip / Certificate (not for associates)
   - UAN (Universal Account Number) (not for associates)
   - ESIC Number (not for associates)
   - Form 16 (not for associates)
   - TDS Document (not for associates)

5. **Custom Documents**
   - Any additional documents added by HR/Admin

### Document Status

- **Uploaded**: Document has been uploaded and is available
- **Pending**: Document slot exists but no file uploaded
- **Requested**: HR/Admin has requested this document from employee

### Permissions

- **HR/Admin**: Can upload, request, view, edit, and delete all documents
- **Managers**: Can view documents of their team members
- **Employees**: Can view, upload, and update their own documents (feature to be implemented later)

## Usage

### For HR/Admin Users

1. **View Employee Documents**
   - Go to Employee Management
   - Click the "View" (eye) icon for any employee
   - Navigate to the "Documents" tab

2. **Upload Documents**
   - Click the upload button (up arrow icon) next to any document type
   - Select a PDF file (only PDF files are accepted, max 10MB)
   - The document will be uploaded and marked as "uploaded"

3. **Request Documents**
   - Click the request button (send icon) next to any document type
   - This will mark the document as "requested" and notify the employee

4. **Delete Documents**
   - Click the delete button (trash icon) next to uploaded documents
   - Confirm deletion in the popup

5. **Add Custom Document Types**
   - In the Documents tab, use the "Add Custom Document Type" section
   - Enter a name (e.g., "Visa Copy") and click "Add"
   - The new document type will appear in the list immediately

6. **Download Documents**
   - Click the download button (down arrow icon) to view/download documents

### For Employees (Future Implementation)

The system is prepared for employees to upload their own documents with the following capabilities:

1. **Self-Upload**: Employees can upload their own documents to fulfill requests
2. **Update Documents**: Replace existing documents with newer versions
3. **View Own Documents**: Access and download their uploaded documents

**Database and Storage Policies**: All necessary RLS policies and storage bucket policies are already in place to support employee self-upload functionality.

### File Requirements

- **Format**: PDF only
- **Size**: Maximum 10MB per file
- **Naming**: Files are automatically renamed with timestamps and UUIDs to prevent conflicts

### Storage Structure

Documents are stored in the `employee-documents` bucket with the following structure:
```
employee-documents/
├── {employee-id}/
│   ├── Document_Name_timestamp_uuid.pdf
│   └── Another_Document_timestamp_uuid.pdf
```

## Security

- Row Level Security (RLS) is enabled on all tables
- Storage policies restrict access based on user roles
- **Employee Access**: Can view, upload, and update their own documents only
- **Manager Access**: Can view their team's documents (read-only)
- **HR/Admin Access**: Full CRUD access to all employee documents
- **File Path Security**: Employee documents are stored in folders named with their user ID
- **Storage Policies**: Prevent cross-employee document access at the storage level

## Database Tables

### `employee_document_types`
- Stores predefined and custom document types
- Categories: personal, educational, professional, bank, custom
- Tracks if documents are mandatory
- Specifies applicable employment types

### `employee_documents`
- Stores document records and metadata
- Links employees to document types
- Tracks upload/request status
- Stores file URLs and metadata

## Troubleshooting

### Common Issues

1. **Upload fails**: Check file size (max 10MB) and format (PDF only)
2. **Permission denied**: Ensure user has HR/Admin role
3. **Bucket not found**: Run the storage bucket creation script
4. **RLS policy errors**: Verify migration was run completely

### Support

For technical issues, check:
1. Browser console for JavaScript errors
2. Supabase logs for database/storage errors
3. Network tab for failed API calls
