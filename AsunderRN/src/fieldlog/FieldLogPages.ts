/**
 * THE PHYSICIST'S FIELD LOG: the pages, as plain data. Edit this file to
 * change what's written in the notebook. No other code needs to change.
 *
 * WHO WROTE WHAT
 * - Every [BRACKETED] line is a placeholder for Evan's writing. Nothing in
 *   here is story; replace the brackets with your own words.
 * - The equations are DRAFT, NOT CANON. They are Claude's research
 *   suggestions from the Nov 24 chat, staged so the page has something real
 *   on it. Keep, change or delete any of them. Each page says `canon: false`
 *   until you decide it's yours; flip it to true when it is (nothing in the
 *   app treats them differently yet, it's a note to yourself).
 *
 * HOW A LINE IS WRITTEN
 * A page is a list of lines. A line is `{ ink: '...' }`, plus optional bits:
 *
 *   ink        What's written. Two marks work inside it:
 *                ~~like this~~   crossed out (a scratched-out attempt)
 *                ((like this))   circled in red pencil (a correction)
 *   fade       0 to 1. How far this line's symbols have dissolved into words
 *              when the page is fully open. 0 = pure math, 1 = only words.
 *   fadesInto  The words that show up underneath as the symbols fade.
 *   margin     true = a small note in the margin instead of a main line.
 *
 * THE FREQUENCY HEADER (Evan, Nov 25)
 * Out of lab habit, the Physicist writes a frequency and a time at the top of
 * an entry. Give a page `signal: 'transmission-002'` and its header is filled
 * in from TransmissionSchedule.ts (the frequency as the dial shows it, and
 * that entry's logTime), so the clue and the band can never disagree. Leave
 * `signal` out for no header. Which page points to which transmission is
 * yours: the ones below point each page at the NEXT transmission, as a
 * placeholder.
 *
 * WHEN A PAGE SHOWS
 * `unlocksAt` is the transmission number that reveals the page. Unlocking is
 * a stub for now: FieldLogTuning.unlockedThrough decides how many are open
 * (all of them, while building).
 */

export interface LogLine {
  ink: string;
  fade?: number;
  fadesInto?: string;
  margin?: boolean;
}

export interface LogPage {
  /** A short id for code and tests. Not shown. */
  id: string;
  /** Which transmission reveals this page (stubbed, see FieldLogTuning). */
  unlocksAt: number;
  /** Shown in the top corner, like a date written on the page. */
  date: string;
  /**
   * Optional: the id of a transmission in TransmissionSchedule.ts. Its
   * frequency and time are written as this page's header.
   */
  signal?: string;
  /** The page's heading. */
  heading: string;
  /** Lines of writing above the math. */
  before: string[];
  /** The math, line by line. */
  lines: LogLine[];
  /** Lines of writing under the math. */
  after: string[];
  /** false until Evan says the equations on this page are his. */
  canon: boolean;
  /** Where the draft equation came from, for Evan. Not shown in the app. */
  sourceNote: string;
}

