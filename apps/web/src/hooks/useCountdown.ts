import { useState, useEffect } from "react";

interface CountdownResult {
  minutes: number;
  seconds: number;
  expired: boolean;
  formatted: string;
}

export function useCountdown(expiresAt: string | Date): CountdownResult {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(expiresAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(expiresAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return timeLeft;
}

function calculateTimeLeft(expiresAt: string | Date): CountdownResult {
  const now = new Date().getTime();
  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;

  if (diff <= 0) {
    return { minutes: 0, seconds: 0, expired: true, formatted: "00:00" };
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    minutes,
    seconds,
    expired: false,
    formatted: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}
