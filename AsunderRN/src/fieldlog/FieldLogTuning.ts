/**
 * The feel numbers for the field log, all in one place. Change these to
 * change how the notebook looks and how the fade plays. (Kept out of
 * core/Tuning.ts on purpose: that file is checked against the Swift app.)
 */
export const FieldLogTuning = {
  /**
   * STUB for unlocking: pages with `unlocksAt` up to this number are open.
   * Set high while building so every page shows. When transmissions are
   * real, this becomes "how many transmissions has this phone received".
   */
  unlockedThrough: 99,

  /**
   * How many seconds the symbols take to dissolve to their page's `fade`
   * level after you turn to a page. Longer = slower, more dreamlike.
   */
  fadeSeconds: 6,

  /**
   * How soft the edge of the fade is, from 0 to 1. Small = symbols vanish
   * one by one like a wipe. Large = the whole line dims together.
   */
  fadeSoftness: 0.35,

  /**
   * How out of order the symbols go, from 0 to 1. 0 = strictly left to
   * right. Higher = a scattered order, like ink lifting in patches. The
   * order is fixed (worked out from the letter's position), so a page fades
   * the same way every time.
   */
  fadeScatter: 0.45,

  // MARK: The look (PLACEHOLDER until Evan's art, Phase 4)

  /** The paper. */
  paperColor: '#EFE6CF',
  /**
   * What the paper looks like: 'blank' or 'dotted' (Evan, Nov 25: blank or
   * dotted paper, not ruled).
   */
  paperStyle: 'dotted' as 'blank' | 'dotted',
  /** Dotted paper: the gap between dots, in points. Bigger = a looser grid. */
  dotSpacing: 20,
  /** Dotted paper: how wide each dot is, in points. */
  dotSize: 2,
  /** Dotted paper: the dot colour. Keep it faint so the ink sits on top. */
  dotColor: 'rgba(60, 50, 35, 0.28)',
  /** Graphite pencil: the main writing. */
  inkColor: '#2D2F36',
  /** Red pencil: corrections and circles. */
  correctionColor: '#A8322A',
  /** The words that surface as the math fades (a slightly warmer ink). */
  wordsColor: '#3B2A1E',
  /** How far apart lines of writing sit, in points. Bigger = airier pages. */
  lineSpacing: 30,
};
