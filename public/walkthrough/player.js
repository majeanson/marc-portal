/* marc.portal walkthrough — frame-driven player.
   Reads timeline.js (shot plan) + manifest.json (frames + anchor boxes the
   capture script recorded from the live build). Aims a damped camera + cursor
   at named anchors, exactly like the design prototype, but over real frames.

   URL params:
     ?scene=intake   render just one route as a SHORT (home|intake|login|magic|me|session)
     ?noend=1        drop the wordmark end card
     ?record=1       play once (no loop); sets window.__MP_DONE=true at the end
                     (used by scripts/walkthrough/render-video.mjs)
     ?t=4.2          start at a given time (debug)

   Lives as a separate file (not inline in player.html) so the strict CSP
   `script-src 'self'` covers it with no per-hash bookkeeping — same reason the
   app's bootstrap is split out (see index.html). An inline block here would be
   blocked on any server that ships the production _headers CSP (the Functions
   backend on :8788, and the live site), leaving a blank player. */
const T = window.MP_TIMELINE
const P = new URLSearchParams(location.search)
const RECORD = P.get('record') === '1'
const ONLY = P.get('scene')
const NOEND = P.get('noend') === '1'
// Caption + endcard language. timeline.js carries { fr, en } on each; default
// fr (the canonical cut). Set <html lang> too so AT announces the right one.
const LANG = P.get('lang') === 'en' ? 'en' : 'fr'
document.documentElement.lang = LANG
// Resolve a possibly-bilingual field. Tolerates a plain string so an older
// single-language timeline.js still renders.
const L = (v) => (v && typeof v === 'object' ? (v[LANG] ?? v.fr) : v)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1)
const easeOut = (t) => --t * t * t + 1

const VIEW = { w: T.win.w, h: T.win.h - T.chromeH }

let MAN = null

function lerp(a, b, e) {
  return a + (b - a) * e
}

// Resolve a shot's absolute camera focus (content px) + zoom for a given frame.
function shotFocus(shot, frame) {
  const z = shot.z
  if (!shot.anchor) {
    return { fx: T.win.w / 2, fy: VIEW.h / 2 / z, z }
  }
  const a = frame && frame.anchors && frame.anchors[shot.anchor]
  if (!a) {
    return { fx: T.win.w / 2, fy: VIEW.h / 2 / z, z }
  } // anchor missing → pin top
  let cx = a[0] + a[2] / 2,
    cy = a[1] + a[3] / 2
  if (shot.off) {
    cx += shot.off[0]
    cy += shot.off[1]
  }
  return { fx: cx, fy: cy, z }
}
function cursorPos(kf, frame) {
  if (kf.free) return { x: kf.free[0], y: kf.free[1] }
  const a = frame && frame.anchors && frame.anchors[kf.anchor]
  if (!a) return { x: T.win.w / 2, y: VIEW.h / 2 }
  return { x: a[0] + a[2] / 2, y: a[1] + a[3] / 2 }
}
// interpolate a list of {t,...} keyframes → resolver(prev,next,e)
function track(list, lt, resolve) {
  if (lt <= list[0].t) return resolve(list[0], list[0], 0)
  if (lt >= list[list.length - 1].t) {
    const k = list[list.length - 1]
    return resolve(k, k, 1)
  }
  for (let i = 0; i < list.length - 1; i++) {
    if (lt >= list[i].t && lt <= list[i + 1].t) {
      const span = list[i + 1].t - list[i].t || 1
      return resolve(list[i], list[i + 1], easeInOut(clamp((lt - list[i].t) / span, 0, 1)))
    }
  }
  const k = list[list.length - 1]
  return resolve(k, k, 1)
}
function stateFrameKey(scene, lt) {
  let key = scene.states[0].frame
  for (const s of scene.states) if (lt >= s.t) key = s.frame
  return key
}

// ── Build DOM ────────────────────────────────────────────────────────────
const stage = document.getElementById('stage')
let scaleWrap,
  win,
  chromeUrl,
  viewport,
  imgA,
  imgB,
  cursorEl,
  ripple,
  capWrap,
  capBox,
  veil,
  endcard
