// Wire git's hooksPath to our tracked `.githooks/` directory. Called from
// the `prepare` lifecycle in package.json so every `npm install` re-applies
// it (idempotent — `git config` is a no-op when the value is unchanged).
//
// Cross-platform: doesn't rely on shell redirects (`2>/dev/null`, `2>NUL`)
// because npm runs scripts under cmd.exe on Windows, sh on POSIX. Swallow
// errors here so a non-git checkout (CI tarball extract, etc.) doesn't
// fail `npm install`.

import { execSync } from 'node:child_process'

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' })
} catch {
  // Not in a git repo, or git missing — prepare just no-ops. CI runs
  // without hooks anyway; this only matters for local pre-push gating.
}
