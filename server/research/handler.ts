import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { ACTIONS, MAX_EVENT_BATCH, PROFILE_VERSION, validEvent, validProfile, validSurvey, type RawEvent } from '../../src/research/schema.js';
import { encryptSubject, equal, pseudonym, seal, unseal } from './crypto.js';
import type { ResearchConfig } from './config.js';
import type { ResearchSink } from './sink.js';

interface Session { exp: number; participantId: string; csrf: string; identityCiphertext: string; }
interface Challenge { exp: number; nonce: string; csrf: string; }
interface Identity { sub: string; nonce: string; }
type VerifyIdentity = (credential: string, audience: string) => Promise<Identity>;
const officialVerify: VerifyIdentity = async (credential, audience) => {
  const ticket = await new OAuth2Client().verifyIdToken({ idToken: credential, audience });
  const payload = ticket.getPayload();
  if (!payload?.sub || !['accounts.google.com','https://accounts.google.com'].includes(payload.iss)) throw new Error('Invalid identity');
  return { sub: payload.sub, nonce: (payload as typeof payload & { nonce?: string }).nonce ?? '' };
};
function cookies(req: IncomingMessage): Record<string,string> { return Object.fromEntries((req.headers.cookie ?? '').split(';').map(s=>s.trim().split(/=(.*)/s).slice(0,2)).filter(p=>p.length===2)); }
function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer' }); res.end(JSON.stringify(data));
}
async function body(req: IncomingMessage): Promise<any> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('content-type');
  const parts: Buffer[] = []; let size = 0;
  for await (const part of req) { const b = Buffer.from(part); size += b.length; if (size > 150000) throw new Error('too-large'); parts.push(b); }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
