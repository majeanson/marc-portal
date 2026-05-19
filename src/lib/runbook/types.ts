/**
 * Shared types for the Runbook surface (/admin/runbook + /template).
 *
 * The runbook surfaces three parallel timelines:
 *   - Track A: dev handoff (taking over Marc's instance)
 *   - Track B: user journey (a visitor's path under new ownership)
 *   - Track C: template buyer (someone forking the portal as a product)
 *
 * Each track shares the same Step shape so a single renderer can present all
 * three. Bilingual copy lives inline on each step to keep i18n.ts from
 * ballooning further — runbook copy is operator-facing and dense, not the
 * marketing copy i18n.ts was designed for.
 */

import type { Lang } from '../../i18n'

/** Bilingual string pair. */
export interface Bi {
  fr: string
  en: string
}

/** Bilingual list (used for How/Gotcha bullets). */
export interface BiList {
  fr: string[]
  en: string[]
}

/**
 * A single step on a track. Steps are rendered as either a one-liner
 * (summary view) or an expanded card (detail view).
 *
 * The detail view always shows the same four blocks — Why / How / Gotcha /
 * Verify — to keep the surface scannable. Empty arrays render no block.
 */
export interface Step {
  /** Stable id used for localStorage progress + dependency links. e.g. "A-07". */
  id: string
  /** Display number — small uppercase circled digit. Usually "1".."11". */
  num: string
  /** Short title (3–6 words). */
  title: Bi
  /** Time estimate ("5 min", "≤ 72 hr", "variable"). Same in both languages. */
  time: string
  /** Optional tag rendered next to the time. e.g. "notif", "auto". */
  tag?: string
  /** One-line summary (visible in both views). */
  summary: Bi
  /** Why this step is load-bearing. One sentence. */
  why: Bi
  /** Concrete actions — commands, paths, URLs. Rendered as a bullet list. */
  how: BiList
  /** Pitfalls / known traps. Rendered as a bullet list with warning chrome. */
  gotcha: BiList
  /** How to confirm it worked. Often a link or an admin surface to check. */
  verify: Bi
  /**
   * Cross-track dependency. When present, the parallel view highlights this
   * step in red if the linked Track-A step is unchecked. Used on Track B to
   * say "this would break for the user if A-08 isn't done."
   */
  dependsOn?: string
  /**
   * Optional inline link out of the step (to an admin surface, a doc, an
   * external dashboard). Renders as the step's primary action button.
   */
  link?: {
    href: Bi | string
    label: Bi
    /** True if href points off-domain — opens in a new tab. */
    external?: boolean
  }
}

/** A whole track — metadata + ordered steps. */
export interface Track {
  /** "A", "B", "C". */
  id: 'A' | 'B' | 'C'
  /** Short eyebrow ("dev · handoff" etc.). */
  eyebrow: Bi
  /** Track title ("Dev handoff", "User journey", "Template buyer"). */
  title: Bi
  /** One-line description for the track header. */
  sub: Bi
  /** Ordered list of steps. */
  steps: Step[]
}

/**
 * A strategic question on the Decisions tab. Unlike steps, decisions don't
 * have a fixed shape — they're open prompts with a free-text answer field.
 * The "unlocks" field surfaces what answering this enables downstream.
 */
export interface Decision {
  /** Stable id, e.g. "D-pricing". */
  id: string
  /** "1", "2", … for visual ordering. */
  num: string
  /** Short question (10 words or less). */
  question: Bi
  /** Why this matters — load-bearing context for the operator. */
  context: Bi
  /** Concrete options to consider. Rendered as a bullet list. */
  options: BiList
  /** What answering this unlocks ("the price line on /template's sales card"). */
  unlocks: Bi
}

/** Picks the right side of a Bi based on the active language. */
export function bi(value: Bi, lang: Lang): string {
  return value[lang]
}

/** Picks the right side of a BiList based on the active language. */
export function biList(value: BiList, lang: Lang): string[] {
  return value[lang]
}