function buildDOM() {
  stage.innerHTML = ''
  scaleWrap = el('div', {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: T.stage.w + 'px',
    height: T.stage.h + 'px',
    transformOrigin: 'center',
    background: '#15130f',
  })
  stage.appendChild(scaleWrap)
  const bg = el('div', {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 38%, #211e18 0%, #15130f 70%)',
  })
  scaleWrap.appendChild(bg)
  win = el('div', {
    position: 'absolute',
    left: T.win.x + 'px',
    top: T.win.y + 'px',
    width: T.win.w + 'px',
    height: T.win.h + 'px',
    borderRadius: '16px',
    overflow: 'hidden',
    background: '#f6f1e6',
    border: '1px solid #2a2620',
    boxShadow: '0 40px 90px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)',
  })
  scaleWrap.appendChild(win)
  // chrome
  const chrome = el('div', {
    position: 'absolute',
    left: 0,
    top: 0,
    width: T.win.w + 'px',
    height: T.chromeH + 'px',
    background: '#ece6d8',
    borderBottom: '1px solid #d6cdb8',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '0 18px',
  })
  const dots = el('div', { display: 'flex', gap: '9px' })
  ;['#e0796b', '#e6b95c', '#7fb685'].forEach((c) =>
    dots.appendChild(
      el('span', { width: '13px', height: '13px', borderRadius: '50%', background: c }),
    ),
  )
  chrome.appendChild(dots)
  const urlWrap = el('div', { flex: '1', display: 'flex', justifyContent: 'center' })
  chromeUrl = el(
    'div',
    {
      background: '#fbf7ec',
      border: '1px solid #d6cdb8',
      borderRadius: '999px',
      padding: '8px 22px',
      minWidth: '420px',
      textAlign: 'center',
      color: '#3f3c34',
      fontSize: '14px',
    },
    'vid-mono',
  )
  urlWrap.appendChild(chromeUrl)
  chrome.appendChild(urlWrap)
  chrome.appendChild(el('div', { width: '64px' }))
  win.appendChild(chrome)
  // viewport
  viewport = el('div', {
    position: 'absolute',
    left: 0,
    top: T.chromeH + 'px',
    width: VIEW.w + 'px',
    height: VIEW.h + 'px',
    overflow: 'hidden',
    background: '#f6f1e6',
  })
  win.appendChild(viewport)
  imgB = frameImg()
  imgA = frameImg() // A on top (current), B behind (prev, for crossfade)
  viewport.appendChild(imgB)
  viewport.appendChild(imgA)
  // cursor
  cursorEl = el('div', {
    position: 'absolute',
    left: '0',
    top: '0',
    zIndex: 40,
    pointerEvents: 'none',
    transform: 'translate(-3px,-2px)',
  })
  cursorEl.innerHTML =
    '<svg width="26" height="34" viewBox="0 0 26 34" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M2 2 L2 26 L8.5 20 L12.5 29.5 L16.5 28 L12.5 18.5 L21 18 Z" fill="#fff" stroke="#1f1d18" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  ripple = el('span', {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '42px',
    height: '42px',
    marginLeft: '-21px',
    marginTop: '-21px',
    borderRadius: '50%',
    border: '2.5px solid rgba(61,110,78,0.7)',
    opacity: '0',
  })
  viewport.appendChild(ripple)
  viewport.appendChild(cursorEl)
  veil = el('div', { position: 'absolute', inset: 0, background: '#f6f1e6', opacity: '0' })
  viewport.appendChild(veil)
  // caption
  capWrap = el('div', {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '30px',
    display: 'flex',
    justifyContent: 'center',
    zIndex: 50,
    pointerEvents: 'none',
  })
  capBox = el(
    'div',
    {
      maxWidth: '1180px',
      margin: '0 24px',
      padding: '15px 28px',
      background: 'rgba(31,29,24,0.92)',
      color: '#f6f1e6',
      borderRadius: '14px',
      fontSize: '27px',
      lineHeight: '1.35',
      textAlign: 'center',
      boxShadow: '0 10px 34px rgba(0,0,0,.34)',
      opacity: '0',
    },
    'vid-cap',
  )
  capBox.style.textWrap = 'balance'
  capWrap.appendChild(capBox)
  scaleWrap.appendChild(capWrap)
  // endcard
  endcard = el('div', {
    position: 'absolute',
    inset: 0,
    background: '#f6f1e6',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: '0',
  })
  endcard.innerHTML =
    '<div class="vid-disp" style="font-weight:800;font-size:92px;letter-spacing:-.02em;color:#1f1d18">' +
    T.endcard.wordmark[0] +
    '<span style="color:#3d6e4e">' +
    T.endcard.wordmark[1] +
    '</span>' +
    T.endcard.wordmark[2] +
    '</div>' +
    '<div class="vid-cap" style="font-style:italic;font-size:34px;color:#2c5239;margin-top:8px">' +
    L(T.endcard.tagline) +
    '</div>' +
    '<div class="vid-mono" style="font-size:15px;letter-spacing:.06em;color:#7a7568;margin-top:26px">' +
    L(T.endcard.foot) +
    '</div>'
  scaleWrap.appendChild(endcard)
  resize()
}
function frameImg() {
  return el('img', {
    position: 'absolute',
    left: 0,
    top: 0,
    width: T.win.w + 'px',
    transformOrigin: '0 0',
    willChange: 'transform',
  })
}
function el(tag, style, cls) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  Object.assign(e.style, style || {})
  return e
}
function resize() {
  const s = Math.min(window.innerWidth / T.stage.w, window.innerHeight / T.stage.h)
  scaleWrap.style.transform = 'translate(-50%,-50%) scale(' + s + ')'
}
window.addEventListener('resize', () => scaleWrap && resize())

