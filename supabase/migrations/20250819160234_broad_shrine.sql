-- Create trigger function for billing logs
CREATE OR REPLACE FUNCTION log_billing_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO billing_logs (billing_record_id, action_type, changed_by)
    VALUES (NEW.id, 'created', NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log significant field changes
    IF OLD.contract_value != NEW.contract_value THEN
      INSERT INTO billing_logs (billing_record_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'contract_value', OLD.contract_value::text, NEW.contract_value::text, COALESCE(NEW.last_modified_by, auth.uid()));
    END IF;
    
    IF OLD.billed_to_date != NEW.billed_to_date THEN
      INSERT INTO billing_logs (billing_record_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'billed_to_date', OLD.billed_to_date::text, NEW.billed_to_date::text, COALESCE(NEW.last_modified_by, auth.uid()));
    END IF;
    
    IF OLD.assigned_to_finance != NEW.assigned_to_finance THEN
      INSERT INTO billing_logs (billing_record_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'assigned_to_finance', OLD.assigned_to_finance::text, NEW.assigned_to_finance::text, COALESCE(NEW.last_modified_by, auth.uid()));
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for invoice logs
CREATE OR REPLACE FUNCTION log_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO billing_logs (invoice_id, action_type, changed_by)
    VALUES (NEW.id, 'created', NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status != NEW.status THEN
      INSERT INTO billing_logs (invoice_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, COALESCE(NEW.last_modified_by, auth.uid()));
    END IF;
    
    -- Log amount changes
    IF OLD.invoice_amount != NEW.invoice_amount THEN
      INSERT INTO billing_logs (invoice_id, action_type, field_changed, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'invoice_amount', OLD.invoice_amount::text, NEW.invoice_amount::text, COALESCE(NEW.last_modified_by, auth.uid()));
    END IF;
    
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;