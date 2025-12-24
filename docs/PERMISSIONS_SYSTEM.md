# Invoice Edit Permission System

## Overview
A simple permission system that allows administrators to control whether users can edit invoices through the Admin Panel. When disabled, all invoice edit buttons are hidden or disabled for all users.

## Features Implemented

### 🔧 **Database Structure**
- **Migration**: `20241225_03_add_invoice_edit_permissions.sql`
- **Table**: `app_config.permissions` (JSONB column)
- **Helper Function**: `check_app_permission(module, feature, permission_type)`

### 🎛️ **Admin Panel Integration**
- **Location**: Admin Panel → Finance Tab → "Finance Module Permissions" section
- **Real-time Updates**: Changes take effect immediately
- **Visual Feedback**: Clear switches and descriptions for each permission

### 🔒 **Permission Types**
Each feature has 4 permission levels:
- **Create**: Controls creation buttons and dialogs
- **Edit**: Controls edit buttons and forms  
- **Delete**: Controls delete buttons and confirmations
- **View**: Controls view dialogs and details

### 📊 **Controlled Features**

#### **Invoice Management**
- ✅ Generate Invoice button
- ✅ Edit Invoice button (table + view dialog)
- ✅ Delete Invoice button with confirmation
- ✅ View Invoice dialog

#### **Billing Records**
- ✅ Create Billing Record button
- ✅ Edit Billing Record button (table + view dialog)
- ✅ Delete Billing Record button
- ✅ View Billing Record dialog

#### **Client Master**
- ✅ Manage Clients button
- ✅ Edit Client button (table + view dialog)
- ✅ Delete Client button with confirmation
- ✅ View Client dialog

## How It Works

### 1. **Database Storage**
```json
{
  "finance": {
    "invoices": {
      "create": true,
      "edit": true,
      "delete": true,
      "view": true
    },
    "billing_records": {
      "create": true,
      "edit": true,
      "delete": true,
      "view": true
    },
    "client_master": {
      "create": true,
      "edit": true,
      "delete": true,
      "view": true
    }
  }
}
```

### 2. **Frontend Hook**
```typescript
const { data: appPermissions } = useAppPermissions();
const canEditInvoices = appPermissions?.finance?.invoices?.edit ?? true;
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
3. Scroll to **"Finance Module Permissions"** section

### **Managing Permissions**
1. **Toggle Switches**: Turn features on/off
2. **Save Changes**: Click "Save Permissions" button
3. **Immediate Effect**: Changes apply instantly to all users

### **Permission Effects**
- **Disabled Buttons**: Grayed out with tooltip explanation
- **Hidden Dialogs**: Creation dialogs won't open when disabled
- **User Feedback**: Clear tooltips explain why features are disabled

## Default Configuration

All permissions default to `true` (enabled) for backward compatibility:

```sql
-- Default permissions structure
{
  "finance": {
    "invoices": {"edit": true, "delete": true, "create": true, "view": true},
    "billing_records": {"edit": true, "delete": true, "create": true, "view": true},
    "client_master": {"edit": true, "delete": true, "create": true, "view": true}
  }
}
```

## Migration Instructions

### **Apply Database Changes**
```bash
# Run the permissions migration
supabase db push
```

### **Verify Installation**
1. Check Admin Panel → Finance tab for permissions section
2. Test toggling permissions and verify UI changes
3. Confirm tooltips show for disabled features

## Extensibility

### **Adding New Permissions**
1. **Update Migration**: Add new permission structure
2. **Update Hook**: Extend `useAppPermissions` if needed
3. **Update UI**: Add permission checks to new features
4. **Update Admin Panel**: Add switches for new permissions

### **Adding New Modules**
```typescript
// Example: Adding HR permissions
const canEditEmployees = appPermissions?.hr?.employees?.edit ?? true;
```

## Security Notes

- ✅ **Frontend Only**: This is UI-level permission control
- ✅ **User Experience**: Improves UX by hiding unavailable features
- ⚠️ **Not Security**: Does not replace backend authorization
- ⚠️ **API Access**: Backend APIs should have their own permission checks

## Troubleshooting

### **Permissions Not Working**
1. Check migration was applied: `SELECT permissions FROM app_config WHERE id = 1;`
2. Verify hook is imported: `import { useAppPermissions } from '@/hooks/useFinance';`
3. Check browser console for errors

### **Admin Panel Not Showing**
1. Ensure you have admin access
2. Check SettingsManager component is updated
3. Verify Finance tab is accessible

### **Changes Not Applying**
1. Check browser cache (hard refresh)
2. Verify database update succeeded
3. Check React Query cache invalidation

## Future Enhancements

- 🔄 **Role-based Permissions**: Different permissions per user role
- 📝 **Audit Logging**: Track permission changes
- 🔐 **Backend Integration**: API-level permission enforcement
- 📊 **Usage Analytics**: Track feature usage by permission level

This system provides a solid foundation for granular feature control while maintaining excellent user experience and admin usability! 🎉
