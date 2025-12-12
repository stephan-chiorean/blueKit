import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

interface TimerContextType {
  isPinned: boolean;
  isRunning: boolean;
  elapsedTime: number;
  pinTimer: () => void;
  unpinTimer: () => void;
  togglePin: () => void;
  startTimer: () => void;
  stopTimer: () => void;
  restartTimer: () => void;
  formatTime: (seconds: number) => string;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

const STORAGE_KEY = 'bluekit-timer-state';

interface TimerState {
  isPinned: boolean;
  isRunning: boolean;
  elapsedTime: number;
  startTime: number | null;
  pausedTime: number;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [isPinned, setIsPinned] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state: TimerState = JSON.parse(saved);
        setIsPinned(state.isPinned);
        setIsRunning(false); // Always start stopped after reload
        setElapsedTime(state.elapsedTime);
        pausedTimeRef.current = state.pausedTime;
        startTimeRef.current = 0;
      }
    } catch (error) {
      console.error('Failed to load timer state:', error);
    }
  }, []);

  // Persist state whenever it changes
  useEffect(() => {
    try {
      const state: TimerState = {
        isPinned,
        isRunning,
        elapsedTime,
        startTime: startTimeRef.current,
        pausedTime: pausedTimeRef.current,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  }, [isPinned, isRunning, elapsedTime]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Pin timer
  const pinTimer = () => setIsPinned(true);
  const unpinTimer = () => setIsPinned(false);
  const togglePin = () => setIsPinned(prev => !prev);

  // Start timer
  const startTimer = () => {
    if (!isRunning) {
      const now = Date.now();
      // Calculate start time based on current elapsed time
      startTimeRef.current = now - (elapsedTime * 1000);
      setIsRunning(true);
    }
  };

  // Stop timer
  const stopTimer = () => {
    setIsRunning(false);
    // elapsedTime is already updated by the interval, so we just stop
  };

  // Restart timer
  const restartTimer = () => {
    setIsRunning(false);
    setElapsedTime(0);
    pausedTimeRef.current = 0;
    startTimeRef.current = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Update timer every 100ms for smooth display
  useEffect(() => {
    if (isRunning && startTimeRef.current > 0) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        setElapsedTime(elapsed);
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <TimerContext.Provider
      value={{
        isPinned,
        isRunning,
        elapsedTime,
        pinTimer,
        unpinTimer,
        togglePin,
        startTimer,
        stopTimer,
        restartTimer,
        formatTime,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
