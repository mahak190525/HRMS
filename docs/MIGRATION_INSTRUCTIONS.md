# Invoice Log Retention Migration

## Overview
This migration ensures that invoice logs are retained even after invoices are deleted, which is crucial for audit compliance and regulatory requirements.

## What Changed

### Database Changes
- **Foreign Key Constraints**: Changed from `ON DELETE CASCADE` to `ON DELETE SET NULL`
- **New Columns**: Added context preservation columns to both log tables:
  - `deleted_invoice_number` - Preserves invoice number after deletion
  - `deleted_invoice_client_name` - Preserves client name after deletion  
  - `invoice_deleted_at` - Timestamp when invoice was deleted

### Automatic Context Preservation
- **Trigger Function**: Automatically preserves invoice context before deletion
- **Updated Views**: Handle both active and deleted invoices in log views
- **Enhanced Logging**: Deletion logs now include complete invoice context

## How to Apply

1. **Run the Migration**:
   ```bash
   # Apply the migration to your Supabase database
   supabase db push
   ```

2. **Verify the Changes**:
   ```sql
   -- Check that logs table structure is updated
   \d invoice_logs
   \d invoice_task_logs
   
   -- Verify views are working
   SELECT * FROM invoice_logs_with_details LIMIT 5;
   ```

## Benefits

### ✅ Audit Compliance
- All invoice changes are permanently retained
- Complete audit trail even for deleted invoices
- Regulatory compliance for financial records

### ✅ Data Integrity
- No loss of historical data
- Full context preservation
- Traceability of all operations

### ✅ User Experience
- Logs show "Invoice Deleted" badge for deleted invoices
- Complete history remains accessible
- No broken references in log views

## Testing

After applying the migration:

1. **Create a test invoice** with tasks
2. **Make some changes** to see logs created
3. **Delete the invoice** 
4. **Check logs are retained** with proper context
5. **Verify UI shows** "Invoice Deleted" badge

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- WARNING: This will delete all logs for deleted invoices
-- Only run if absolutely necessary

-- Restore CASCADE constraints (will delete logs)
ALTER TABLE public.invoice_logs 
DROP CONSTRAINT invoice_logs_invoice_id_fkey,
ADD CONSTRAINT invoice_logs_invoice_id_fkey 
FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- Remove added columns
ALTER TABLE public.invoice_logs 
DROP COLUMN deleted_invoice_number,
DROP COLUMN deleted_invoice_client_name,
DROP COLUMN invoice_deleted_at;
```

⚠️ **Warning**: Rollback will permanently delete all logs for deleted invoices!