// ── Scenes (filtered for shorts) ─────────────────────────────────────────
let SCENES = ONLY ? T.scenes.filter((s) => s.key === ONLY) : T.scenes.slice()
if (!SCENES.length) SCENES = [T.scenes[0]]
const ENDCARD = NOEND ? 0 : ONLY ? 2.4 : T.endcardDur
const STARTS = []
let acc = 0
for (const s of SCENES) {
  STARTS.push(acc)
  acc += s.dur
}
const TOTAL = acc
const DURATION = TOTAL + ENDCARD

// crossfade bookkeeping
let curFrameKey = null,
  fadeFrom = 0
function setFrames(key) {
  if (key === curFrameKey) return
  const fr = MAN.frames[key]
  if (!fr) return
  // move current A → B (prev), load new into A, start fade
  imgB.src = imgA.src
  imgB.style.opacity = '1'
  imgA.src = absUrl(fr.src)
  imgA.style.opacity = '0'
  fadeFrom = performance.now()
  curFrameKey = key
}
function absUrl(src) {
  return src
}

function frameFor(scene, lt) {
  return MAN.frames[stateFrameKey(scene, lt)] || MAN.frames[scene.states[0].frame]
}

// ── Render one time t ────────────────────────────────────────────────────
function renderAt(time) {
  // endcard
  if (time >= TOTAL) {
    endcard.style.opacity = '1'
    const p = clamp((time - TOTAL) / Math.max(0.001, ENDCARD), 0, 1)
    void p
    win.style.opacity = '0'
    return
  }
  endcard.style.opacity = '0'
  win.style.opacity = '1'
  let idx = 0
  for (let i = SCENES.length - 1; i >= 0; i--) {
    if (time >= STARTS[i]) {
      idx = i
      break
    }
  }
  const scene = SCENES[idx]
  const lt = time - STARTS[idx]
  chromeUrl.textContent = scene.url

  const fkey = stateFrameKey(scene, lt)
  setFrames(fkey)
  const frame = MAN.frames[fkey] || frameFor(scene, lt)

  // crossfade A in
  const fadeP = clamp((performance.now() - fadeFrom) / 300, 0, 1)
  imgA.style.opacity = String(fadeP)
  if (fadeP >= 1) imgB.style.opacity = '0'

  // camera
  const cam = track(scene.shots, lt, (a, b, e) => {
    const fa = shotFocus(a, frame),
      fb = shotFocus(b, frame)
    return { fx: lerp(fa.fx, fb.fx, e), fy: lerp(fa.fy, fb.fy, e), z: lerp(fa.z, fb.z, e) }
  })
  const tx = VIEW.w / 2 - cam.z * cam.fx,
    ty = VIEW.h / 2 - cam.z * cam.fy
  const tf = 'translate(' + tx + 'px,' + ty + 'px) scale(' + cam.z + ')'
  imgA.style.transform = tf
  imgB.style.transform = tf

  // cursor
  const cur = track(scene.cursor, lt, (a, b, e) => {
    const pa = cursorPos(a, frame),
      pb = cursorPos(b, frame)
    return { x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e) }
  })
  let press = 0,
    click = 0
  for (const c of scene.clicks || []) {
    const d = lt - c.t
    if (d >= 0 && d < 0.5) click = d / 0.5
    const da = Math.abs(lt - c.t)
    if (da < 0.12) press = (0.12 - da) / 0.12
  }
  const cvx = tx + cam.z * cur.x,
    cvy = ty + cam.z * cur.y - press * 2
  cursorEl.style.transform = 'translate(' + (cvx - 3) + 'px,' + (cvy - 2) + 'px)'
  if (click > 0) {
    ripple.style.opacity = String(1 - click)
    ripple.style.transform = 'translate(' + cvx + 'px,' + cvy + 'px) scale(' + (0.3 + click) + ')'
  } else ripple.style.opacity = '0'

  // caption
  let capText = '',
    cap = 0
  for (const c of scene.captions || []) {
    if (lt >= c.t0 - 0.4 && lt <= c.t1 + 0.4) {
      capText = L(c.text)
      cap = Math.min(clamp((lt - c.t0) / 0.4, 0, 1), 1 - clamp((lt - c.t1) / 0.4, 0, 1))
    }
  }
  capBox.textContent = capText
  capBox.style.opacity = String(cap)
  capBox.style.transform = 'translateY(' + (1 - cap) * 14 + 'px)'

  // load veil at scene entry (not the first active scene)
  veil.style.opacity = String(idx === 0 ? 0 : clamp(1 - lt / 0.42, 0, 1))
  scaleWrap.setAttribute(
    'data-screen-label',
    Math.floor(time) + 's · ' + (time >= TOTAL ? 'endcard' : scene.key),
  )
}

