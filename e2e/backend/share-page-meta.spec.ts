// GET /share/:id and /en/share/:id — the edge rewrite in functions/_middleware.ts
// puts the showcase title in <title> and the og/twitter tags. Scrapers never run
// the SPA, so this is the only place a shared link learns the project's name.
//
// What's covered:
//   - showcased session → FR and EN titles + og:title + twitter:title
//   - EN falls back to the FR title when showcase_title_en is empty
//   - unknown id and un-showcased id → the generic title stays (no leak of a
//     private session's title through a guessable URL)

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { clearTestRows, openD1, seedSession } from './helpers/db'

function seedShowcased(
  id: string,
  titleFr: string,
  titleEn: string | null,
  showcased = true,
): void {
  seedSession({
    id,
    email: `share-${id}@e2e.test`,
    status: 'shipped',
    showcaseTitle: titleFr,
  })
  const db = openD1()
  try {
    db.prepare('UPDATE sessions SET showcase_title_en = ?, showcased_at = ? WHERE id = ?').run(
      titleEn,
      showcased ? Math.floor(Date.now() / 1000) : null,
      id,
    )
  } finally {
    db.close()
  }
}

async function head(path: string): Promise<string> {
  const res = await fetch(`${E2E_BASE_URL}${path}`)
  expect(res.status).toBe(200)
  return await res.text()
}

function metaContent(html: string, attr: 'property' | 'name', key: string): string | null {
  const m = new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`, 'i').exec(html)
  return m ? m[1] : null
}

test.describe('share page meta — edge title rewrite', () => {
  test.beforeEach(() => clearTestRows())

  test('showcased session names itself in title, og:title and twitter:title (FR)', async () => {
    const id = `shr${randomBytes(4).toString('hex')}`
    seedShowcased(id, 'Babillard', 'Bulletin board')
    const html = await head(`/share/${id}`)
    expect(html).toMatch(/<title>[^<]*Babillard[^<]*<\/title>/)
    expect(metaContent(html, 'property', 'og:title')).toContain('Babillard')
    expect(metaContent(html, 'name', 'twitter:title')).toContain('Babillard')
  })

  test('EN route uses the EN title', async () => {
    const id = `shr${randomBytes(4).toString('hex')}`
    seedShowcased(id, 'Babillard', 'Bulletin board')
    const html = await head(`/en/share/${id}`)
    expect(html).toMatch(/<title>[^<]*Bulletin board[^<]*<\/title>/)
    expect(metaContent(html, 'property', 'og:title')).toContain('Bulletin board')
  })

  test('EN route falls back to the FR title when no EN title is set', async () => {
    const id = `shr${randomBytes(4).toString('hex')}`
    seedShowcased(id, 'Babillard', null)
    const html = await head(`/en/share/${id}`)
    expect(metaContent(html, 'property', 'og:title')).toContain('Babillard')
  })

  test('un-showcased session does not leak its title', async () => {
    const id = `shr${randomBytes(4).toString('hex')}`
    seedShowcased(id, 'Secret client project', null, false)
    const html = await head(`/share/${id}`)
    expect(html).not.toContain('Secret client project')
  })

  test('unknown id keeps the generic title', async () => {
    const html = await head('/share/doesnotexist1')
    expect(html).not.toMatch(/l'histoire du projet/)
  })
})
