// THE SWITCHBOARD: which cables are plugged in where, and where the knobs sit.
// Pure logic, no screen. The desk screen (src/desk) draws it.
//
// It speaks the same four change messages as the video synth's patch engine
// (Evan's handoff, Nov 23), so the two can be joined later:
//   set      turn a knob:              { kind: 'set', control, value }
//   patch    plug a cable in:          { kind: 'patch', from, to }
//   unpatch  pull the cable from a jack: { kind: 'unpatch', to }
//   load     replace the whole board:  { kind: 'load', board }
// "from" is always an OUTPUT jack and "to" an INPUT jack, like a patch bay:
// an output can feed many inputs, but an input takes only one cable, so
// plugging a new cable into a busy input replaces the old one.
//
// What's NOT decided (don't build on it): what the switchboard is in the
// story (the mill's phones, a listener fidget toy, or both), how many jacks
// it has and what they're called, what patching does to the sound, and how
// it looks. The jacks below are a plain placeholder layout so the logic can
// be built and tested. Change SWITCHBOARD_LAYOUT freely.
// Decided so far (Evan, Nov 23): the outputs are the mill's phone lines, and
// patching one into the analyzer shows that line on the analyzer's LINE input.
//
// RULE: a helper function has to be written ABOVE the first place it is used
// (see the DeclarationOrder test).
'worklet';

/** The jacks and knobs a board has. Names are placeholders. */
export interface SwitchboardLayout {
  outputs: string[];
  inputs: string[];
  controls: string[];
}

/** The input jack that feeds the spectrum analyzer's LINE input. */
export const ANALYZER_JACK = 'analyzer';

/**
 * Placeholder layout.
 * Outputs are the mill's phone lines (Evan, Nov 23: a fixed network wired
 * through the mill, so each line is a place). How many there are and where
 * each one sits is Evan's to say; until then they're numbered.
 * Inputs are the instruments a line can be patched into. Only the analyzer
 * listens so far; the scope and the ear are there for what comes next.
 */
export const SWITCHBOARD_LAYOUT: SwitchboardLayout = {
  outputs: ['line-1', 'line-2', 'line-3', 'line-4', 'line-5', 'line-6'],
  inputs: [ANALYZER_JACK, 'scope', 'ear'],
  controls: ['knob-1', 'knob-2'],
};

/** Where every cable and knob is right now. */
export interface SwitchboardState {
  /** input jack -> the output jack its cable comes from. */
  cables: Record<string, string>;
  /** knob -> where it's turned, 0 (all the way left) to 1 (all the way right). */
  controls: Record<string, number>;
}

/** One change to the board (see the top of this file). */
export type SwitchboardChange =
  | { kind: 'set'; control: string; value: number }
  | { kind: 'patch'; from: string; to: string }
  | { kind: 'unpatch'; to: string }
  | { kind: 'load'; board: SwitchboardState };

/** The answer to a change: the new board, or why it was refused. */
export type SwitchboardResult = { ok: true; board: SwitchboardState } | { ok: false; reason: string };

/** A board with no cables and every knob at the middle. */
export function emptySwitchboard(layout: SwitchboardLayout): SwitchboardState {
  const controls: Record<string, number> = {};
  for (const name of layout.controls) {
    controls[name] = 0.5;
  }
  return { cables: {}, controls: controls };
}

/** Keep a knob position between 0 and 1 (and turn "not a number" into 0). */
export function clampKnob(value: number): number {
  if (!(value >= 0)) {
    return 0;
  }
  return value > 1 ? 1 : value;
}

/** Is every cable and knob in this board one the layout actually has? */
export function switchboardFitsLayout(board: SwitchboardState, layout: SwitchboardLayout): boolean {
  for (const to of Object.keys(board.cables)) {
    if (!layout.inputs.includes(to) || !layout.outputs.includes(board.cables[to])) {
      return false;
    }
  }
  for (const name of Object.keys(board.controls)) {
    if (!layout.controls.includes(name)) {
      return false;
    }
  }
  return true;
}

/**
 * Apply one change. Returns the new board, or refuses with a reason if the
 * change names a jack or knob the layout doesn't have, or plugs into the
 * wrong kind of jack. The old board is never modified.
 */
export function switchboardApply(
  board: SwitchboardState,
  layout: SwitchboardLayout,
  change: SwitchboardChange,
): SwitchboardResult {
  if (change.kind === 'set') {
    if (!layout.controls.includes(change.control)) {
      return { ok: false, reason: `no knob called ${change.control}` };
    }
    return {
      ok: true,
      board: { cables: board.cables, controls: { ...board.controls, [change.control]: clampKnob(change.value) } },
    };
  }
  if (change.kind === 'patch') {
    if (!layout.outputs.includes(change.from)) {
      return { ok: false, reason: `${change.from} is not an output jack` };
    }
    if (!layout.inputs.includes(change.to)) {
      return { ok: false, reason: `${change.to} is not an input jack` };
    }
    return { ok: true, board: { cables: { ...board.cables, [change.to]: change.from }, controls: board.controls } };
  }
  if (change.kind === 'unpatch') {
    if (!layout.inputs.includes(change.to)) {
      return { ok: false, reason: `${change.to} is not an input jack` };
    }
    const cables = { ...board.cables };
    delete cables[change.to];
    return { ok: true, board: { cables: cables, controls: board.controls } };
  }
  // 'load'
  if (!switchboardFitsLayout(change.board, layout)) {
    return { ok: false, reason: 'that board has jacks or knobs this layout does not' };
  }
  const controls = { ...emptySwitchboard(layout).controls };
  for (const name of Object.keys(change.board.controls)) {
    controls[name] = clampKnob(change.board.controls[name]);
  }
  return { ok: true, board: { cables: { ...change.board.cables }, controls: controls } };
}

/** How many cables are plugged in. */
export function switchboardCableCount(board: SwitchboardState): number {
  return Object.keys(board.cables).length;
}
