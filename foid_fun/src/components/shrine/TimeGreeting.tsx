"use client";

import { useState, useEffect } from "react";

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning, believer";
  } else if (hour >= 12 && hour < 17) {
    return "Afternoon prayers await";
  } else if (hour >= 17 && hour < 21) {
    return "Evening blessings";
  } else {
    return "Night whispers";
  }
}

export default function TimeGreeting() {
  const [greeting, setGreeting] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setGreeting(getGreeting());

    // Update greeting every minute
    const interval = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) return null;

  return (
    <div className="time-greeting">
      {greeting}
    </div>
  );
}
