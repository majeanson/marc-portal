import { api } from './api'

/** Mirror of QUESTION_LIMITS in functions/api/questions.ts, so the form shows
 *  inline errors before the server 400s. */
export const QUESTION_LIMITS = { bodyMin: 10, bodyMax: 1500, emailMax: 254 } as const

export function submitQuestion(input: { email: string; body: string }): Promise<{
  received: true
}> {
  return api('/api/questions', { method: 'POST', body: input })
}
