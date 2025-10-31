# Print Blocking Configuration

This application includes a comprehensive print blocking system that can be controlled via environment variables.

## Environment Variable

The print blocking functionality is controlled by the `VITE_ENABLE_PRINT_BLOCKING` environment variable.

### To Enable Print Blocking (Production)
```bash
VITE_ENABLE_PRINT_BLOCKING=true
```
or simply omit the variable (defaults to enabled)

### To Disable Print Blocking (Development)
```bash
VITE_ENABLE_PRINT_BLOCKING=false
```

## How to Configure

### Option 1: Create .env file
Create a `.env` file in the project root:
```
VITE_ENABLE_PRINT_BLOCKING=false
```

### Option 2: Create environment-specific files
- `.env.development` - for development environment
- `.env.production` - for production environment

Example `.env.development`:
```
# Development environment configuration
# Disable print blocking for development/testing
VITE_ENABLE_PRINT_BLOCKING=false
```

Example `.env.production`:
```
# Production environment configuration
# Enable print blocking for security
VITE_ENABLE_PRINT_BLOCKING=true
```

## What Gets Blocked When Enabled

### Keyboard Shortcuts
- **Ctrl+P / Cmd+P** - Print dialog
- **Ctrl+S / Cmd+S** - Save page
- **Print Screen** - Screenshot
- **F12** - Developer Tools
- **Ctrl+Shift+I / Cmd+Shift+I** - Developer Tools
- **Ctrl+Shift+J / Cmd+Shift+J** - Console
- **Ctrl+U / Cmd+U** - View Source
- **Ctrl+C/V/A/X** - Copy/Paste (outside input fields)
- **Windows+Shift+S** - Windows Snipping Tool
- **Cmd+Shift+3/4** - Mac Screenshots

### Other Features
- **Right-click context menu** - Disabled
- **Text selection** - Disabled (except in input fields)
- **Image dragging** - Disabled
- **Print CSS** - Shows security message instead of content

### User Feedback
When a blocked action is attempted, users see a toast notification:
- "Printing is disabled for security reasons."
- "Developer Tools is disabled for security reasons."
- etc.

## Development Usage

When `VITE_ENABLE_PRINT_BLOCKING=false`:
- All keyboard shortcuts work normally
- Developer tools are accessible
- Right-click context menu works
- Text selection is enabled
- No toast notifications for blocked actions
- Console logs indicate print blocking is disabled

This allows developers to:
- Use browser developer tools
- Debug the application
- Test printing functionality
- Copy/paste code snippets
- Take screenshots for documentation

## Implementation Details

The print blocking system consists of:

1. **JavaScript Event Handlers** (`src/utils/printBlocker.ts`)
   - Keyboard event listeners
   - Print event prevention
   - Context menu blocking

2. **CSS Rules** (`src/index.css`)
   - Print media queries
   - Text selection prevention
   - Element dragging prevention

3. **Environment Detection** (`src/App.tsx`)
   - Reads environment variables
   - Conditionally applies blocking
   - Manages CSS classes

## Notification System

When a user attempts a blocked action, the system automatically sends notifications to:

1. **The Employee** - Receives a security alert about the blocked action
2. **HR Users** - All active HR staff receive security alerts
3. **Admin Users** - All active admins and super admins receive alerts
4. **Employee's Manager** - Direct manager receives notification about their team member's action

### Notification Details:
- **Type:** `security`
- **Title:** "Security Alert: Print Blocking Attempt" (for HR/Admin/Manager)
- **Title:** "Action Blocked" (for Employee)
- **Message:** Includes employee name, action type, date and time in IST
- **Timestamp:** All notifications use default database timestamp (IST)
- **Data:** JSONB field contains:
  - `print_blocking_log_id` - Reference to the log entry
  - `action_type` - Type of blocked action
  - `blocked_at` - When the action was blocked
  - `employee_id` - ID of the employee (for manager/HR notifications)
  - `employee_name` - Name of the employee (for manager/HR notifications)

### Database Trigger:
A PostgreSQL trigger (`trigger_notify_print_blocking`) automatically creates notifications after each print blocking attempt is logged. The trigger function runs with `SECURITY DEFINER` privilege to insert notifications for all recipients.

## Security Note

This is a client-side implementation and should not be relied upon as the sole security measure. Determined users can still:
- Disable JavaScript
- Use browser extensions
- Access developer tools through other means
- Use external screenshot tools

For maximum security, implement server-side access controls and consider additional measures like watermarking or session monitoring.