// ── Clock ────────────────────────────────────────────────────────────────
let t0 = null,
  raf = null,
  t = parseFloat(P.get('t') || '0') || 0
function loop(ts) {
  if (t0 == null) t0 = ts - t * 1000
  t = (ts - t0) / 1000
  if (t >= DURATION) {
    if (RECORD) {
      renderAt(DURATION)
      window.__MP_DONE = true
      return
    }
    t = 0
    t0 = ts
  }
  renderAt(t)
  raf = requestAnimationFrame(loop)
}

// ── Boot ───────────────────────────────────────────────────────────────────
fetch('manifest.json')
  .then((r) => {
    if (!r.ok) throw new Error('manifest.json ' + r.status)
    return r.json()
  })
  .then((m) => {
    MAN = m
    buildDOM()
    // preload all frames
    const keys = [...new Set(SCENES.flatMap((s) => s.states.map((x) => x.frame)))]
    let n = 0
    keys.forEach((k) => {
      const fr = MAN.frames[k]
      if (!fr) return
      const im = new Image()
      im.onload = im.onerror = () => {
        if (++n >= keys.length) start()
      }
      im.src = absUrl(fr.src)
    })
    if (!keys.length) start()
  })
  .catch((e) => {
    const x = document.getElementById('err')
    x.style.display = 'grid'
    x.textContent =
      'walkthrough manifest not found — run `npm run walkthrough:capture` first.\n\n' + e.message
  })

function start() {
  requestAnimationFrame(loop)
}
