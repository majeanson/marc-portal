// public/walkthrough/timeline.js
// ─────────────────────────────────────────────────────────────────────────────
// The CREATIVE LAYER of the marc.portal walkthrough video.
//
// This file is hand-authored and STABLE across builds. It never references
// pixel positions — only NAMED ANCHORS (e.g. "cta", "submit", "card", "marc").
// Each build, scripts/walkthrough/capture.mjs screenshots the LIVE app and
// records where those anchors actually are (their bounding boxes) into
// manifest.json. player.js then aims the camera + cursor at the recorded
// boxes. Result: the layout can move freely and the shot still lands.
//
// To re-cut the video, edit shots/cursor/captions/durations here. To make it
// track new product copy or styling, just re-run the capture — no edits here.
//
// Anchor names must match the selectors in capture.mjs CAPTURE_PLAN.
// `frame`/`states` name entries in manifest.json (key__state).
// ─────────────────────────────────────────────────────────────────────────────
window.MP_TIMELINE = {
  // 16:9 canvas + the on-screen browser window the frames live inside.
  stage: { w: 1920, h: 1080 },
  win: { x: 150, y: 54, w: 1620, h: 974 },
  chromeH: 58,
  endcardDur: 5,
  // Endcard wordmark + tagline (the one bit of non-product copy).
  endcard: {
    wordmark: ['marc', '.', 'portal'],
    // Captions + endcard copy carry both languages; player.js picks via ?lang
    // (default fr). FR is the canonical creative cut; EN is rewritten to read
    // native, not translated word-for-word.
    tagline: { fr: 'Raconte-moi la tienne.', en: 'Tell me yours.' },
    foot: {
      fr: 'Hébergé au Canada · Loi 25 · réponse honnête en 72 h',
      en: 'Hosted in Canada · Loi 25 · honest answer within 72 h',
    },
  },

  // Camera default when a shot's anchor is null → pin page top, centered.
  scenes: [
    {
      key: 'home',
      url: 'marcportal.com',
      dur: 10,
      states: [{ t: 0, frame: 'home__default' }],
      shots: [
        { t: 0, anchor: null, z: 1.0 },
        { t: 2.5, anchor: null, z: 1.06 },
        { t: 6, anchor: 'cta', z: 1.18, off: [120, 80] },
        { t: 8, anchor: 'cta', z: 1.5 },
        { t: 10, anchor: 'cta', z: 1.52 },
      ],
      cursor: [
        { t: 0, free: [1280, 760] },
        { t: 1, free: [1280, 760] },
        { t: 4.5, anchor: 'cta' },
        { t: 10, anchor: 'cta' },
      ],
      clicks: [{ t: 8.3, anchor: 'cta' }],
      captions: [
        {
          t0: 0.6,
          t1: 10,
          text: {
            fr: 'Une affaire plate qui revient chaque semaine, assez tannante pour mériter mieux.',
            en: 'A dull thing that comes back every week, annoying enough to deserve better.',
          },
        },
      ],
    },
    {
      key: 'intake',
      url: 'marcportal.com/intake',
      dur: 13,
      states: [
        { t: 0, frame: 'intake__empty' },
        { t: 5.4, frame: 'intake__filled' },
      ],
      shots: [
        { t: 0, anchor: null, z: 1.0 },
        { t: 1.6, anchor: 'field', z: 1.18 },
        { t: 3, anchor: 'field', z: 1.28 },
        { t: 9.2, anchor: 'field', z: 1.28 },
        { t: 11.2, anchor: 'submit', z: 1.34 },
        { t: 13, anchor: 'submit', z: 1.35 },
      ],
      cursor: [
        { t: 0, free: [1320, 880] },
        { t: 1.4, anchor: 'field' },
        { t: 9.3, anchor: 'field' },
        { t: 11.2, anchor: 'submit' },
        { t: 13, anchor: 'submit' },
      ],
      clicks: [{ t: 11.9, anchor: 'submit' }],
      captions: [
        {
          t0: 0.5,
          t1: 13,
          text: {
            fr: 'Tu décris ton problème. Pas un call, pis chaque champ se sauvegarde tout seul.',
            en: 'You describe your problem. No call, and every field saves itself.',
          },
        },
      ],
    },
    {
      key: 'login',
      url: 'marcportal.com/login',
      dur: 8,
      states: [
        { t: 0, frame: 'login__empty' },
        { t: 1.8, frame: 'login__filled' },
      ],
      shots: [
        { t: 0, anchor: null, z: 1.04 },
        { t: 1.4, anchor: 'field', z: 1.2 },
        { t: 5.2, anchor: 'submit', z: 1.26 },
        { t: 8, anchor: 'submit', z: 1.3 },
      ],
      cursor: [
        { t: 0, free: [1200, 760] },
        { t: 1.1, anchor: 'field' },
        { t: 5.0, anchor: 'field' },
        { t: 6.2, anchor: 'submit' },
        { t: 8, anchor: 'submit' },
      ],
      clicks: [{ t: 6.7, anchor: 'submit' }],
      captions: [
        {
          t0: 0.5,
          t1: 8,
          text: {
            fr: 'Pas de mot de passe. Juste un lien de connexion par courriel.',
            en: 'No password. Just a sign-in link by email.',
          },
        },
      ],
    },
    {
      key: 'magic',
      url: 'marcportal.com/login/sent',
      dur: 6,
      states: [{ t: 0, frame: 'magic__default' }],
      shots: [
        { t: 0, anchor: null, z: 1.05 },
        { t: 2.5, anchor: 'mark', z: 1.16 },
        { t: 6, anchor: 'mark', z: 1.2 },
      ],
      cursor: [
        { t: 0, free: [760, 360] },
        { t: 3, free: [900, 540] },
        { t: 6, free: [1300, 820] },
      ],
      clicks: [],
      captions: [
        {
          t0: 0.6,
          t1: 6,
          text: {
            fr: 'Le lien arrive. Un clic, et te voilà connecté.',
            en: 'The link lands. One click and you are in.',
          },
        },
      ],
    },
    {
      key: 'me',
      url: 'marcportal.com/me',
      dur: 11,
      states: [{ t: 0, frame: 'me__default' }],
      shots: [
        { t: 0, anchor: null, z: 1.0 },
        { t: 2.5, anchor: null, z: 1.05 },
        { t: 5, anchor: 'card', z: 1.14 },
        { t: 7.5, anchor: 'card', z: 1.4 },
        { t: 11, anchor: 'card', z: 1.42 },
      ],
      cursor: [
        { t: 0, free: [1280, 820] },
        { t: 4.5, anchor: 'card' },
        { t: 8, anchor: 'cardOpen' },
        { t: 11, anchor: 'cardOpen' },
      ],
      clicks: [{ t: 9.2, anchor: 'cardOpen' }],
      captions: [
        {
          t0: 0.5,
          t1: 11,
          text: {
            fr: 'Ton espace : tes sessions, ton compte, tout au même endroit.',
            en: 'Your space: your sessions, your account, all in one place.',
          },
        },
      ],
    },
    {
      key: 'session',
      url: 'marcportal.com/session/:id',
      dur: 13,
      // Two states: thread before + after Marc's reply (capture.mjs posts it).
      states: [
        { t: 0, frame: 'session__pending' },
        { t: 6, frame: 'session__reply' },
      ],
      shots: [
        { t: 0, anchor: null, z: 1.0 },
        { t: 2.4, anchor: 'visitor', z: 1.12 },
        { t: 5, anchor: 'visitor', z: 1.2 },
        { t: 6.6, anchor: 'marc', z: 1.18 },
        { t: 9, anchor: 'marc', z: 1.26 },
        { t: 13, anchor: 'marc', z: 1.27 },
      ],
      cursor: [
        { t: 0, free: [1300, 820] },
        { t: 3, anchor: 'visitor' },
        { t: 7, anchor: 'marc' },
        { t: 13, free: [1180, 820] },
      ],
      clicks: [],
      captions: [
        {
          t0: 0.5,
          t1: 5.6,
          text: {
            fr: 'Ta demande devient une session vivante : un fil privé, pas une boîte courriel.',
            en: 'Your request becomes a living session: a private thread, not an inbox.',
          },
        },
        {
          t0: 6.2,
          t1: 13,
          text: {
            fr: 'Marc répond lui-même. Oui, non, ou « raconte-moi plus », en moins de 72 h.',
            en: 'Marc answers himself. Yes, no, or "tell me more," within 72 hours.',
          },
        },
      ],
    },
  ],
}
