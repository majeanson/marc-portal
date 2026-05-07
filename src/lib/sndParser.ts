/**
 * Sunday Night Dread — voice-to-invoice mock parser.
 * Static demo: 3 hand-written composite transcripts, real Quebec trades vocab.
 * Parser uses regex + a small bilingual lexicon to extract materials, labor hours,
 * and client mentions. Real working code, deliberately small. Anchored in the
 * 4 SND engineering decisions (free-text + lexicon, bilingual mid-note, etc).
 */

export interface ParsedMaterial {
  raw: string
  quantity?: number
  unit?: string
  item: string
}

export interface ParsedItem {
  type: 'material' | 'labor' | 'client' | 'note'
  text: string
  quantity?: number
  unit?: string
}

export interface ParseResult {
  client?: string
  hours?: number
  jobType?: string
  materials: ParsedMaterial[]
  notes: string[]
}

export interface VoiceClip {
  id: string
  client: string
  weekday: { fr: string; en: string }
  time: { fr: string; en: string }
  jobLabel: { fr: string; en: string }
  transcript: { fr: string; en: string }
  expected: ParseResult
}

const NUM_WORDS_FR: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  trente: 30,
}
const NUM_WORDS_EN: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  thirty: 30,
}

const CLIENT_RE = /\bchez\s+([A-ZÀ-Ÿ][\wÀ-ÿ-]+)/i
const HOURS_RE_FR =
  /([\d.,]+|une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+heures?(?:\s+(et\s+demie|et\s+quart))?/i
const HOURS_RE_EN =
  /([\d.,]+|one|two|three|four|five|six|seven|eight|nine|ten)\s+hours?(?:\s+(and a half))?/i

function parseNum(token: string, lang: 'fr' | 'en'): number | undefined {
  const cleaned = token.toLowerCase().replace(',', '.')
  const asFloat = parseFloat(cleaned)
  if (!Number.isNaN(asFloat)) return asFloat
  const dict = lang === 'fr' ? NUM_WORDS_FR : NUM_WORDS_EN
  return dict[cleaned]
}

function extractHours(text: string): number | undefined {
  const fr = text.match(HOURS_RE_FR)
  if (fr) {
    const base = parseNum(fr[1], 'fr') ?? 0
    if (fr[2]?.includes('demie')) return base + 0.5
    if (fr[2]?.includes('quart')) return base + 0.25
    return base
  }
  const en = text.match(HOURS_RE_EN)
  if (en) {
    const base = parseNum(en[1], 'en') ?? 0
    if (en[2]) return base + 0.5
    return base
  }
  return undefined
}

function extractClient(text: string): string | undefined {
  const m = text.match(CLIENT_RE)
  return m?.[1]
}

const MATERIAL_PATTERNS: Array<{
  re: RegExp
  itemFr: string
  itemEn: string
  unitFr?: string
  unitEn?: string
  lang: 'fr' | 'en' | 'both'
}> = [
  // 2x4 boards
  {
    re: /(\d+|un|une|deux|trois|quatre|cinq|two|three|four|five)\s+(planches?\s+(de\s+)?)?2x4/i,
    itemFr: '2x4',
    itemEn: '2x4 board',
    unitFr: 'planche',
    unitEn: 'board',
    lang: 'both',
  },
  // bucket of plaster / plâtre
  {
    re: /(\d+|un|une|deux|a)\s+seau(x)?\s+de\s+plâtre/i,
    itemFr: 'seau de plâtre',
    itemEn: 'bucket of plaster',
    lang: 'fr',
  },
  // sheets of drywall
  {
    re: /(\d+|two|three|four|five|deux|trois)\s+sheets?\s+of\s+drywall/i,
    itemFr: 'feuilles de gypse',
    itemEn: 'sheets of drywall',
    lang: 'both',
  },
  // wire (FR: fil 14/2)
  {
    re: /(\d+|trente|thirty)\s+pieds?\s+(de\s+)?fil\s+(\d+\/\d+)/i,
    itemFr: 'pieds de fil 14/2',
    itemEn: 'feet of 14/2 wire',
    unitFr: 'pi',
    unitEn: 'ft',
    lang: 'fr',
  },
  // switches
  {
    re: /(\d+|deux|two|trois|three)\s+interrupteurs?/i,
    itemFr: 'interrupteurs',
    itemEn: 'switches',
    lang: 'fr',
  },
  // sink (évier)
  {
    re: /(un|une|a|one)\s+évier/i,
    itemFr: 'évier',
    itemEn: 'sink',
    lang: 'fr',
  },
  // faucet
  {
    re: /(un|une|a|one|le)\s+robinet/i,
    itemFr: 'robinet',
    itemEn: 'faucet',
    lang: 'fr',
  },
  // grease trap
  {
    re: /(une?|a|one)\s+trappe\s+à\s+grease/i,
    itemFr: 'trappe à grease',
    itemEn: 'grease trap',
    lang: 'fr',
  },
]

function extractMaterials(text: string): ParsedMaterial[] {
  const out: ParsedMaterial[] = []
  for (const p of MATERIAL_PATTERNS) {
    const m = text.match(p.re)
    if (m) {
      const qToken = m[1]
      const q = parseNum(qToken, 'fr') ?? parseNum(qToken, 'en')
      out.push({
        raw: m[0],
        quantity: q,
        unit: p.unitFr,
        item: p.itemFr,
      })
    }
  }
  return out
}

const JOB_KEYWORDS_FR = [
  ['plomberie', 'plomberie'],
  ['électrique', 'électrique'],
  ['electrique', 'électrique'],
  ['peinture', 'peinture'],
  ['plumbing', 'plomberie'],
  ['electrical', 'électrique'],
] as const

function extractJobType(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const [kw, label] of JOB_KEYWORDS_FR) {
    if (lower.includes(kw)) return label
  }
  return undefined
}

