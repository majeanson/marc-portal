import type { ReactNode } from 'react'

/**
 * French punctuation spacing — bundler-proof.
 *
 * French sets a space before « ? ! ; : » and inside guillemets. A literal
 * no-break space (U+00A0 / U+202F) is the textbook way to express that, but
 * two things defeat it here: the build pipeline normalises both code points
 * back to a plain space, and `text-wrap: balance` ignores them even when
 * they do survive. So the source copy keeps a plain space, and at render
 * time we wrap each tight pair ("mot ?", "« mot", "mot »") in a
 * white-space:nowrap span — the punctuation can then never strand on a line
 * of its own. A string with no such pair (every English heading, most FR
 * ones) passes straight through unchanged.
 */
export function frPunct(text: string): ReactNode {
  // "word SPACE closing-punct"  |  "« SPACE word"
  const re = /\S+ [?!;:»]|« \S+/g
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <span key={key++} className="fr-tight">
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (out.length === 0) return text
  if (last < text.length) out.push(text.slice(last))
  return out
}
