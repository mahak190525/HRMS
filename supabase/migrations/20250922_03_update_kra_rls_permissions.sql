-- Enhanced KRA RLS Policies for Role-Based Access Control
-- This migration updates the KRA system to support:
-- Manager -> Can access their team's KRA data and edit
-- HR -> Can access all KRA data but read-only for evaluations
-- Admin -> Can access all KRA data with full read/write permissions

-- Drop existing policies to recreate with enhanced logic
DROP POLICY IF EXISTS "Users can read own templates and team templates" ON kra_templates;
DROP POLICY IF EXISTS "Users can read own assignments and managed assignments" ON kra_assignments;
DROP POLICY IF EXISTS "Users can read own evaluations and managed evaluations" ON kra_evaluations;
DROP POLICY IF EXISTS "HR can read all evaluations" ON kra_evaluations;
DROP POLICY IF EXISTS "Users can update evaluations for their assignments" ON kra_evaluations;

-- Enhanced KRA Templates Policies
CREATE POLICY "Enhanced KRA templates access"
  ON kra_templates FOR SELECT
  TO authenticated
  USING (
    -- Own templates
    created_by = auth.uid() 
    OR
    -- Team templates (for managers)
    EXISTS (
      SELECT 1 FROM users u1, users u2, roles r1
      WHERE u1.id = auth.uid() 
      AND u2.id = kra_templates.created_by
      AND u1.role_id = r1.id
      AND r1.name IN ('sdm', 'bdm', 'qam', 'hrm')
      AND (u1.department_id = u2.department_id OR u1.id = u2.manager_id)
    )
    OR
    -- All templates (for HR and Admin)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin', 'hr')
    )
  );

CREATE POLICY "Enhanced KRA templates modification"
  ON kra_templates FOR ALL
  TO authenticated
  USING (
    -- Own templates (managers can modify their own)
    created_by = auth.uid() 
    OR
    -- Full access (Admin only - HR cannot modify templates)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    -- Own templates (managers can modify their own)
    created_by = auth.uid() 
    OR
    -- Full access (Admin only - HR cannot modify templates)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  );

-- Enhanced KRA Assignments Policies
CREATE POLICY "Enhanced KRA assignments access"
  ON kra_assignments FOR SELECT
  TO authenticated
  USING (
    -- Own assignments (as employee)
    employee_id = auth.uid()
    OR
    -- Assigned by user (as manager)
    assigned_by = auth.uid()
    OR
    -- Team assignments (for managers)
    EXISTS (
      SELECT 1 FROM users u1, users u2, roles r1
      WHERE u1.id = auth.uid() 
      AND u2.id = kra_assignments.employee_id
      AND u1.role_id = r1.id
      AND r1.name IN ('sdm', 'bdm', 'qam', 'hrm')
      AND (u1.department_id = u2.department_id OR u1.id = u2.manager_id)
    )
    OR
    -- All assignments (for HR and Admin)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin', 'hr')
    )
  );

CREATE POLICY "Enhanced KRA assignments modification"
  ON kra_assignments FOR ALL
  TO authenticated
  USING (
    -- Assigned by user (managers can modify their assignments)
    assigned_by = auth.uid()
    OR
    -- Full access (Admin only - HR cannot modify assignments)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    -- Assigned by user (managers can modify their assignments)
    assigned_by = auth.uid()
    OR
    -- Full access (Admin only - HR cannot modify assignments)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  );

-- Enhanced KRA Evaluations Policies
CREATE POLICY "Enhanced KRA evaluations access"
  ON kra_evaluations FOR SELECT
  TO authenticated
  USING (
    -- Own evaluations (as employee)
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND kra_assignments.employee_id = auth.uid()
    )
    OR
    -- Managed evaluations (as manager)
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND kra_assignments.assigned_by = auth.uid()
    )
    OR
    -- Team evaluations (for managers)
    EXISTS (
      SELECT 1 FROM kra_assignments a, users u1, users u2, roles r1
      WHERE a.id = kra_evaluations.assignment_id
      AND u1.id = auth.uid() 
      AND u2.id = a.employee_id
      AND u1.role_id = r1.id
      AND r1.name IN ('sdm', 'bdm', 'qam', 'hrm')
      AND (u1.department_id = u2.department_id OR u1.id = u2.manager_id)
    )
    OR
    -- All evaluations (for HR and Admin)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin', 'hr')
    )
  );

CREATE POLICY "Enhanced KRA evaluations employee modification"
  ON kra_evaluations FOR ALL
  TO authenticated
  USING (
    -- Employee can modify their own evaluations (employee comments, self-assessment)
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND kra_assignments.employee_id = auth.uid()
      AND kra_assignments.status IN ('assigned', 'in_progress')
    )
  )
  WITH CHECK (
    -- Employee can modify their own evaluations (employee comments, self-assessment)
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND kra_assignments.employee_id = auth.uid()
      AND kra_assignments.status IN ('assigned', 'in_progress')
    )
  );