export function parseTranscript(text: string): ParseResult {
  return {
    client: extractClient(text),
    hours: extractHours(text),
    jobType: extractJobType(text),
    materials: extractMaterials(text),
    notes: [],
  }
}

// -------- Fixtures (3 composite voice clips) --------

export const VOICE_CLIPS: VoiceClip[] = [
  {
    id: 'tuesday-tremblay',
    client: 'Tremblay',
    weekday: { fr: 'Mardi', en: 'Tuesday' },
    time: { fr: '14h15', en: '2:15pm' },
    jobLabel: { fr: 'Rénovation salle de bain', en: 'Bathroom renovation' },
    transcript: {
      fr: "Mardi, deux heures et demie chez Tremblay, j'ai posé deux planches de 2x4, un seau de plâtre, j'ai retouché le coin de la salle de bain. Reste à finir la peinture la semaine prochaine.",
      en: "Tuesday, two hours and a half at Tremblay's place. Put in two 2x4 boards, a bucket of plaster, touched up the bathroom corner. Still need to finish the painting next week.",
    },
    expected: {
      client: 'Tremblay',
      hours: 2.5,
      jobType: 'peinture',
      materials: [
        { raw: 'deux planches de 2x4', quantity: 2, unit: 'planche', item: '2x4' },
        { raw: 'un seau de plâtre', quantity: 1, item: 'seau de plâtre' },
      ],
      notes: [],
    },
  },
  {
    id: 'thursday-cote',
    client: 'Côté',
    weekday: { fr: 'Jeudi', en: 'Thursday' },
    time: { fr: '9h30', en: '9:30am' },
    jobLabel: { fr: 'Travail électrique', en: 'Electrical work' },
    transcript: {
      fr: 'Jeudi matin, electrique chez Côté, trois heures, j’ai changé deux interrupteurs et passé du fil 14/2 sur 30 pieds.',
      en: "Thursday morning, electrical at Côté's, three hours. Changed two switches and ran 30 feet of 14/2 wire.",
    },
    expected: {
      client: 'Côté',
      hours: 3,
      jobType: 'électrique',
      materials: [
        { raw: 'deux interrupteurs', quantity: 2, item: 'interrupteurs' },
        { raw: '30 pieds de fil 14/2', quantity: 30, unit: 'pi', item: 'pieds de fil 14/2' },
      ],
      notes: [],
    },
  },
  {
    id: 'friday-bouchard',
    client: 'Bouchard',
    weekday: { fr: 'Vendredi', en: 'Friday' },
    time: { fr: '15h00', en: '3:00pm' },
    jobLabel: { fr: 'Plomberie de cuisine', en: 'Kitchen plumbing' },
    transcript: {
      fr: 'Vendredi après-midi, deux heures et demie chez Bouchard, plomberie, j’ai installé un évier et changé le robinet, plus une trappe à grease.',
      en: "Friday afternoon, two hours and a half at Bouchard's, plumbing. Installed a sink, changed the faucet, plus a grease trap.",
    },
    expected: {
      client: 'Bouchard',
      hours: 2.5,
      jobType: 'plomberie',
      materials: [
        { raw: 'un évier', quantity: 1, item: 'évier' },
        { raw: 'le robinet', quantity: 1, item: 'robinet' },
        { raw: 'une trappe à grease', quantity: 1, item: 'trappe à grease' },
      ],
      notes: [],
    },
  },
]

// -------- Invoice model --------

export interface InvoiceLine {
  description: string
  quantity: number
  unit?: string
  unitPrice: number
  lineTotal: number
}

export interface DraftInvoice {
  client: string
  weekStart: string
  hoursTotal: number
  laborRate: number
  laborSubtotal: number
  materialLines: InvoiceLine[]
  materialsSubtotal: number
  subtotal: number
  gst: number
  qst: number
  total: number
  notes: string[]
}

const LABOR_RATE = 75 // $/h, plausible Quebec trades rate
const PRICE_BOOK: Record<string, number> = {
  '2x4': 5.5,
  'seau de plâtre': 18,
  'feuilles de gypse': 22,
  interrupteurs: 8,
  'pieds de fil 14/2': 1.4,
  évier: 320,
  robinet: 110,
  'trappe à grease': 95,
}

export function buildInvoice(
  client: string,
  weekStart: string,
  parses: ParseResult[],
): DraftInvoice {
  const hoursTotal = parses.reduce((sum, p) => sum + (p.hours ?? 0), 0)
  const laborSubtotal = hoursTotal * LABOR_RATE

  const materialLines: InvoiceLine[] = []
  for (const p of parses) {
    for (const m of p.materials) {
      const q = m.quantity ?? 1
      const unitPrice = PRICE_BOOK[m.item] ?? 10
      materialLines.push({
        description: m.item,
        quantity: q,
        unit: m.unit,
        unitPrice,
        lineTotal: q * unitPrice,
      })
    }
  }

  const materialsSubtotal = materialLines.reduce((s, l) => s + l.lineTotal, 0)
  const subtotal = laborSubtotal + materialsSubtotal
  const gst = +(subtotal * 0.05).toFixed(2)
  const qst = +(subtotal * 0.09975).toFixed(2)
  const total = +(subtotal + gst + qst).toFixed(2)

  return {
    client,
    weekStart,
    hoursTotal,
    laborRate: LABOR_RATE,
    laborSubtotal: +laborSubtotal.toFixed(2),
    materialLines,
    materialsSubtotal: +materialsSubtotal.toFixed(2),
    subtotal: +subtotal.toFixed(2),
    gst,
    qst,
    total,
    notes: parses.flatMap((p) => p.notes),
  }
}
