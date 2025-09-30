import React from 'react';
import { AlertTriangle, Clock, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InactivityWarningModalProps {
  isOpen: boolean;
  remainingTime: number;
  onExtendSession: () => void;
  onLogout: () => void;
}

export function InactivityWarningModal({
  isOpen,
  remainingTime,
  onExtendSession,
  onLogout
}: InactivityWarningModalProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Session Timeout Warning
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <div className="text-gray-600">
              Your session will expire due to inactivity.
            </div>
            <div className="flex items-center gap-2 text-red-600 font-medium">
              <Clock className="h-4 w-4" />
              Time remaining: {formatTime(remainingTime)}
            </div>
            <div className="text-sm text-gray-500">
              You will be automatically logged out when the timer reaches zero.
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button
            variant="outline"
            onClick={onLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout Now
          </Button>
          <Button
            onClick={onExtendSession}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
