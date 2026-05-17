/**
 * /admin/apparence — runtime theme editor for the buyer's app.
 *
 * Four presets (Forêt / Foyer / Marin / Encre) match the Bonjour design's
 * PALETTES exactly, so a buyer can pick a calm starting point. "Personnalisé"
 * unlocks individual color/font controls. Every change updates document.documentElement
 * style props live — preview is the page itself, no separate panel needed.
 *
 * On save, PATCH /api/tenant/theme persists the JSON; on cancel, we revert by
 * re-applying the originally-loaded theme. Refresh after save so other tabs/users
 * pick up the change on next mount.
 *
 * FROZEN (2026-05-17, per PLAN_TOMORROW.md §3.4). See AdminFleet.tsx for
 * the full rationale. Kept for an eventual white-label move.
 */

import { useMemo, useState } from 'react'
import type { Lang } from '../i18n'
import { api } from '../lib/api'
import { useTenant, type TenantPublic } from '../lib/tenantContext'

const COPY = {
  fr: {
    eyebrow: 'apparence',
    title: 'Donne ton style à l’app',
    sub: 'Choisis un thème, ou règle chaque détail. La page change en direct — rien n’est sauvegardé tant que tu ne cliques pas sur Enregistrer.',
    presets: 'Thèmes',
    custom: 'Personnalisé',
    branding: 'Marque',
    displayName: 'Nom affiché',
    footer: 'Pied de page',
    logoUrl: 'Logo (URL)',
    accent: 'Couleur principale',
    accentDeep: 'Couleur foncée',
    paperWarm: 'Carte (crème chaud)',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saved: '✓ Enregistré',
    error: 'Hmm, ça n’a pas marché. Réessaie.',
    cancel: 'Annuler',
    reset: 'Tout remettre par défaut',
    presetForest: 'Forêt (vert sauge)',
    presetWarm: 'Foyer (terracotta)',
    presetCool: 'Marin (bleu doux)',
    presetInk: 'Encre (noir & crème)',
  },
  en: {
    eyebrow: 'appearance',
    title: 'Make the app your own',
    sub: 'Pick a theme, or fine-tune each detail. The page updates live — nothing is saved until you click Save.',
    presets: 'Themes',
    custom: 'Custom',
    branding: 'Branding',
    displayName: 'Display name',
    footer: 'Footer',
    logoUrl: 'Logo (URL)',
    accent: 'Primary color',
    accentDeep: 'Hover / deep',
    paperWarm: 'Card (warm cream)',
    save: 'Save',
    saving: 'Saving…',
    saved: '✓ Saved',
    error: 'Hmm, that didn’t work. Try again.',
    cancel: 'Cancel',
    reset: 'Reset all to defaults',
    presetForest: 'Forest (sage green)',
    presetWarm: 'Hearth (terracotta)',
    presetCool: 'Marine (soft blue)',
    presetInk: 'Ink (black & cream)',
  },
} as const

interface PresetTheme {
  accent: string
  accentDeep: string
  accentSoft: string
}

const PRESETS: Record<string, PresetTheme | null> = {
  forest: null, // null = clear all overrides → use styles.css defaults
  warm: { accent: '#c1693d', accentDeep: '#9a4f29', accentSoft: '#f3dcc8' },
  cool: { accent: '#3a6079', accentDeep: '#28475a', accentSoft: '#d8e1ea' },
  ink: { accent: '#1f1d18', accentDeep: '#000000', accentSoft: '#e6dfca' },
}

const THEME_KEY_TO_CSS_VAR: Record<string, string> = {
  accent: '--accent',
  accentDeep: '--accent-warm',
  accentSoft: '--accent-soft',
  paperWarm: '--bg-card',
  ink: '--text',
}

function applyToDom(theme: Record<string, string>) {
  const root = document.documentElement
  for (const [k, cssVar] of Object.entries(THEME_KEY_TO_CSS_VAR)) {
    const v = theme[k]
    if (typeof v === 'string' && v.length > 0) {
      root.style.setProperty(cssVar, v)
    } else {
      root.style.removeProperty(cssVar)
    }
  }
}

