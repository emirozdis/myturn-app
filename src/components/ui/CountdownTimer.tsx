// ./src/components/ui/CountdownTimer.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Text } from "./Text";
import { getBusinessClock } from "../../lib/businessTime";

function getSecondsUntilNextCircadianEvent(timezone: string) {
  const { hour, minute, second } = getBusinessClock(new Date(), timezone);
  const currentSeconds = hour * 3600 + minute * 60 + second;
  const isSleepMode = hour < 9;
  return {
    seconds: Math.max(0, (isSleepMode ? 32400 : 86400) - currentSeconds),
    isSleepMode,
  };
}

export function CountdownTimer({
  timezone = "UTC",
  onStateChange,
  color = '#111827',
  shadowColor = 'rgba(255,255,255,0.7)',
}: {
  timezone?: string;
  onStateChange?: (isSleepMode: boolean) => void;
  color?: string;
  shadowColor?: string;
}) {
  const [state, setState] = useState(() => getSecondsUntilNextCircadianEvent(timezone));

  useEffect(() => {
    const nextState = getSecondsUntilNextCircadianEvent(timezone);
    setState(nextState);
    onStateChange?.(nextState.isSleepMode);

    const id = setInterval(() => {
      const updated = getSecondsUntilNextCircadianEvent(timezone);
      setState(updated);
      onStateChange?.(updated.isSleepMode);
    }, 1000);

    return () => clearInterval(id);
  }, [timezone, onStateChange]);

  const time = state.seconds;
  const h = String(Math.floor(time / 3600)).padStart(2, "0");
  const m = String(Math.floor((time % 3600) / 60)).padStart(2, "0");
  const s = String(time % 60).padStart(2, "0");

  return (
    <Text
      weight="bold"
      style={{ color, fontSize: 12, fontFamily: 'Satoshi-Bold', marginLeft: 6, textShadowColor: shadowColor, textShadowOffset: { width: 0, height: 0.5 }, textShadowRadius: 1 }}
    >
      {h}:{m}:{s}
    </Text>
  );
}
