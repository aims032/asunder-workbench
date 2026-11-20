import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { clockDayIndex, clockDayOfWeek, clockRule, createClock, dayRuleIsStill } from './core';
import { MONOSPACED_FONT } from './fonts';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const clock = createClock();

/** The line as it reads at a given moment (Unix seconds). */
function clockLineAt(nowSeconds: number): string {
  const rule = clockRule(clock, nowSeconds);
  const weekday = WEEKDAYS[clockDayOfWeek(clock, nowSeconds)];
  const stillOrMoving = dayRuleIsStill(rule) ? 'STILL' : 'MOVING';
  return `DAY ${clockDayIndex(clock, nowSeconds)} · ${weekday} · ${rule} · ${stillOrMoving}`;
}

/** "DAY 17 · WED · S · STILL", refreshed once a second. */
export function ClockLine() {
  // useState: a value this piece of screen remembers. Changing it redraws the text.
  const [line, setLine] = useState(() => clockLineAt(Date.now() / 1000));

  // useEffect: start a once-a-second timer when this appears, stop it when it goes away.
  useEffect(() => {
    const timer = setInterval(() => setLine(clockLineAt(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return <Text style={styles.line}>{line}</Text>;
}

const styles = StyleSheet.create({
  line: {
    fontFamily: MONOSPACED_FONT,
    fontSize: 12,
    color: '#8e8e93',
  },
});
