import { useState, useEffect, useCallback } from 'react';

// Custom hook for idle detection
export const useIdleDetection = (idleTime = 300000, onIdle, onActive) => { // 5 minutes default
  const [isIdle, setIsIdle] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [timeUntilIdle, setTimeUntilIdle] = useState(idleTime);

  const resetTimer = useCallback(() => {
    setIsIdle(false);
    setIdleWarning(false);
    setTimeUntilIdle(idleTime);
  }, [idleTime]);

  const handleActivity = useCallback(() => {
    if (isIdle) {
      onActive?.();
    }
    resetTimer();
  }, [isIdle, onActive, resetTimer]);

  useEffect(() => {
    let warningTimer;
    let idleTimer;

    const setupTimers = () => {
      // Warning timer (30 seconds before idle)
      warningTimer = setTimeout(() => {
        if (!isIdle) {
          setIdleWarning(true);
          setTimeUntilIdle(30000); // 30 seconds warning
        }
      }, idleTime - 30000);

      // Idle timer
      idleTimer = setTimeout(() => {
        if (!isIdle) {
          setIsIdle(true);
          setIdleWarning(false);
          onIdle?.();
        }
      }, idleTime);
    };

    const clearTimers = () => {
      clearTimeout(warningTimer);
      clearTimeout(idleTimer);
    };

    setupTimers();

    // Activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Page visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, consider idle
        clearTimers();
        if (!isIdle) {
          setIsIdle(true);
          onIdle?.();
        }
      } else {
        // Page is visible, reset timers
        resetTimer();
        setupTimers();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimers();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [idleTime, isIdle, onIdle, handleActivity, resetTimer]);

  // Countdown timer for warning
  useEffect(() => {
    if (!idleWarning) return;

    const countdown = setInterval(() => {
      setTimeUntilIdle(prev => {
        if (prev <= 1000) {
          clearInterval(countdown);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [idleWarning]);

  return {
    isIdle,
    idleWarning,
    timeUntilIdle,
    resetTimer
  };
};

// Utility function to format time
export const formatTime = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
