import { useEffect, useRef, useState } from "react";

interface Options {
  timeout: number; // ms
  onTimeout: () => void;
  enabled?: boolean;
}

export function useInactivityTimeout({ timeout, onTimeout, enabled = true }: Options) {
  const [isWarning, setIsWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      console.log("⏸️ Inactivity disabled");
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    console.log("▶️ Inactivity monitoring started");

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        console.log("⏰ Auto logout triggered!");
        onTimeout();
      }, timeout);

      // reset warning state
      setIsWarning(false);
      setRemainingTime(0);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) =>
      document.addEventListener(event, resetTimer, true)
    );

    // start timer immediately
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) =>
        document.removeEventListener(event, resetTimer, true)
      );
    };
  }, [timeout, onTimeout, enabled]);

  // stub for now
  const extendSession = () => {
    console.log("🔄 Session extended manually");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(onTimeout, timeout);
    setIsWarning(false);
  };

  return {
    isWarning,
    remainingTime,
    extendSession,
  };
}

// import { useEffect, useRef, useCallback, useState } from 'react';

// interface UseInactivityTimeoutOptions {
//   timeout: number; // timeout in milliseconds
//   warningTime: number; // warning time before timeout in milliseconds
//   onTimeout: () => void;
//   onWarning?: () => void;
//   onActivity?: () => void;
//   enabled?: boolean;
// }

// export const useInactivityTimeout = ({
//   timeout,
//   warningTime,
//   onTimeout,
//   onWarning,
//   onActivity,
//   enabled = true
// }: UseInactivityTimeoutOptions) => {
//   const [isWarning, setIsWarning] = useState(false);
//   const [remainingTime, setRemainingTime] = useState(0);
  
//   const timeoutRef = useRef<number | null>(null);
//   const warningTimeoutRef = useRef<number | null>(null);
//   const lastActivityRef = useRef<number>(Date.now());
//   const countdownRef = useRef<number | null>(null);

//   // Clear all timers
//   const clearTimers = useCallback(() => {
//     if (timeoutRef.current) {
//       clearTimeout(timeoutRef.current);
//       timeoutRef.current = null;
//     }
//     if (warningTimeoutRef.current) {
//       clearTimeout(warningTimeoutRef.current);
//       warningTimeoutRef.current = null;
//     }
//     if (countdownRef.current) {
//       clearTimeout(countdownRef.current);
//       countdownRef.current = null;
//     }
//   }, []);

//   // Start countdown timer for warning dialog
//   const startCountdown = useCallback(() => {
//     const updateCountdown = () => {
//       const now = Date.now();
//       const timeUntilTimeout = timeout - (now - lastActivityRef.current);
      
//       if (timeUntilTimeout <= 0) {
//         setRemainingTime(0);
//         clearTimers();
//         // Don't call onTimeout here, it will be called by the timeout timer
//         return;
//       }
      
//       setRemainingTime(Math.ceil(timeUntilTimeout / 1000));
//       // Update every 500ms to ensure we don't miss the exact timeout
//       countdownRef.current = setTimeout(updateCountdown, 500);
//     };
    
//     updateCountdown();
//   }, [timeout, clearTimers]);

//   // Reset the timers
//   // Reset the timers
// const resetTimers = useCallback(() => {
//   if (!enabled) return;

//   clearTimers();
//   setIsWarning(false);
//   setRemainingTime(0);
//   lastActivityRef.current = Date.now();

//   // Show warning before timeout
//   warningTimeoutRef.current = window.setTimeout(() => {
//     setIsWarning(true);
//     startCountdown();
//     onWarning?.();
//   }, Math.max(0, timeout - warningTime));

//   // Hard timeout
//   timeoutRef.current = window.setTimeout(() => {
//     clearTimers();
//     setIsWarning(false);
//     onTimeout(); // ✅ call directly, no "hasTimedOut" re-check
//   }, timeout);
// }, [enabled, timeout, warningTime, onTimeout, onWarning, clearTimers, startCountdown]);

//   // const resetTimers = useCallback(() => {
//   //   if (!enabled) return;
    
//   //   clearTimers();
//   //   setIsWarning(false);
//   //   setRemainingTime(0);
//   //   lastActivityRef.current = Date.now();

//   //   // Set warning timer
//   //   warningTimeoutRef.current = setTimeout(() => {
//   //     setIsWarning(true);
//   //     startCountdown();
//   //     onWarning?.();
//   //   }, Math.max(0, timeout - warningTime));

//   //   // Set timeout timer - ensure it's set AFTER the warning time
//   //   timeoutRef.current = setTimeout(() => {
//   //     const hasTimedOut = Date.now() - lastActivityRef.current >= timeout;
//   //     if (hasTimedOut) {
//   //       clearTimers();
//   //       setIsWarning(false);
//   //       onTimeout();
//   //     }
//   //   }, Math.max(0, timeout));
//   // }, [enabled, timeout, warningTime, onTimeout, onWarning, clearTimers, startCountdown]);

//   // Handle user activity
//   const handleActivity = useCallback(() => {
//     if (!enabled) return;
    
//     resetTimers();
//     onActivity?.();
//   }, [enabled, resetTimers, onActivity]);

//   // Extend session (called from warning dialog)
//   const extendSession = useCallback(() => {
//     handleActivity();
//   }, [handleActivity]);

//   // Activity event listeners
//   useEffect(() => {
//     if (!enabled) {
//       clearTimers();
//       return;
//     }

//     const events = [
//       'mousedown',
//       'mousemove',
//       'keypress',
//       'scroll',
//       'touchstart',
//       'click',
//       'keydown'
//     ];

//     // Throttle activity detection to avoid excessive timer resets
//     let activityThrottle: number | null = null;
    
//     const throttledHandleActivity = () => {
//       if (activityThrottle) return;
      
//       activityThrottle = setTimeout(() => {
//         handleActivity();
//         activityThrottle = null;
//       }, 1000); // Throttle to once per second
//     };

//     // Add event listeners
//     events.forEach(event => {
//       document.addEventListener(event, throttledHandleActivity, true);
//     });

//     // Initialize timers
//     resetTimers();

//     return () => {
//       // Clean up event listeners
//       events.forEach(event => {
//         document.removeEventListener(event, throttledHandleActivity, true);
//       });
      
//       // Clear timers
//       clearTimers();
      
//       // Clear throttle timeout
//       if (activityThrottle) {
//         clearTimeout(activityThrottle);
//       }
//     };
//   }, [enabled, handleActivity, resetTimers, clearTimers]);

//   // Clean up on unmount
//   useEffect(() => {
//     return () => {
//       clearTimers();
//     };
//   }, [clearTimers]);

//   return {
//     isWarning,
//     remainingTime,
//     extendSession
//   };
// };
