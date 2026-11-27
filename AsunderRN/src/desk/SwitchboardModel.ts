import { emptySwitchboard, SWITCHBOARD_LAYOUT, switchboardApply } from '../core';
import type { SwitchboardChange, SwitchboardLayout, SwitchboardState } from '../core';
import { createStore } from './Store';
import type { Store } from './Store';

// THE LIVE SWITCHBOARD: the board, changed only through the four messages
// (set, patch, unpatch, load; see core/Switchboard.ts). Because every change
// is a message, the same messages could later come from Evan's patch bay or
// go out to a server without changing this file.

export interface SwitchboardModel {
  layout: SwitchboardLayout;
  board: Store<SwitchboardState>;
  /** Apply a change. Returns why it was refused, or null if it worked. */
  apply(change: SwitchboardChange): string | null;
}

export function createSwitchboardModel(layout: SwitchboardLayout = SWITCHBOARD_LAYOUT): SwitchboardModel {
  const board = createStore(emptySwitchboard(layout));
  return {
    layout,
    board,
    apply(change) {
      const result = switchboardApply(board.get(), layout, change);
      if (!result.ok) {
        return result.reason;
      }
      board.set(result.board);
      return null;
    },
  };
}
