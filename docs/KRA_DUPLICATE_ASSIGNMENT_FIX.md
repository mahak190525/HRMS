# 🔧 KRA Duplicate Assignment Error Fix

## 🚨 **Error Details**
```
"duplicate key value violates unique constraint \"kra_assignments_template_id_employee_id_key\""
```

This error occurs when trying to assign the same KRA template to an employee who already has that assignment.

## 🔍 **Root Cause**
The `kra_assignments` table has a unique constraint on `(template_id, employee_id)` to prevent duplicate assignments. However, the frontend code doesn't check for existing assignments before inserting new ones.

## 🛠️ **Solution Options**

### **Option 1: Update Frontend Logic (Recommended)**
Modify the assignment logic to check for existing assignments first.

### **Option 2: Handle Error Gracefully**
Catch the duplicate key error and show a user-friendly message.

### **Option 3: Use UPSERT Logic**
Use PostgreSQL's `ON CONFLICT` clause to handle duplicates automatically.

## 📋 **Implementation**

### **Frontend Fix (KRATemplatePage.tsx)**

Replace the current assignment logic with duplicate checking:

```typescript
// Before inserting, check for existing assignments
const existingAssignments = await supabase
  .from('kra_assignments')
  .select('employee_id')
  .eq('template_id', templateId)
  .in('employee_id', selectedEmployees);

if (existingAssignments.data && existingAssignments.data.length > 0) {
  const existingEmployeeIds = existingAssignments.data.map(a => a.employee_id);
  const duplicateEmployees = selectedEmployees.filter(id => existingEmployeeIds.includes(id));
  
  if (duplicateEmployees.length > 0) {
    // Show error or confirmation dialog
    const shouldReassign = confirm(
      `Some employees already have this KRA assigned. Do you want to reassign it?`
    );
    
    if (shouldReassign) {
      // Use reassign mode
      handlePublishTemplate(templateId, selectedEmployees, 'reassign');
      return;
    } else {
      // Only assign to new employees
      const newEmployees = selectedEmployees.filter(id => !existingEmployeeIds.includes(id));
      if (newEmployees.length === 0) {
        toast.error('All selected employees already have this KRA assigned');
        return;
      }
      selectedEmployees = newEmployees;
    }
  }
}
```

### **Database-Level Fix (Alternative)**

Add a database function that handles upserts:

```sql
CREATE OR REPLACE FUNCTION upsert_kra_assignment(
  p_template_id uuid,
  p_employee_id uuid,
  p_assigned_by uuid,
  p_assignment_data jsonb
)
RETURNS uuid AS $$
DECLARE
  assignment_id uuid;
BEGIN
  -- Try to update existing assignment
  UPDATE kra_assignments 
  SET 
    assigned_by = p_assigned_by,
    assigned_date = CURRENT_DATE,
    status = 'assigned',
    updated_at = NOW()
  WHERE template_id = p_template_id 
    AND employee_id = p_employee_id
  RETURNING id INTO assignment_id;
  
  -- If no existing assignment, insert new one
  IF assignment_id IS NULL THEN
    INSERT INTO kra_assignments (
      template_id, employee_id, assigned_by, assigned_date, status
    ) VALUES (
      p_template_id, p_employee_id, p_assigned_by, CURRENT_DATE, 'assigned'
    ) RETURNING id INTO assignment_id;
  END IF;
  
  RETURN assignment_id;
END;
$$ LANGUAGE plpgsql;
```

## 🎯 **Quick Fix for Current Error**

If you need an immediate solution, you can:

1. **Check existing assignments** before creating new ones
2. **Use reassign mode** instead of assign mode
3. **Delete existing assignment** and create a new one

### **Immediate SQL Fix**
```sql
-- Find the conflicting assignment
SELECT * FROM kra_assignments 
WHERE template_id = '77f14a44-b09f-4cc2-a613-a029378faccf' 
  AND employee_id = 'c10e1bd7-489a-4f29-9764-dc3b682583e6';

-- Option 1: Delete existing assignment (if safe to do)
DELETE FROM kra_assignments 
WHERE template_id = '77f14a44-b09f-4cc2-a613-a029378faccf' 
  AND employee_id = 'c10e1bd7-489a-4f29-9764-dc3b682583e6';

-- Option 2: Update existing assignment instead
UPDATE kra_assignments 
SET 
  assigned_by = 'new_manager_id',
  assigned_date = CURRENT_DATE,
  status = 'assigned',
  updated_at = NOW()
WHERE template_id = '77f14a44-b09f-4cc2-a613-a029378faccf' 
  AND employee_id = 'c10e1bd7-489a-4f29-9764-dc3b682583e6';
```

## ✅ **Recommended Approach**

1. **Update the frontend code** to check for existing assignments
2. **Add user confirmation** for reassignment scenarios  
3. **Implement proper error handling** with user-friendly messages
4. **Consider adding a "reassign" option** in the UI for intentional duplicates

This will prevent the error and provide a better user experience when managing KRA assignments.
