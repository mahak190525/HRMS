-- Migration: Create Employee Documents Tables
-- Description: Creates tables and RLS policies for employee document management
-- Date: 2024-09-25

-- Create employee document types table
CREATE TABLE IF NOT EXISTS employee_document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL CHECK (category IN ('personal', 'educational', 'professional', 'bank', 'custom')),
  applicable_employment_types TEXT[], -- For documents not required for associates
  created_for_employee_id UUID REFERENCES users(id), -- NULL for global types, specific employee ID for custom types
  created_by UUID REFERENCES users(id), -- Who created this document type
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, created_for_employee_id) -- Allow same name for different employees or global
);

-- Create employee documents table
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES employee_document_types(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('uploaded', 'pending', 'requested')),
  requested_by UUID REFERENCES users(id),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, document_type_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_status ON employee_documents(status);
CREATE INDEX IF NOT EXISTS idx_employee_documents_document_type_id ON employee_documents(document_type_id);

-- Add foreign key constraints with proper naming (if they don't already exist)
DO $$ 
BEGIN
    -- Add requested_by foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'employee_documents_requested_by_fkey' 
        AND table_name = 'employee_documents'
    ) THEN
        ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_requested_by_fkey 
          FOREIGN KEY (requested_by) REFERENCES users(id);
    END IF;
    
    -- Add uploaded_by foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'employee_documents_uploaded_by_fkey' 
        AND table_name = 'employee_documents'
    ) THEN
        ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_uploaded_by_fkey 
          FOREIGN KEY (uploaded_by) REFERENCES users(id);
    END IF;
END $$;

-- Create RLS policies
ALTER TABLE employee_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_document_types (allow public access, app handles permissions)
DROP POLICY IF EXISTS "Users can view document types" ON employee_document_types;
CREATE POLICY "Allow public view document types" ON employee_document_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage document types" ON employee_document_types;
CREATE POLICY "Allow public manage document types" ON employee_document_types
  FOR ALL USING (true);

-- RLS Policies for employee_documents (allow public access, app handles permissions)
DROP POLICY IF EXISTS "Users can view own documents" ON employee_documents;
DROP POLICY IF EXISTS "HR/Admin can view all documents" ON employee_documents;
DROP POLICY IF EXISTS "Managers can view team documents" ON employee_documents;
DROP POLICY IF EXISTS "HR/Admin can manage documents" ON employee_documents;
DROP POLICY IF EXISTS "Employees can manage own documents" ON employee_documents;
DROP POLICY IF EXISTS "Employees can update own documents" ON employee_documents;

-- Allow public access to employee documents (application handles permissions)
CREATE POLICY "Allow public access employee documents" ON employee_documents
  FOR ALL USING (true);

-- Insert default document types
INSERT INTO employee_document_types (name, is_mandatory, category, applicable_employment_types, created_for_employee_id, created_by) VALUES
-- Personal Documents
('Latest passport-size photograph', true, 'personal', NULL, NULL, NULL),
('Police Clearance Certificate (PCC)', true, 'personal', NULL, NULL, NULL),
('Copy of Birth Certificate / School Leaving Certificate', true, 'personal', NULL, NULL, NULL),
('Aadhaar Card', true, 'personal', NULL, NULL, NULL),
('PAN Card / PAN Details', true, 'personal', NULL, NULL, NULL),
('One Professional Photograph (plain white background)', true, 'personal', NULL, NULL, NULL),
('Passport', false, 'personal', NULL, NULL, NULL),
('Driving License', false, 'personal', NULL, NULL, NULL),

-- Educational Documents
('10th Certificate', true, 'educational', NULL, NULL, NULL),
('12th Certificate', true, 'educational', NULL, NULL, NULL),
('Degree Certificate', true, 'educational', NULL, NULL, NULL),
('Copy of Educational Qualification Certificates', true, 'educational', NULL, NULL, NULL),

-- Bank Documents
('Bank Account Details', true, 'bank', NULL, NULL, NULL),
('Cancelled Cheque', true, 'bank', NULL, NULL, NULL),

-- Professional Documents (All employment types)
('Offer Letter', true, 'professional', NULL, NULL, NULL),
('Appointment Letter', true, 'professional', NULL, NULL, NULL),

-- Professional Documents (Not required for Associate)
('Relieving Letter and Experience Certificates', false, 'professional', ARRAY['full_time', 'part_time'], NULL, NULL),
('Copy of Resignation Email', false, 'professional', ARRAY['full_time', 'part_time'], NULL, NULL),
('Last Drawn Salary Slip / Certificate', false, 'professional', ARRAY['full_time', 'part_time'], NULL, NULL),
('UAN (Universal Account Number)', false, 'professional', ARRAY['full_time', 'part_time'], NULL, NULL),
('ESIC (Employee State Insurance Corporation) Number', false, 'professional', ARRAY['full_time', 'part_time'], NULL, NULL),
('Form 16', false, 'professional', ARRAY['full_time', 'part_time'], NULL, NULL),
('TDS Document', false, 'professional', ARRAY['full_time', 'part_time'], NULL, NULL)

ON CONFLICT (name, created_for_employee_id) DO NOTHING;

-- Create the storage bucket for employee documents (if not exists)
-- Note: This needs to be run via Supabase Storage console or API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('employee-documents', 'employee-documents', true)
-- ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE employee_document_types IS 'Defines the types of documents that can be associated with employees';
COMMENT ON TABLE employee_documents IS 'Stores employee document records and metadata';
COMMENT ON COLUMN employee_documents.status IS 'Document status: uploaded (file exists), pending (not uploaded), requested (requested by admin/HR)';
COMMENT ON COLUMN employee_document_types.applicable_employment_types IS 'Array of employment types this document applies to. NULL means applies to all types.';
