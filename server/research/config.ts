import { randomBytes } from 'node:crypto';
import { PROFILE_VERSION, type Instrument } from '../../src/research/schema';
import { STUDY_INSTRUMENT } from '../../src/research/questionnaire';
export interface ResearchConfig {
  mode: 'off' | 'local' | 'google'; origin: string; study: string; googleClientId: string;
  sessionKey: string; pseudonymKey: string; identityKey: string; gatewayUrl: string; gatewaySecret: string;
  enrollmentCode: string; consentVersion: string; profileApproved: boolean; instrument: Instrument;
}
const localKey = randomBytes(32).toString('base64');
export function researchConfig(env: Record<string,string|undefined> = process.env): ResearchConfig {
  const mode = env.RESEARCH_MODE ?? 'off';
  if (!['off','local','google'].includes(mode)) throw new Error('Invalid RESEARCH_MODE');
  const origin = env.RESEARCH_ORIGIN ?? 'http://127.0.0.1:4173';
  const url = new URL(origin);
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (mode === 'local' && (!local || env.NODE_ENV === 'production' || env.VERCEL)) throw new Error('Local research mode is forbidden in production');
  if (mode === 'google' && !local && url.protocol !== 'https:') throw new Error('Research origin requires HTTPS');
  let instrument = structuredClone(STUDY_INSTRUMENT);
  if (env.RESEARCH_INSTRUMENT_JSON) {
    instrument = JSON.parse(env.RESEARCH_INSTRUMENT_JSON) as Instrument;
    if (!/^[a-zA-Z0-9_.-]{1,60}$/.test(instrument.version) || typeof instrument.title !== 'string' || instrument.title.length > 100 || typeof instrument.draft !== 'boolean' ||
      !Array.isArray(instrument.anchors) || instrument.anchors.length < 2 || instrument.anchors.length > 7 || instrument.anchors.some(a => typeof a !== 'string' || a.length > 80) ||
      !Array.isArray(instrument.items) || instrument.items.length > 60 || instrument.items.some(i => !/^[a-zA-Z0-9_.-]{1,60}$/.test(i.id) || ['__proto__','constructor','prototype'].includes(i.id) || typeof i.text !== 'string' || i.text.length > 500 || typeof i.required !== 'boolean') || new Set(instrument.items.map(i=>i.id)).size !== instrument.items.length) throw new Error('Invalid survey configuration');
  }
  const config: ResearchConfig = { mode: mode as ResearchConfig['mode'], origin: url.origin, study: env.RESEARCH_STUDY_ID ?? 'neural-lab-pilot', googleClientId: env.GOOGLE_CLIENT_ID ?? '',
    sessionKey: env.RESEARCH_SESSION_KEY ?? (mode === 'local' ? localKey : ''), pseudonymKey: env.RESEARCH_PSEUDONYM_KEY ?? (mode === 'local' ? localKey : ''),
    identityKey: env.RESEARCH_IDENTITY_KEY ?? (mode === 'local' ? localKey : ''), gatewayUrl: env.RESEARCH_SHEETS_GATEWAY_URL ?? '', gatewaySecret: env.RESEARCH_SHEETS_GATEWAY_SECRET ?? '',
    enrollmentCode: env.RESEARCH_ENROLLMENT_CODE ?? '', consentVersion: env.RESEARCH_CONSENT_VERSION ?? 'draft-v1', profileApproved: env.RESEARCH_PROFILE_APPROVED === 'true', instrument };
  if (!/^[a-zA-Z0-9_-]{1,60}$/.test(config.study)) throw new Error('Invalid study ID');
  if (mode === 'google') {
    if ([config.sessionKey,config.pseudonymKey,config.gatewaySecret,config.enrollmentCode].some(s=>s.length<32) || Buffer.from(config.identityKey,'base64').length!==32 || !config.googleClientId || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(config.gatewayUrl)) throw new Error('Research server credentials are incomplete');
    if (new Set([config.sessionKey,config.pseudonymKey,config.identityKey,config.gatewaySecret]).size !== 4) throw new Error('Use separate research keys');
    if (!config.profileApproved || config.consentVersion.startsWith('draft') || PROFILE_VERSION.startsWith('draft')) throw new Error('Research protocol must be configured before live collection');
  }
  return config;
}
