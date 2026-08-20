import { useState, useEffect, useCallback, useRef } from 'react';
import { ActiveSsoUser } from '../types';

interface UseSessionTimeoutOptions {
  timeoutMinutes: number;
  activeUser: ActiveSsoUser;
  onTimeout: (user: ActiveSsoUser) => void;
  enabled?: boolean;
}

export function useSessionTimeout({
  timeoutMinutes,
  activeUser,
  onTimeout,
  enabled = true
}: UseSessionTimeoutOptions) {
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(
    Math.max(1, timeoutMinutes) * 60 * 1000
  );
  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  const activeUserRef = useRef(activeUser);
  const hasTimedOutRef = useRef<boolean>(false);

  // Keep references updated
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    activeUserRef.current = activeUser;
  }, [onTimeout, activeUser]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    hasTimedOutRef.current = false;
    setTimeRemainingMs(Math.max(1, timeoutMinutes) * 60 * 1000);
  }, [timeoutMinutes]);

  useEffect(() => {
    if (!enabled || !activeUser || !activeUser.isAuthenticated) {
      return;
    }

    lastActivityRef.current = Date.now();
    hasTimedOutRef.current = false;
    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;

    const handleUserActivity = () => {
      // Throttle updates: only reset if more than 1 second has elapsed since last update
      const now = Date.now();
      if (now - lastActivityRef.current > 1000) {
        lastActivityRef.current = now;
        hasTimedOutRef.current = false;
      }
    };

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'focus'
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        setTimeRemainingMs(0);
        if (!hasTimedOutRef.current && activeUserRef.current.isAuthenticated) {
          hasTimedOutRef.current = true;
          if (onTimeoutRef.current) {
            onTimeoutRef.current(activeUserRef.current);
          }
        }
      } else {
        setTimeRemainingMs(remaining);
      }
    }, 1000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      clearInterval(interval);
    };
  }, [timeoutMinutes, enabled, activeUser?.isAuthenticated]);

  return {
    resetTimer,
    timeRemainingMs,
    timeoutMinutes
  };
}
