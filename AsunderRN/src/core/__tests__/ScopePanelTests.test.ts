import {
  SCOPE_KNOBS,
  scopeKnobLabel,
  scopeModes,
  scopePanelInitial,
  scopePanelNextMode,
  scopePanelTime,
  scopePanelTriggerLevel,
  scopePanelTurn,
  scopePanelValue,
  scopePanelVolts,
  scopeTimeLabel,
  ScopeTuning,
} from '../index';
import type { ScopeKnob, ScopePanelState } from '../index';

// The scope's front panel as numbers (ScopePanel.ts). New, no Swift version.

/** Turn a knob `clicks` times. */
function turn(panel: ScopePanelState, knob: ScopeKnob, direction: number, clicks: number): ScopePanelState {
  let next = panel;
  for (let i = 0; i < clicks; i += 1) {
    next = scopePanelTurn(next, knob, direction);
  }
  return next;
}

describe('the panel when the app opens', () => {
  const panel = scopePanelInitial();

  test('starts in Waveform at the starting values in ScopeTuning', () => {
    expect(panel.mode).toBe('waveform');
    expect(scopePanelTime(panel)).toBe(ScopeTuning.timePerDivision);
    expect(scopePanelVolts(panel, 1)).toBe(ScopeTuning.voltsPerDivision);
    expect(scopePanelVolts(panel, 2)).toBe(ScopeTuning.voltsPerDivision);
    expect(panel.positionUp).toBe(0);
    expect(panel.positionAcross).toBe(0);
  });

  test('the trigger level follows Volts/div, so it stays put on the screen', () => {
    expect(scopePanelTriggerLevel(panel)).toBeCloseTo(panel.triggerSquares * scopePanelVolts(panel, 1), 12);
    const zoomed = scopePanelTurn(panel, 'volts1', 1);
    expect(zoomed.triggerSquares).toBe(panel.triggerSquares);
    expect(scopePanelTriggerLevel(zoomed)).toBeLessThan(scopePanelTriggerLevel(panel));
  });
});

describe('turning the knobs', () => {
  const panel = scopePanelInitial();

  test('clockwise on Time/div and Volts/div zooms in', () => {
    expect(scopePanelTime(scopePanelTurn(panel, 'time', 1))).toBeLessThan(scopePanelTime(panel));
    expect(scopePanelTime(scopePanelTurn(panel, 'time', -1))).toBeGreaterThan(scopePanelTime(panel));
    expect(scopePanelVolts(scopePanelTurn(panel, 'volts1', 1), 1)).toBeLessThan(scopePanelVolts(panel, 1));
  });

  test('each Volts/div knob only moves its own channel', () => {
    const next = scopePanelTurn(panel, 'volts2', 1);
    expect(scopePanelVolts(next, 1)).toBe(scopePanelVolts(panel, 1));
    expect(scopePanelVolts(next, 2)).toBeLessThan(scopePanelVolts(panel, 2));
  });

  test('every knob stops at both ends instead of running off', () => {
    for (const knob of SCOPE_KNOBS) {
      for (const direction of [1, -1]) {
        const end = turn(panel, knob, direction, 100);
        expect(scopePanelValue(scopePanelTurn(end, knob, direction), knob)).toBe(scopePanelValue(end, knob));
        expect(Number.isFinite(scopePanelValue(end, knob))).toBe(true);
      }
    }
  });

  test('every knob changes something, and only its own setting', () => {
    for (const knob of SCOPE_KNOBS) {
      const next = scopePanelTurn(panel, knob, -1);
      expect(scopePanelValue(next, knob)).not.toBe(scopePanelValue(panel, knob));
      for (const other of SCOPE_KNOBS) {
        if (other !== knob) {
          expect(scopePanelValue(next, other)).toBe(scopePanelValue(panel, other));
        }
      }
    }
  });

  test('the positions reach the edges of the grid and no further', () => {
    expect(turn(panel, 'positionUp', 1, 100).positionUp).toBe(ScopeTuning.gridUp / 2);
    expect(turn(panel, 'positionAcross', -1, 100).positionAcross).toBe(-ScopeTuning.gridAcross / 2);
  });

  test('ten clicks one way and ten back lands exactly where it started', () => {
    const there = turn(panel, 'intensity', -1, 5);
    expect(turn(there, 'intensity', 1, 5).intensity).toBe(panel.intensity);
    const up = turn(panel, 'positionUp', 1, 7);
    expect(turn(up, 'positionUp', -1, 7).positionUp).toBe(0);
  });

  test('intensity never goes fully dark', () => {
    expect(turn(panel, 'intensity', -1, 100).intensity).toBeCloseTo(ScopeTuning.lowestIntensity, 10);
  });
});

describe('the mode switch', () => {
  test('goes Waveform, XY, Picture and round again', () => {
    expect(scopeModes()).toEqual(['waveform', 'xy', 'picture']);
    let panel = scopePanelInitial();
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      seen.push(panel.mode);
      panel = scopePanelNextMode(panel);
    }
    expect(seen).toEqual(['waveform', 'xy', 'picture', 'waveform']);
  });
});

describe('what the knobs read', () => {
  test('times read the way a scope writes them', () => {
    expect(scopeTimeLabel(0.002)).toBe('2 ms');
    expect(scopeTimeLabel(0.0001)).toBe('100 µs');
    expect(scopeTimeLabel(0.05)).toBe('50 ms');
    expect(scopeTimeLabel(2)).toBe('2 s');
  });

  test('every knob has something to show', () => {
    const panel = scopePanelInitial();
    for (const knob of SCOPE_KNOBS) {
      expect(scopeKnobLabel(panel, knob).length).toBeGreaterThan(0);
    }
    expect(scopeKnobLabel(panel, 'time')).toBe('2 ms');
    expect(scopeKnobLabel(panel, 'trigger')).toBe('1.25');
  });
});
