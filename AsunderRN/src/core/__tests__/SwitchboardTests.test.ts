import { emptySwitchboard, SWITCHBOARD_LAYOUT, switchboardApply, switchboardCableCount } from '../index';
import type { SwitchboardResult, SwitchboardState } from '../index';

// The switchboard (Switchboard.ts). New tests; there's no Swift version.

const layout = SWITCHBOARD_LAYOUT;

/** The board from a result, failing the test if the change was refused. */
function boardOf(result: SwitchboardResult): SwitchboardState {
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`);
  }
  return result.board;
}

describe('SwitchboardTests', () => {
  test('an empty board has no cables and every knob in the middle', () => {
    const board = emptySwitchboard(layout);
    expect(switchboardCableCount(board)).toBe(0);
    for (const name of layout.controls) {
      expect(board.controls[name]).toBe(0.5);
    }
  });

  test('patch plugs an output into an input', () => {
    const board = boardOf(switchboardApply(emptySwitchboard(layout), layout, { kind: 'patch', from: 'out-1', to: 'in-2' }));
    expect(board.cables['in-2']).toBe('out-1');
  });

  test('one output can feed many inputs', () => {
    let board = emptySwitchboard(layout);
    board = boardOf(switchboardApply(board, layout, { kind: 'patch', from: 'out-1', to: 'in-1' }));
    board = boardOf(switchboardApply(board, layout, { kind: 'patch', from: 'out-1', to: 'in-2' }));
    expect(switchboardCableCount(board)).toBe(2);
  });

  test('a new cable into a busy input replaces the old one', () => {
    let board = emptySwitchboard(layout);
    board = boardOf(switchboardApply(board, layout, { kind: 'patch', from: 'out-1', to: 'in-1' }));
    board = boardOf(switchboardApply(board, layout, { kind: 'patch', from: 'out-3', to: 'in-1' }));
    expect(board.cables['in-1']).toBe('out-3');
    expect(switchboardCableCount(board)).toBe(1);
  });

  test('unpatch pulls the cable out', () => {
    let board = boardOf(switchboardApply(emptySwitchboard(layout), layout, { kind: 'patch', from: 'out-1', to: 'in-1' }));
    board = boardOf(switchboardApply(board, layout, { kind: 'unpatch', to: 'in-1' }));
    expect(switchboardCableCount(board)).toBe(0);
  });

  test('wrong-way or unknown jacks are refused', () => {
    const board = emptySwitchboard(layout);
    expect(switchboardApply(board, layout, { kind: 'patch', from: 'in-1', to: 'in-2' }).ok).toBe(false);
    expect(switchboardApply(board, layout, { kind: 'patch', from: 'out-1', to: 'out-2' }).ok).toBe(false);
    expect(switchboardApply(board, layout, { kind: 'unpatch', to: 'nowhere' }).ok).toBe(false);
    expect(switchboardApply(board, layout, { kind: 'set', control: 'nope', value: 1 }).ok).toBe(false);
  });

  test('set turns a knob and keeps it between 0 and 1', () => {
    let board = emptySwitchboard(layout);
    board = boardOf(switchboardApply(board, layout, { kind: 'set', control: 'knob-1', value: 0.8 }));
    expect(board.controls['knob-1']).toBe(0.8);
    board = boardOf(switchboardApply(board, layout, { kind: 'set', control: 'knob-1', value: 7 }));
    expect(board.controls['knob-1']).toBe(1);
    board = boardOf(switchboardApply(board, layout, { kind: 'set', control: 'knob-1', value: NaN }));
    expect(board.controls['knob-1']).toBe(0);
  });

  test('load replaces the whole board, and refuses one that does not fit', () => {
    const saved: SwitchboardState = { cables: { 'in-4': 'out-2' }, controls: { 'knob-2': 0.1 } };
    const board = boardOf(switchboardApply(emptySwitchboard(layout), layout, { kind: 'load', board: saved }));
    expect(board.cables).toEqual({ 'in-4': 'out-2' });
    expect(board.controls['knob-2']).toBe(0.1);
    expect(board.controls['knob-1']).toBe(0.5);
    const bad: SwitchboardState = { cables: { 'in-99': 'out-1' }, controls: {} };
    expect(switchboardApply(board, layout, { kind: 'load', board: bad }).ok).toBe(false);
  });

  test('a change never edits the old board', () => {
    const before = emptySwitchboard(layout);
    switchboardApply(before, layout, { kind: 'patch', from: 'out-1', to: 'in-1' });
    expect(switchboardCableCount(before)).toBe(0);
  });
});