export const FIELD_LOG_PAGES: LogPage[] = [
  {
    id: 'coupling',
    unlocksAt: 1,
    date: '[DATE: Evan]',
    signal: 'transmission-002', // PLACEHOLDER: which clue goes on which page is Evan's
    heading: '[LOG HEADING: Evan]',
    before: ['[LOG ENTRY: Evan]'],
    lines: [
      { ink: 'dρ/dt = −i[H, ρ] + γ(LρL† − ½{L†L, ρ})' },
      { ink: 'ħ = 1', margin: true },
    ],
    after: ['[LOG ENTRY: Evan]'],
    canon: false,
    sourceNote:
      'Lindblad master equation: how a quantum system changes when something outside keeps coupling to (measuring) it. ρ is the state, H its energy, L the coupling, γ how hard you couple.',
  },
  {
    id: 'cost-per-message',
    unlocksAt: 2,
    date: '[DATE: Evan]',
    signal: 'transmission-003', // PLACEHOLDER
    heading: '[LOG HEADING: Evan]',
    before: ['[LOG ENTRY: Evan]'],
    lines: [
      { ink: 'ΔS_A ≥ N · k_B ln 2' },
      { ink: 'N = bits sent', margin: true },
    ],
    after: ['[LOG ENTRY: Evan]'],
    canon: false,
    sourceNote:
      "Landauer's principle: writing or erasing one bit costs at least k_B ln 2 of entropy. N bits sent into A cost at least N times that.",
  },
  {
    id: 'pendulum',
    unlocksAt: 3,
    date: '[DATE: Evan]',
    heading: '[LOG HEADING: Evan]',
    before: ['[LOG ENTRY: Evan]'],
    lines: [
      // The plus sign here is the mistake, on purpose. Page 4 corrects it.
      { ink: 'ẍ + (γ_M + γ_A)ẋ + ω₀²x = F(t)' },
      { ink: 'γ_M + γ_A > 0  ⇒  x → 0' },
    ],
    after: ['[LOG ENTRY: Evan]'],
    canon: false,
    sourceNote:
      'Driven, damped oscillator. Written with γ_M + γ_A, both damping terms add, so it always settles. That is the error: page 4 has the sign flipped.',
  },
  {
    id: 'pendulum-corrected',
    unlocksAt: 4,
    date: '[DATE: Evan]',
    heading: '[LOG HEADING: Evan]',
    before: ['[LOG ENTRY: Evan]'],
    lines: [
      { ink: '~~ẍ + (γ_M + γ_A)ẋ + ω₀²x = F(t)~~' },
      { ink: '~~γ = γ_M + γ_A~~' },
      { ink: 'ẍ + (γ_M ((−)) γ_A)ẋ + ω₀²x = F(t)' },
      { ink: 'γ_A > γ_M  ⇒  x(t) ~ e^{(γ_A − γ_M)t/2}' },
      { ink: 'E ≈ T · ΔS' },
    ],
    after: ['[LOG ENTRY: Evan]'],
    canon: false,
    sourceNote:
      'Same oscillator with the sign corrected. When A pushes back harder than the Mill damps, the swing grows instead of settling. E ≈ T·ΔS: the energy released, roughly temperature times the entropy dumped.',
  },
  {
    id: 'path-integral',
    unlocksAt: 5,
    date: '[DATE: Evan]',
    heading: '[LOG HEADING: Evan]',
    before: ['[LOG ENTRY: Evan]'],
    lines: [
      { ink: 'Ψ = ∫ 𝒟x  e^{iS[x]/ħ}', fade: 0.15, fadesInto: '[LOG WORDS: Evan]' },
      { ink: 'S[x] = ∫ L dt', fade: 0.25, fadesInto: '[LOG WORDS: Evan]' },
    ],
    after: ['[LOG ENTRY: Evan]'],
    canon: false,
    sourceNote:
      "Feynman's path integral: a particle takes every possible path at once, each weighted by e^{iS/ħ}. S is the action along a path.",
  },
  {
    id: 'besso',
    unlocksAt: 6,
    date: '[DATE: Evan]',
    heading: '[LOG HEADING: Evan]',
    before: ['[LOG ENTRY: Evan]'],
    lines: [
      { ink: 'ds² = −c²dt² + dx² + dy² + dz²', fade: 0.35, fadesInto: '[LOG WORDS: Evan]' },
      { ink: "t′ = γ(t − vx/c²)", fade: 0.5, fadesInto: '[LOG WORDS: Evan]' },
      { ink: 'γ = 1/√(1 − v²/c²)', fade: 0.6, fadesInto: '[LOG WORDS: Evan]' },
    ],
    after: ['[LOG ENTRY: Evan]'],
    canon: false,
    sourceNote:
      "Minkowski spacetime interval and the Lorentz transform: two observers moving differently disagree about which events are 'now'. This is the block-universe idea behind Einstein's 1955 letter about Besso.",
  },
  {
    id: 'entanglement',
    unlocksAt: 7,
    date: '[DATE: Evan]',
    heading: '[LOG HEADING: Evan]',
    before: ['[LOG ENTRY: Evan]'],
    lines: [
      { ink: '|ψ⟩ = (|0⟩|1⟩ − |1⟩|0⟩)/√2', fade: 0.7, fadesInto: '[LOG WORDS: Evan]' },
      { ink: '|ψ⟩ ≠ |a⟩ ⊗ |b⟩', fade: 0.9, fadesInto: '[LOG WORDS: Evan]' },
    ],
    after: ['[LOG ENTRY: Evan]'],
    canon: false,
    sourceNote:
      "An entangled pair: the state of the two can't be split into 'one part' times 'the other part'. Neither has a state of its own.",
  },
];