/** Same-origin only; backend is the only component allowed to talk to Sheets. */
export function createResearchHandler(config: ResearchConfig, sink: ResearchSink, verify: VerifyIdentity = officialVerify) {
  const limits = new Map<string, { count: number; until: number }>();
  const cookie = (name: string, value: string, seconds: number) => `${name}=${value}; Path=/api/research; HttpOnly; SameSite=Strict; Max-Age=${seconds}${config.origin.startsWith('https:')?'; Secure':''}`;
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const route = new URL(req.url ?? '/', config.origin).pathname.split('/').at(-1);
      if (config.mode === 'off') { json(res, route === 'config' ? 200 : 503, { enabled: false }); return; }
      if (req.headers.host !== new URL(config.origin).host || (req.headers.origin && req.headers.origin !== config.origin)) { json(res, 403, { error: 'origin' }); return; }
      const jar = cookies(req), session = unseal<Session>(config.sessionKey, jar.nl_session), challenge = unseal<Challenge>(config.sessionKey, jar.nl_challenge);
      const key = session?.participantId ?? req.socket.remoteAddress ?? 'anonymous';
      const now = Date.now(); if (limits.size > 1000) for (const [k,v] of limits) if (v.until < now) limits.delete(k);
      const bucket = limits.get(key); if (bucket && bucket.until > now) { if (++bucket.count > 240) { json(res,429,{error:'rate-limit'}); return; } } else limits.set(key,{count:1,until:now+60000});
      if (req.method === 'GET' && route === 'config') {
        const c: Challenge = challenge ?? { nonce: randomUUID(), csrf: randomUUID(), exp: now + 600000 };
        if (!challenge) res.setHeader('Set-Cookie',cookie('nl_challenge',seal(config.sessionKey,c),600));
        const participant = session ? await sink.participant(session.participantId) : null;
        json(res,200,{ enabled:true, mode:config.mode, study:config.study, googleClientId:config.googleClientId,
          nonce:c.nonce, csrf:session?.csrf ?? c.csrf, participantId:session?.participantId ?? null, consented:!!participant && validProfile(participant.profile) && participant.consentVersion===config.consentVersion,
          consentVersion:config.consentVersion, profileVersion:PROFILE_VERSION, profileDraft:!config.profileApproved,
          instrument:config.instrument, surveyAvailable:config.mode==='local'||(!config.instrument.draft&&config.instrument.items.length>0) }); return;
      }
      if (req.method !== 'POST') { json(res,405,{error:'method'}); return; }
      if (req.headers.origin !== config.origin) { json(res,403,{error:'origin'}); return; }
      const csrf = String(req.headers['x-research-csrf'] ?? '');
      const expected = route === 'login' ? challenge?.csrf : session?.csrf;
      if (!expected || !equal(csrf,expected)) { json(res,403,{error:'csrf'}); return; }
      const data = await body(req);
      if (route === 'login') {
        if (!challenge) { json(res,401,{error:'challenge-expired'}); return; }
        let subject: string;
        if (config.mode === 'local') subject = 'local-development-only';
        else {
          if (typeof data.credential !== 'string' || data.credential.length > 12000) { json(res,400,{error:'credential'}); return; }
          const identity = await verify(data.credential,config.googleClientId);
          if (!equal(identity.nonce,challenge.nonce)) { json(res,401,{error:'nonce'}); return; }
          subject = identity.sub;
        }
        const s: Session = { participantId:pseudonym(config.pseudonymKey,config.study,subject), identityCiphertext:encryptSubject(config.identityKey,subject,config.study), csrf:randomUUID(), exp:now+8*3600000 };
        res.setHeader('Set-Cookie',[cookie('nl_session',seal(config.sessionKey,s),28800),cookie('nl_challenge','',0)]);
        json(res,200,{ok:true}); return;
      }
      if (!session) { json(res,401,{error:'login-required'}); return; }
      if (route === 'logout') { res.setHeader('Set-Cookie',cookie('nl_session','',0)); json(res,200,{ok:true}); return; }
      if (route === 'profile') {
        if (!validProfile(data.profile) || data.consent !== true || data.consentVersion !== config.consentVersion ||
          (config.mode === 'google' && (typeof data.enrollmentCode!=='string' || !equal(data.enrollmentCode,config.enrollmentCode)))) { json(res,400,{error:'profile-or-enrollment'}); return; }
        await sink.join({ participantId:session.participantId, identityCiphertext:session.identityCiphertext, joinedAt:new Date(now).toISOString(), profile:data.profile, consentVersion:config.consentVersion });
        json(res,200,{ok:true}); return;
      }
      const participant=await sink.participant(session.participantId);
      if (!participant || !validProfile(participant.profile) || participant.consentVersion!==config.consentVersion) { json(res,403,{error:'consent-required'}); return; }
      if (route === 'events') {
        if (!Array.isArray(data.events) || !data.events.length || data.events.length>MAX_EVENT_BATCH || !data.events.every(validEvent)) { json(res,400,{error:'event-schema'}); return; }
        const receivedAt = new Date(now).toISOString();
        const rows = (data.events as RawEvent[]).map(e=>({ id:e.eventId, participantId:session.participantId, values:[e.eventId,config.study,session.participantId,e.sessionId,e.sequence,e.occurredAt,receivedAt,e.elapsedMs,e.schemaVersion,e.appBuild,e.context.condition,e.context.task,e.context.page,e.context.engine,e.context.workspaceId,e.context.datasetVersion,e.context.modelVersion,e.action,ACTIONS[e.action],JSON.stringify(e.payload)] }));
        json(res,200,{accepted:await sink.append('RawEvents',rows)}); return;
      }
      if (route === 'survey') {
        if ((config.mode!=='local'&&config.instrument.draft) || !validSurvey(data,config.instrument)) { json(res,400,{error:'survey-schema'}); return; }
        const rows = [{ id:data.submissionId, participantId:session.participantId, values:[data.submissionId,config.study,session.participantId,new Date(now).toISOString(),data.version,JSON.stringify(data.answers)] }];
        json(res,200,{accepted:await sink.append('SurveyResponses',rows)}); return;
      }
      json(res,404,{error:'route'});
    } catch { json(res,503,{error:'research-unavailable'}); } // Never echo tokens, personal data, or upstream errors.
  };
}