export function AdminAppearance({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const { tenant, refresh } = useTenant()
  const initial = useMemo(() => tenant?.theme ?? {}, [tenant])
  const [draft, setDraft] = useState<Record<string, string>>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activePreset, setActivePreset] = useState<string>(detectPreset(initial))

  // Note: we don't sync draft when `initial` changes underneath. That would
  // overwrite a user's unsaved edits if another tab saved the theme. After
  // save, `refresh()` updates the tenant context but we keep the draft as-is
  // (matches what was just saved). On Cancel, draft is reset directly.

  const setField = (key: string, value: string) => {
    const next = { ...draft, [key]: value }
    if (value === '') delete next[key]
    setDraft(next)
    applyToDom(next)
    setActivePreset(detectPreset(next))
    setStatus('idle')
  }

  const applyPreset = (key: string) => {
    const preset = PRESETS[key]
    if (preset === null) {
      setDraft({})
      applyToDom({})
    } else if (preset) {
      const next: Record<string, string> = { ...preset }
      // Preserve branding fields across preset switches.
      for (const k of ['displayName', 'footer', 'logoUrl']) {
        if (draft[k]) next[k] = draft[k]
      }
      setDraft(next)
      applyToDom(next)
    }
    setActivePreset(key)
    setStatus('idle')
  }

  const cancel = () => {
    setDraft(initial)
    applyToDom(initial)
    setActivePreset(detectPreset(initial))
    setStatus('idle')
  }

  const save = async () => {
    setStatus('saving')
    try {
      await api<{ theme: Record<string, string> }>('/api/tenant/theme', {
        method: 'PATCH',
        body: { theme: draft },
      })
      setStatus('saved')
      void refresh()
      window.setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  return (
    <div className="admin-page">
      <header className="admin-page__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1>{t.title}</h1>
        <p>{t.sub}</p>
      </header>

      <section className="admin-block">
        <h2>{t.presets}</h2>
        <div className="theme-presets">
          {[
            { key: 'forest', label: t.presetForest, swatch: '#3d6e4e' },
            { key: 'warm', label: t.presetWarm, swatch: '#c1693d' },
            { key: 'cool', label: t.presetCool, swatch: '#3a6079' },
            { key: 'ink', label: t.presetInk, swatch: '#1f1d18' },
          ].map((p) => (
            <button
              key={p.key}
              type="button"
              className={`theme-preset${activePreset === p.key ? ' theme-preset--active' : ''}`}
              onClick={() => applyPreset(p.key)}
            >
              <span className="theme-preset__swatch" style={{ background: p.swatch }} />
              <span className="theme-preset__label">{p.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-block">
        <h2>{t.custom}</h2>
        <div className="theme-fields">
          <ColorField
            label={t.accent}
            value={draft.accent ?? ''}
            onChange={(v) => setField('accent', v)}
          />
          <ColorField
            label={t.accentDeep}
            value={draft.accentDeep ?? ''}
            onChange={(v) => setField('accentDeep', v)}
          />
          <ColorField
            label={t.paperWarm}
            value={draft.paperWarm ?? ''}
            onChange={(v) => setField('paperWarm', v)}
          />
        </div>
      </section>

      <section className="admin-block">
        <h2>{t.branding}</h2>
        <div className="theme-fields">
          <TextField
            label={t.displayName}
            value={draft.displayName ?? ''}
            placeholder={tenant?.displayName ?? ''}
            onChange={(v) => setField('displayName', v)}
          />
          <TextField
            label={t.footer}
            value={draft.footer ?? ''}
            placeholder={tenant?.footer ?? ''}
            onChange={(v) => setField('footer', v)}
          />
          <TextField
            label={t.logoUrl}
            value={draft.logoUrl ?? ''}
            placeholder="https://…"
            onChange={(v) => setField('logoUrl', v)}
          />
        </div>
      </section>

      <footer className="admin-page__actions">
        <button
          type="button"
          className="hero__cta"
          onClick={save}
          disabled={!dirty || status === 'saving'}
        >
          {status === 'saving' ? t.saving : status === 'saved' ? t.saved : t.save}
        </button>
        <button type="button" className="link-btn" onClick={cancel} disabled={!dirty}>
          {t.cancel}
        </button>
        {status === 'error' && <span className="form__error theme-error">{t.error}</span>}
      </footer>
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value)
  return (
    <label className="field theme-field">
      <span className="field__label">{label}</span>
      <div className="theme-field__row">
        <input
          type="color"
          value={valid ? value : '#888888'}
          onChange={(e) => onChange(e.target.value)}
          className="theme-field__color"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#aabbcc"
          className="field__input mono theme-field__hex"
        />
      </div>
    </label>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  return (
    <label className="field theme-field">
      <span className="field__label">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field__input"
      />
    </label>
  )
}

function detectPreset(theme: Partial<TenantPublic['theme']>): string {
  if (!theme || Object.keys(theme).length === 0) return 'forest'
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (preset === null) continue
    if (
      theme.accent?.toLowerCase() === preset.accent.toLowerCase() &&
      theme.accentDeep?.toLowerCase() === preset.accentDeep.toLowerCase()
    ) {
      return key
    }
  }
  return 'custom'
}
