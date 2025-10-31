/**
 * Utility to block printing functionality in the application
 */

import { toast } from 'sonner';
import { supabase } from '@/services/supabase';

// Get user ID from localStorage (same as AuthContext)
function getCurrentUserId(): string | null {
  try {
    const userData = localStorage.getItem('hrms_user');
    if (userData) {
      const user = JSON.parse(userData);
      return user?.id || null;
    }
  } catch (error) {
    console.error('Error getting user ID:', error);
  }
  return null;
}

// Check if print blocking is enabled via environment variable
const isPrintBlockingEnabled = () => {
  // Default to true (enabled) if not specified
  const envValue = import.meta.env.VITE_ENABLE_PRINT_BLOCKING;
  return envValue !== 'false' && envValue !== false;
};

// Log print blocking attempt to database
async function logPrintBlockingAttempt(
  actionType: string,
  actionDescription: string,
  keyCombination?: string,
  additionalData?: any
) {
  try {
    const currentUrl = window.location.href;
    const userAgent = navigator.userAgent;
    
    // Get user ID from localStorage (same way as AuthContext)
    const userId = getCurrentUserId();
    
    // If we don't have a user ID, we can't log properly
    if (!userId) {
      console.warn('No user ID available for logging print blocking attempt. User may not be authenticated.');
      return;
    }
    
    console.log('Logging print blocking attempt for user ID:', userId);
    
    const { error } = await supabase.rpc('log_print_blocking_attempt', {
      p_user_id: userId,
      p_action_type: actionType,
      p_action_description: actionDescription,
      p_key_combination: keyCombination || null,
      p_page_url: currentUrl,
      p_user_agent: userAgent,
      p_additional_data: additionalData || null
    });

    if (error) {
      console.error('Failed to log print blocking attempt:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
    } else {
      console.log(`Successfully logged print blocking attempt: ${actionType} - ${actionDescription} for user ID: ${userId}`);
    }
  } catch (error) {
    console.error('Error logging print blocking attempt:', error);
  }
}

/**
 * Show a toast notification that an action was blocked and log it
 */
async function showBlockedNotification(
  action: string, 
  actionType: string, 
  keyCombination?: string,
  additionalData?: any
) {
  try {
    toast.error(`${action} is disabled for security reasons.`);
    console.log(`Blocked action: ${action}`);
    
    // Log the attempt to database
    await logPrintBlockingAttempt(actionType, action, keyCombination, additionalData);
  } catch (error) {
    console.error('Failed to show toast:', error);
    // Fallback to alert if toast is not available
    alert(`${action} is disabled for security reasons.`);
    
    // Still try to log even if toast fails
    try {
      await logPrintBlockingAttempt(actionType, action, keyCombination, additionalData);
    } catch (logError) {
      console.error('Failed to log print blocking attempt:', logError);
    }
  }
}

/**
 * Initialize print blocking by preventing keyboard shortcuts and print events
 */
export function blockPrinting(): () => void {
  // Check if print blocking is enabled
  if (!isPrintBlockingEnabled()) {
    console.log('Print blocking is disabled via environment variable');
    return () => {}; // Return empty cleanup function
  }

  // Prevent keyboard shortcuts (Ctrl+P, Cmd+P)
  const handleKeyDown = (event: KeyboardEvent) => {
    const getKeyCombo = () => {
      const parts = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.metaKey) parts.push('Cmd');
      if (event.shiftKey) parts.push('Shift');
      if (event.altKey) parts.push('Alt');
      parts.push(event.key);
      return parts.join('+');
    };

    if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
      event.preventDefault();
      event.stopPropagation();
      showBlockedNotification('Printing', 'print', getKeyCombo());
      return false;
    }
    
    // Also block Ctrl+S and Cmd+S to prevent saving pages
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      event.stopPropagation();
      showBlockedNotification('Saving pages', 'save', getKeyCombo());
      return false;
    }
    
    // Block Print Screen
    if (event.key === 'PrintScreen') {
      event.preventDefault();
      event.stopPropagation();
      showBlockedNotification('Screenshots', 'screenshot', getKeyCombo());
      return false;
    }
    
    // Block Ctrl+C, Ctrl+V, Ctrl+A for added security (but allow in inputs)
    const target = event.target as HTMLElement;
    const isInput = target instanceof HTMLInputElement || 
                   target instanceof HTMLTextAreaElement ||
                   (target.getAttribute('contenteditable') === 'true' && target.closest('[contenteditable="true"]'));
    
    if (!isInput) {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'v' || event.key === 'a' || event.key === 'x')) {
        event.preventDefault();
        event.stopPropagation();
        const actionMap: { [key: string]: string } = {
          'c': 'Copying text',
          'v': 'Pasting text', 
          'a': 'Selecting all text',
          'x': 'Cutting text'
        };
        showBlockedNotification(actionMap[event.key] || 'Copying/Cutting text', 'copy', getKeyCombo(), {
          targetElement: target.tagName,
          targetClass: target.className
        });
        return false;
      }
    }
  };

  // Prevent print dialog from opening
  const handleBeforePrint = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    showBlockedNotification('Printing', 'print', 'Browser Print Dialog');
    return false;
  };

  // Prevent right-click context menu (alternative way to access print)
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    showBlockedNotification('Right-click menu', 'context_menu', 'Right Click', {
      targetElement: target.tagName,
      targetClass: target.className,
      mousePosition: { x: event.clientX, y: event.clientY }
    });
    return false;
  };

  // Add event listeners
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('beforeprint', handleBeforePrint);
  window.addEventListener('contextmenu', handleContextMenu);

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('beforeprint', handleBeforePrint);
    window.removeEventListener('contextmenu', handleContextMenu);
  };
}

