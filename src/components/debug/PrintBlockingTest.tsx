import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Eye, Copy, Save, Printer, Keyboard } from 'lucide-react';
import { toast } from 'sonner';

export function PrintBlockingTest() {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testPrintBlocking = () => {
    addTestResult('Testing print blocking...');
    
    // Simulate Ctrl+P
    const event = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(event);
    
    if (event.defaultPrevented) {
      addTestResult('✅ Print blocking is working - Ctrl+P was blocked');
    } else {
      addTestResult('❌ Print blocking failed - Ctrl+P was not blocked');
    }
  };

  const testSaveBlocking = () => {
    addTestResult('Testing save blocking...');
    
    // Simulate Ctrl+S
    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(event);
    
    if (event.defaultPrevented) {
      addTestResult('✅ Save blocking is working - Ctrl+S was blocked');
    } else {
      addTestResult('❌ Save blocking failed - Ctrl+S was not blocked');
    }
  };

  const testDevToolsBlocking = () => {
    addTestResult('Testing DevTools blocking...');
    
    // Simulate F12
    const event = new KeyboardEvent('keydown', {
      key: 'F12',
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(event);
    
    if (event.defaultPrevented) {
      addTestResult('✅ DevTools blocking is working - F12 was blocked');
    } else {
      addTestResult('❌ DevTools blocking failed - F12 was not blocked');
    }
  };

  const testContextMenu = () => {
    addTestResult('Testing context menu blocking...');
    
    // Simulate right-click
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100
    });
    
    document.dispatchEvent(event);
    
    if (event.defaultPrevented) {
      addTestResult('✅ Context menu blocking is working - Right-click was blocked');
    } else {
      addTestResult('❌ Context menu blocking failed - Right-click was not blocked');
    }
  };

  const testCopyBlocking = () => {
    addTestResult('Testing copy blocking...');
    
    // Simulate Ctrl+C on non-input element
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    
    // Set target to a non-input element
    Object.defineProperty(event, 'target', {
      value: document.body,
      enumerable: true
    });
    
    document.dispatchEvent(event);
    
    if (event.defaultPrevented) {
      addTestResult('✅ Copy blocking is working - Ctrl+C was blocked');
    } else {
      addTestResult('❌ Copy blocking failed - Ctrl+C was not blocked');
    }
  };

  const testPrintScreenBlocking = () => {
    addTestResult('Testing PrintScreen blocking...');
    
    // Simulate PrintScreen
    const event = new KeyboardEvent('keydown', {
      key: 'PrintScreen',
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(event);
    
    if (event.defaultPrevented) {
      addTestResult('✅ PrintScreen blocking is working - PrintScreen was blocked');
    } else {
      addTestResult('❌ PrintScreen blocking failed - PrintScreen was not blocked');
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const isPrintBlockingEnabled = import.meta.env.VITE_ENABLE_PRINT_BLOCKING !== 'false';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Print Blocking Test Suite
          </CardTitle>
          <CardDescription>
            Test the print blocking functionality to ensure security measures are working properly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Print blocking is currently{' '}
              <Badge variant={isPrintBlockingEnabled ? 'destructive' : 'secondary'}>
                {isPrintBlockingEnabled ? 'ENABLED' : 'DISABLED'}
              </Badge>
              {!isPrintBlockingEnabled && (
                <span className="ml-2 text-sm text-muted-foreground">
                  (Set VITE_ENABLE_PRINT_BLOCKING=true to enable)
                </span>
              )}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Button
              onClick={testPrintBlocking}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Test Print (Ctrl+P)
            </Button>
            
            <Button
              onClick={testSaveBlocking}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Test Save (Ctrl+S)
            </Button>
            
            <Button
              onClick={testDevToolsBlocking}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              Test DevTools (F12)
            </Button>
            
            <Button
              onClick={testContextMenu}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Keyboard className="h-4 w-4" />
              Test Right-Click
            </Button>
            
            <Button
              onClick={testCopyBlocking}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Test Copy (Ctrl+C)
            </Button>
            
            <Button
              onClick={testPrintScreenBlocking}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Keyboard className="h-4 w-4" />
              Test PrintScreen
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                testPrintBlocking();
                setTimeout(testSaveBlocking, 100);
                setTimeout(testDevToolsBlocking, 200);
                setTimeout(testContextMenu, 300);
                setTimeout(testCopyBlocking, 400);
                setTimeout(testPrintScreenBlocking, 500);
              }}
              className="flex-1"
            >
              Run All Tests
            </Button>
            <Button onClick={clearResults} variant="outline">
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Results from print blocking tests (notifications should appear for blocked actions)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-sm font-mono ${
                    result.includes('✅')
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : result.includes('❌')
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-gray-50 text-gray-800 border border-gray-200'
                  }`}
                >
                  {result}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expected Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>When print blocking is ENABLED:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>All keyboard shortcuts should be blocked and show toast notifications</li>
            <li>Right-click context menu should be blocked</li>
            <li>Each blocked action should create a database log entry</li>
            <li>Notifications should be sent to employee, manager, HR, and admin users</li>
          </ul>
          <p className="mt-4"><strong>When print blocking is DISABLED:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>All keyboard shortcuts should work normally</li>
            <li>No toast notifications should appear</li>
            <li>No database logs should be created</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
