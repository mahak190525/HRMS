-- Migration: Fix invoice number generation function - resolve all naming conflicts
-- Description: Fix all ambiguous column references by renaming parameters and using explicit references
-- Date: 2024-12-23

-- Drop the existing function
DROP FUNCTION IF EXISTS generate_invoice_number(DATE, TEXT);

-- Create corrected function to generate invoice number with company-specific prefixes
-- Indian invoices: MT/MMMXXX (e.g., MT/DEC001)
-- LLC invoices: MECH/MMMXXX (e.g., MECH/DEC001)
-- Numbers reset each month within each company type
CREATE OR REPLACE FUNCTION generate_invoice_number(
    target_invoice_date DATE DEFAULT CURRENT_DATE,
    target_company_type TEXT DEFAULT 'Mechlin LLC'
)
RETURNS TEXT AS $$
DECLARE
    month_abbr TEXT;
    next_number INTEGER;
    result_invoice_number TEXT;
    company_prefix TEXT;
    pattern_prefix TEXT;
    target_month INTEGER;
    target_year INTEGER;
BEGIN
    -- Get month abbreviation (JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC)
    month_abbr := UPPER(TO_CHAR(target_invoice_date, 'MON'));
    
    -- Extract month and year for comparison
    target_month := EXTRACT(MONTH FROM target_invoice_date);
    target_year := EXTRACT(YEAR FROM target_invoice_date);
    
    -- Set company prefix based on invoice type
    IF target_company_type = 'Mechlin Indian' THEN
        company_prefix := 'MT/';
        pattern_prefix := 'MT/' || month_abbr;
    ELSE
        company_prefix := 'MECH/';
        pattern_prefix := 'MECH/' || month_abbr;
    END IF;
    
    -- Get the next sequential number for THIS SPECIFIC month/year/company only
    -- This ensures numbering resets each month within each company type
    SELECT COALESCE(MAX(
        CASE 
            WHEN inv.invoice_number ~ ('^' || pattern_prefix || '[0-9]{3}$') 
            THEN CAST(SUBSTRING(inv.invoice_number FROM LENGTH(pattern_prefix) + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM public.invoices inv
    WHERE EXTRACT(MONTH FROM COALESCE(inv.invoice_date, CURRENT_DATE)) = target_month
    AND EXTRACT(YEAR FROM COALESCE(inv.invoice_date, CURRENT_DATE)) = target_year
    AND COALESCE(inv.invoice_type, 'Mechlin LLC') = target_company_type;
    
    -- Format as PREFIX/MMMXXX (e.g., MT/DEC001, MECH/DEC001)
    result_invoice_number := company_prefix || month_abbr || LPAD(next_number::TEXT, 3, '0');
    
    RETURN result_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Update existing invoices to use new format based on their invoice_type
-- This will migrate existing invoices to the new format
UPDATE public.invoices 
SET invoice_number = generate_invoice_number(
    COALESCE(invoice_date, created_at::date),
    COALESCE(invoice_type, 'Mechlin LLC')
)
WHERE invoice_number IS NOT NULL 
AND invoice_number NOT LIKE 'MT/%' 
AND invoice_number NOT LIKE 'MECH/%';

-- Update the comment to reflect the new format
COMMENT ON COLUMN public.invoices.invoice_number IS 'Invoice number with company prefix: MT/MMMXXX for Indian, MECH/MMMXXX for LLC (e.g., MT/DEC001, MECH/DEC002)';

-- Add function comment
COMMENT ON FUNCTION generate_invoice_number(DATE, TEXT) IS 'Generates invoice numbers with company-specific prefixes: MT/ for Mechlin Indian, MECH/ for Mechlin LLC. Numbers reset monthly within each company type.';
