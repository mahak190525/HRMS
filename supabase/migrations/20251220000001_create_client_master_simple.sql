-- Create client_master table for storing client details (Simplified version)
-- This migration creates a table to store client master information including contact details and addresses

-- Drop the table if it exists (in case the previous migration was partially applied)
DROP TABLE IF EXISTS public.client_master CASCADE;
DROP FUNCTION IF EXISTS public.handle_client_master_timestamps() CASCADE;
DROP FUNCTION IF EXISTS public.update_client_master_updated_at() CASCADE;

-- Create the client_master table
CREATE TABLE public.client_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_name TEXT NOT NULL,
    address TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id)
);

-- Create indexes for better performance
CREATE INDEX idx_client_master_client_name ON public.client_master(client_name);
CREATE INDEX idx_client_master_recipient_email ON public.client_master(recipient_email);
CREATE INDEX idx_client_master_client_email ON public.client_master(client_email);
CREATE INDEX idx_client_master_created_at ON public.client_master(created_at);

-- Add unique constraint to prevent duplicate client entries
CREATE UNIQUE INDEX idx_client_master_unique_client ON public.client_master(client_name, client_email);

-- Simple updated_at trigger function (only handles timestamp)
CREATE OR REPLACE FUNCTION public.update_client_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at only
CREATE TRIGGER trigger_client_master_updated_at
    BEFORE UPDATE ON public.client_master
    FOR EACH ROW
    EXECUTE FUNCTION public.update_client_master_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE public.client_master ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - Allow all authenticated users to access client master data
-- Since the requirement states "don't restrict adding information to a user's role"
CREATE POLICY "Allow authenticated users to view client master" ON public.client_master
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert client master" ON public.client_master
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update client master" ON public.client_master
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete client master" ON public.client_master
    FOR DELETE USING (auth.role() = 'authenticated');

-- Grant permissions to authenticated users
GRANT ALL ON public.client_master TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.client_master IS 'Master table for storing client contact and address information';
COMMENT ON COLUMN public.client_master.recipient_email IS 'Email address of the recipient contact person';
COMMENT ON COLUMN public.client_master.recipient_name IS 'Full name of the recipient contact person';
COMMENT ON COLUMN public.client_master.client_email IS 'Primary email address of the client organization';
COMMENT ON COLUMN public.client_master.client_name IS 'Name of the client organization';
COMMENT ON COLUMN public.client_master.address IS 'Physical address of the client';
COMMENT ON COLUMN public.client_master.state IS 'State/Province of the client address';
COMMENT ON COLUMN public.client_master.zip_code IS 'ZIP/Postal code of the client address';
