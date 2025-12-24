# Invoice Edit & Delete Permission System

## Overview
A simple permission system that allows administrators to control whether users can edit or delete invoices through the Admin Panel. When disabled, the corresponding buttons are disabled for all users.

## Features Implemented

### 🔧 **Database Structure**
- **Migration**: `20241225_03_add_invoice_edit_permissions.sql`
- **Table**: `app_config.permissions` (JSONB column)
- **Structure**: `{"finance": {"invoices": {"edit": true, "delete": true}}}`

### 🎛️ **Admin Panel Integration**
- **Location**: Admin Panel → Finance Tab → "Invoice Permissions" section
- **Controls**: Two toggle switches for invoice editing and deletion
- **Real-time**: Changes apply immediately without restart

### 🔒 **Permission Control**
**Two Independent Permissions**:
- **Edit Invoices**: Controls all invoice edit buttons
- **Delete Invoices**: Controls all invoice delete buttons

### 📊 **What's Controlled**

#### **✅ Affected Features**
- Edit Invoice button in invoices table (controlled by edit permission)
- Edit Invoice button in invoice view dialog (controlled by edit permission)
- Delete Invoice button in invoices table (controlled by delete permission)
- Tooltips show "Edit disabled by admin" or "Delete disabled by admin" when disabled

#### **❌ Unaffected Features**
- Generate Invoice button (always works)
- View Invoice dialog (always works)
- All billing records features (always work)
- All client master features (always work)

## How It Works

### 1. **Database Storage**
```json
{
  "finance": {
    "invoices": {
      "edit": true,
      "delete": true
    }
  }
}
```

### 2. **Frontend Hook**
```typescript
const { data: appPermissions } = useAppPermissions();
const canEditInvoices = appPermissions?.finance?.invoices?.edit ?? true;
const canDeleteInvoices = appPermissions?.finance?.invoices?.delete ?? true;
```

### 3. **UI Implementation**
```typescript
<Button 
  disabled={!canEditInvoices}
  title={canEditInvoices ? "Edit Invoice" : "Edit disabled by admin"}
  onClick={handleEdit}
>
  <Edit className="h-4 w-4" />
</Button>
```

## Admin Panel Usage

### **Accessing Permissions**
1. Navigate to **Admin Panel**
2. Go to **Finance** tab
3. Find **"Invoice Permissions"** section

### **Managing Permissions**
1. **Toggle Switches**: Turn invoice editing and/or deletion on/off independently
2. **Save Permissions**: Click "Save Permissions" button
3. **Immediate Effect**: Changes apply instantly to all users

### **Permission Effects**
- **Edit Enabled**: Edit buttons work normally
- **Edit Disabled**: Edit buttons are grayed out with "Edit disabled by admin" tooltip
- **Delete Enabled**: Delete buttons work normally
- **Delete Disabled**: Delete buttons are grayed out with "Delete disabled by admin" tooltip

## Default Configuration

Both invoice editing and deletion default to `true` (enabled) for backward compatibility:

```sql
-- Default permissions
{"finance": {"invoices": {"edit": true, "delete": true}}}
```

## Migration Instructions

### **Apply Database Changes**
```bash
# Run the permissions migration
supabase db push
```

### **Verify Installation**
1. Check Admin Panel → Finance tab for permission section
2. Test toggling permission and verify edit buttons are disabled
3. Confirm tooltips show "Edit disabled by admin"

## Database Queries

### **Check Current Settings**
```sql
SELECT 
  permissions->'finance'->'invoices'->>'edit' as invoice_edit_enabled,
  permissions->'finance'->'invoices'->>'delete' as invoice_delete_enabled
FROM app_config WHERE id = 1;
```

### **Disable Invoice Editing**
```sql
UPDATE app_config 
SET permissions = jsonb_set(permissions, '{finance,invoices,edit}', 'false')
WHERE id = 1;
```

### **Disable Invoice Deletion**
```sql
UPDATE app_config 
SET permissions = jsonb_set(permissions, '{finance,invoices,delete}', 'false')
WHERE id = 1;
```

### **Enable Both Permissions**
```sql
UPDATE app_config 
SET permissions = jsonb_set(
  jsonb_set(permissions, '{finance,invoices,edit}', 'true'),
  '{finance,invoices,delete}', 'true'
) WHERE id = 1;
```

## Security Notes

- ✅ **UI Control**: This controls user interface elements only
- ✅ **User Experience**: Improves UX by hiding unavailable features
- ⚠️ **Not Security**: Does not replace backend authorization
- ⚠️ **API Access**: Backend APIs should have their own permission checks

## Troubleshooting

### **Permission Not Working**
1. Check migration applied: `SELECT permissions FROM app_config WHERE id = 1;`
2. Verify hook imported: `import { useAppPermissions } from '@/hooks/useFinance';`
3. Check browser console for errors

### **Admin Panel Not Showing**
1. Ensure you have admin access
2. Check SettingsManager component updated
3. Verify Finance tab accessible

### **Changes Not Applying**
1. Hard refresh browser (Ctrl+F5)
2. Verify database update succeeded
3. Check React Query cache

This simple system provides focused control over invoice editing and deletion while keeping all other features fully functional! 🎉
