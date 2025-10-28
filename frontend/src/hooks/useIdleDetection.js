import { useState, useEffect, useCallback } from 'react';

const useIdleDetection = (timeout = 15 * 60 * 1000) => { // 15 minutes default
  const [isIdle, setIsIdle] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    setLastActivity(Date.now());
  }, []);

  useEffect(() => {
    let idleTimer;

    const handleActivity = () => {
      resetIdleTimer();
    };

    const checkIdle = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      
      if (timeSinceActivity >= timeout) {
        setIsIdle(true);
      }
    };

    // Add event listeners for user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Check for idle every minute
    idleTimer = setInterval(checkIdle, 60 * 1000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearInterval(idleTimer);
    };
  }, [timeout, lastActivity, resetIdleTimer]);

  return {
    isIdle,
    resetIdleTimer,
    lastActivity
  };
};

export default useIdleDetection;
