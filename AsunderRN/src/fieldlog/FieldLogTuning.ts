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
  /** The faint blue ruled lines. */
  ruleColor: 'rgba(70, 110, 160, 0.22)',
  /** The red margin line. */
  marginColor: 'rgba(170, 60, 50, 0.35)',
  /** Graphite pencil: the main writing. */
  inkColor: '#2D2F36',
  /** Red pencil: corrections and circles. */
  correctionColor: '#A8322A',
  /** The words that surface as the math fades (a slightly warmer ink). */
  wordsColor: '#3B2A1E',
  /** Distance between ruled lines, in points. Every line of writing sits on one. */
  ruleSpacing: 30,
};