/**
 * Block common printing and screenshot methods
 */
export function initializePrintBlocking() {
  // Check if print blocking is enabled
  if (!isPrintBlockingEnabled()) {
    console.log('Additional print blocking features are disabled via environment variable');
    return;
  }

  // Prevent screenshot shortcuts
  const blockScreenshots = () => {
    const getKeyCombo = (e: KeyboardEvent) => {
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.metaKey) parts.push('Cmd');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      parts.push(e.key);
      return parts.join('+');
    };

    document.addEventListener('keydown', (e) => {
      // Block Windows+Shift+S (Windows Snipping Tool)
      if (e.key === 's' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        showBlockedNotification('Screenshots', 'screenshot', getKeyCombo(e), {
          tool: 'Windows Snipping Tool'
        });
      }
      
      // Block Windows+G (Game Bar screenshot on Windows)
      if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        showBlockedNotification('Screenshots', 'screenshot', getKeyCombo(e), {
          tool: 'Windows Game Bar'
        });
      }
    }, { capture: true });

    // Block Cmd+Shift+4 and Cmd+Shift+3 (Mac screenshots)
    document.addEventListener('keydown', (e) => {
      if ((e.key === '3' || e.key === '4') && e.shiftKey && e.metaKey) {
        e.preventDefault();
        const tool = e.key === '3' ? 'Mac Full Screen Screenshot' : 'Mac Area Screenshot';
        showBlockedNotification('Screenshots', 'screenshot', getKeyCombo(e), {
          tool: tool
        });
      }
    }, { capture: true });
  };

  // Prevent text selection (common workaround for blocking print)
  const blockTextSelection = () => {
    document.addEventListener('selectstart', (e) => {
      // Allow text selection for form inputs
      const target = e.target as HTMLElement;
      const isInput = target instanceof HTMLInputElement || 
                     target instanceof HTMLTextAreaElement ||
                     target.getAttribute('contenteditable') === 'true';
      
      if (!isInput && !target.closest('input, textarea, [contenteditable="true"]')) {
        e.preventDefault();
      }
    });
  };

  // Prevent DevTools shortcut (F12, Ctrl+Shift+I, etc.)
  const blockDevTools = () => {
    const getKeyCombo = (e: KeyboardEvent) => {
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.metaKey) parts.push('Cmd');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      parts.push(e.key);
      return parts.join('+');
    };

    document.addEventListener('keydown', (e) => {
      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
        showBlockedNotification('Developer Tools', 'devtools', getKeyCombo(e), {
          method: 'F12 Key'
        });
        return false;
      }
      
      // Block Ctrl+Shift+I (Chrome DevTools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        showBlockedNotification('Developer Tools', 'devtools', getKeyCombo(e), {
          method: 'DevTools Shortcut'
        });
        return false;
      }
      
      // Block Ctrl+Shift+J (Chrome Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        showBlockedNotification('Developer Tools', 'devtools', getKeyCombo(e), {
          method: 'Console Shortcut'
        });
        return false;
      }
      
      // Block Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        showBlockedNotification('Viewing page source', 'view_source', getKeyCombo(e), {
          method: 'View Source Shortcut'
        });
        return false;
      }
    });
  };

  // Initialize all blocking mechanisms
  blockScreenshots();
  blockTextSelection();
  blockDevTools();
}

