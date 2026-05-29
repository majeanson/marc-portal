// scripts/walkthrough/seed.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Prints the two env vars capture.mjs needs to shoot the authenticated routes
// (/me, /session/:id), and seeds the matching D1 row so /session shows a real
// thread with a reply from Marc.
//
//   node scripts/walkthrough/seed.mjs            # writes the row, prints exports
//   node scripts/walkthrough/seed.mjs --no-db    # only mint+print the cookie
//
// It deliberately uses the SAME fixture path as the backend e2e suite
// (e2e/backend/helpers): the e2e SESSION_SECRET, the ephemeral `.wrangler-e2e`
// D1, and the exact cookie format functions/_lib/auth.ts verifies. That keeps
// "what the walkthrough shoots" and "what the e2e harness drives" in lockstep —
// point BASE_URL at a server bound to the same D1 + secret and the forged
// cookie is accepted with no magic-link round-trip.
//
// We re-implement the cookie + seed here (≈40 lines) instead of importing the
// e2e helpers because those are TypeScript consumed by Playwright's transform;
// this machine's Node (22.x) can't import a `.ts` module directly, and adding a
// TS loader just to seed a row isn't worth it. The format is mirrored, not
// abstracted — if auth.ts's cookie shape ever changes, change it in both.
//
// Env overrides (all optional — defaults match the e2e fixture):
//   SESSION_SECRET     signing key (default: the e2e deterministic secret)
//   MP_SEED_EMAIL      the signed-in visitor (default marie@cafedunord.ca)
//   MP_SEED_SESSION_ID the session id to seed/sign (default sess_walkthrough)
//   MP_PERSIST_DIR     wrangler --persist-to dir (default .wrangler-e2e)
//   MP_D1_NAME         D1 binding/db name (default marc-portal-db)
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Mirrors E2E_BINDINGS.SESSION_SECRET in e2e/backend/constants.ts. Must be ≥ 32
// chars or the server's requireSessionSecret rejects every cookie (auth.ts).
const SECRET = process.env.SESSION_SECRET || 'e2e_session_secret_at_least_32_chars_long_padding'
const EMAIL = (process.env.MP_SEED_EMAIL || 'marie@cafedunord.ca').toLowerCase()
const SESSION_ID = process.env.MP_SEED_SESSION_ID || 'sess_walkthrough'
const PERSIST_DIR = process.env.MP_PERSIST_DIR || '.wrangler-e2e'
const D1_NAME = process.env.MP_D1_NAME || 'marc-portal-db'
const SKIP_DB = process.argv.includes('--no-db')

const now = Math.floor(Date.now() / 1000)

// ── Cookie: base64url(payload).base64url(HMAC-SHA256(payload)) ──────────────
// Identical to functions/_lib/auth.ts signSession + e2e helpers/auth.ts. The
// payload is { e: email, x: expirySeconds }; 30-day expiry like the real one.
function signSession(email) {
  const exp = now + 30 * 24 * 60 * 60
  const payload = JSON.stringify({ e: email, x: exp })
  const sig = createHmac('sha256', SECRET).update(payload).digest()
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${Buffer.from(sig).toString('base64url')}`
}

// Escape a string for a single-quoted SQLite literal (double the quotes).
const sq = (s) => s.replace(/'/g, "''")

function seedRow() {
  // Realistic intake so /session renders a real problem, not an empty card.
  // Shape mirrors the submitIntake payload (type + account + formData).
  const intake = {
    type: 'paperasse',
    account: { email: EMAIL, name: 'Marie' },
    formData: {
      whatGetsRebuilt:
        'La cédule des quarts pis le suivi des heures : je recopie ça à la main chaque dimanche soir.',
      idealOutcome: 'Un seul endroit où tout le monde voit qui prend quel quart.',
      __handoff_mode: 'je-men-occupe',
    },
    submittedAt: '2026-05-29',
  }
  const intakeJson = sq(JSON.stringify(intake))
  const visitor = sq(
    'Au café, on jongle avec les quarts dans un groupe texto pis ça vire au chaos. ' +
      "J'aimerais que le monde voie qui prend quel quart, sans que j'aie à tout retaper.",
  )
  const marc = sq(
    "Reçu, Marie. C'est exactement le genre de coordination que je règle bien. " +
      'Je te propose une grille partagée : chacun voit son quart, plus de recopiage le dimanche soir.',
  )

  // Idempotent: REPLACE the session, wipe its messages, re-insert the pair so
  // re-running doesn't stack duplicate replies. Literal unix seconds inline —
  // unixepoch() and PS quoting both bite the wrangler d1 CLI (see project
  // memory project_powershell_wrangler_d1_quotes).
  const sql = `
INSERT OR REPLACE INTO sessions (id, email, intake_json, status, tier, showcase_title, created_at, updated_at)
VALUES ('${SESSION_ID}', '${EMAIL}', '${intakeJson}', 'active', 1, NULL, ${now}, ${now});
DELETE FROM messages WHERE session_id = '${SESSION_ID}';
INSERT INTO messages (id, session_id, author, body, created_at)
VALUES ('msg_walk_visitor', '${SESSION_ID}', 'visitor', '${visitor}', ${now - 3600});
INSERT INTO messages (id, session_id, author, body, created_at)
VALUES ('msg_walk_marc', '${SESSION_ID}', 'marc', '${marc}', ${now - 1800});
`.trim()

  const sqlPath = path.join(tmpdir(), `mp-walkthrough-seed-${process.pid}.sql`)
  writeFileSync(sqlPath, sql, 'utf8')
  try {
    const r = spawnSync(
      'npx',
      [
        'wrangler',
        'd1',
        'execute',
        D1_NAME,
        '--local',
        `--persist-to=${PERSIST_DIR}`,
        `--file=${sqlPath}`,
      ],
      // CI=1 keeps wrangler non-interactive (mirrors e2e/backend/setup.mjs).
      { stdio: 'inherit', shell: true, env: { ...process.env, CI: '1' } },
    )
    if (r.status !== 0) {
      console.error(
        `\nseed: wrangler d1 execute exited ${r.status}. Has the ${PERSIST_DIR} D1 been ` +
          `migrated? Run:\n  npx wrangler d1 migrations apply ${D1_NAME} --local --persist-to=${PERSIST_DIR}`,
      )
      process.exit(r.status ?? 1)
    }
  } finally {
    rmSync(sqlPath, { force: true })
  }
}

if (!SKIP_DB) seedRow()

const cookie = `mp_session=${signSession(EMAIL)}`
console.log('\n# Walkthrough auth — export these before `npm run walkthrough`:')
console.log(
  `#   (cookie signed with ${process.env.SESSION_SECRET ? 'your SESSION_SECRET' : 'the e2e fixture secret'})`,
)
console.log(`MP_SESSION_COOKIE='${cookie}'`)
console.log(`MP_SESSION_ID='${SESSION_ID}'`)
console.log(
  `\n# BASE_URL must point at a server bound to the SAME D1 (${PERSIST_DIR}) and SESSION_SECRET\n` +
    `# as this seed — otherwise the server rejects the cookie / can't find the session.`,
)