CREATE POLICY "Enhanced KRA evaluations manager modification"
  ON kra_evaluations FOR ALL
  TO authenticated
  USING (
    -- Manager can modify evaluations for their team (manager comments, final ratings)
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND kra_assignments.assigned_by = auth.uid()
    )
    OR
    -- Team evaluations (for department managers)
    EXISTS (
      SELECT 1 FROM kra_assignments a, users u1, users u2, roles r1
      WHERE a.id = kra_evaluations.assignment_id
      AND u1.id = auth.uid() 
      AND u2.id = a.employee_id
      AND u1.role_id = r1.id
      AND r1.name IN ('sdm', 'bdm', 'qam', 'hrm')
      AND (u1.department_id = u2.department_id OR u1.id = u2.manager_id)
    )
    OR
    -- Full access (Admin only - HR cannot modify evaluations)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    -- Manager can modify evaluations for their team (manager comments, final ratings)
    EXISTS (
      SELECT 1 FROM kra_assignments 
      WHERE kra_assignments.id = kra_evaluations.assignment_id 
      AND kra_assignments.assigned_by = auth.uid()
    )
    OR
    -- Team evaluations (for department managers)
    EXISTS (
      SELECT 1 FROM kra_assignments a, users u1, users u2, roles r1
      WHERE a.id = kra_evaluations.assignment_id
      AND u1.id = auth.uid() 
      AND u2.id = a.employee_id
      AND u1.role_id = r1.id
      AND r1.name IN ('sdm', 'bdm', 'qam', 'hrm')
      AND (u1.department_id = u2.department_id OR u1.id = u2.manager_id)
    )
    OR
    -- Full access (Admin only - HR cannot modify evaluations)
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  );

-- Enhanced KRA Goals Policies (inherit from templates)
CREATE POLICY "Enhanced KRA goals access"
  ON kra_goals FOR SELECT
  TO authenticated
  USING (
    -- Access based on template access
    EXISTS (
      SELECT 1 FROM kra_templates t
      WHERE t.id = kra_goals.template_id
      AND (
        -- Own templates
        t.created_by = auth.uid() 
        OR
        -- Team templates (for managers)
        EXISTS (
          SELECT 1 FROM users u1, users u2, roles r1
          WHERE u1.id = auth.uid() 
          AND u2.id = t.created_by
          AND u1.role_id = r1.id
          AND r1.name IN ('sdm', 'bdm', 'qam', 'hrm')
          AND (u1.department_id = u2.department_id OR u1.id = u2.manager_id)
        )
        OR
        -- All templates (for HR and Admin)
        EXISTS (
          SELECT 1 FROM users, roles 
          WHERE users.id = auth.uid() 
          AND users.role_id = roles.id
          AND roles.name IN ('admin', 'super_admin', 'hr')
        )
      )
    )
  );

CREATE POLICY "Enhanced KRA goals modification"
  ON kra_goals FOR ALL
  TO authenticated
  USING (
    -- Modification based on template ownership
    EXISTS (
      SELECT 1 FROM kra_templates t
      WHERE t.id = kra_goals.template_id
      AND (
        -- Own templates
        t.created_by = auth.uid() 
        OR
        -- Full access (Admin only - HR cannot modify goals)
        EXISTS (
          SELECT 1 FROM users, roles 
          WHERE users.id = auth.uid() 
          AND users.role_id = roles.id
          AND roles.name IN ('admin', 'super_admin')
        )
      )
    )
  )
  WITH CHECK (
    -- Modification based on template ownership
    EXISTS (
      SELECT 1 FROM kra_templates t
      WHERE t.id = kra_goals.template_id
      AND (
        -- Own templates
        t.created_by = auth.uid() 
        OR
        -- Full access (Admin only - HR cannot modify goals)
        EXISTS (
          SELECT 1 FROM users, roles 
          WHERE users.id = auth.uid() 
          AND users.role_id = roles.id
          AND roles.name IN ('admin', 'super_admin')
        )
      )
    )
  );

-- Enhanced KRA Categories Policies (everyone can read, only admins can modify)
CREATE POLICY "Everyone can read KRA categories"
  ON kra_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify KRA categories"
  ON kra_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  );

-- Enhanced KRA Evaluation Levels Policies (everyone can read, only admins can modify)
CREATE POLICY "Everyone can read KRA evaluation levels"
  ON kra_evaluation_levels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify KRA evaluation levels"
  ON kra_evaluation_levels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users, roles 
      WHERE users.id = auth.uid() 
      AND users.role_id = roles.id
      AND roles.name IN ('admin', 'super_admin')
    )
  );

-- Add helpful comments
COMMENT ON POLICY "Enhanced KRA templates access" ON kra_templates IS 
'Manager: team access, HR: all read-only, Admin: all read-write';

COMMENT ON POLICY "Enhanced KRA evaluations access" ON kra_evaluations IS 
'Manager: team access, HR: all read-only, Admin: all read-write, Employee: own access';

COMMENT ON POLICY "Enhanced KRA evaluations manager modification" ON kra_evaluations IS 
'HR can view but not modify evaluations, only Admins and Managers can modify';
