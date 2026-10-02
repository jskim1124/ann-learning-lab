import { mac } from './crypto';
import type { ResearchConfig } from './config';
export interface Participant { participantId: string; consentVersion: string; joinedAt: string; profile: object; identityCiphertext: string; }
export interface SheetRow { id: string; participantId: string; values: unknown[]; }
export interface ResearchSink {
  participant(id: string): Promise<Participant | null>;
  join(participant: Participant): Promise<void>;
  append(sheet: 'RawEvents' | 'SurveyResponses', rows: SheetRow[]): Promise<string[]>;
}
/** Local tests only: no network, no real students, explicitly lost on server restart. */
export class MemorySink implements ResearchSink {
  participants = new Map<string, Participant>();
  rows = { RawEvents: new Map<string, SheetRow>(), SurveyResponses: new Map<string, SheetRow>() };
  async participant(id: string) { return this.participants.get(id) ?? null; }
  async join(p: Participant) { const old=this.participants.get(p.participantId);if (!old || (old.profile as {version?:string}).version!==(p.profile as {version?:string}).version || old.consentVersion!==p.consentVersion) this.participants.set(p.participantId, p); }
  async append(sheet: 'RawEvents' | 'SurveyResponses', rows: SheetRow[]) {
    rows.forEach(r => { const key = `${r.participantId}:${r.id}`; if (!this.rows[sheet].has(key)) this.rows[sheet].set(key, r); });
    return rows.map(r=>r.id);
  }
}
export class SheetsGateway implements ResearchSink {
  constructor(private config: ResearchConfig) {}
  private async call(operation: string, data: object): Promise<any> {
    const body = JSON.stringify({ study: this.config.study, operation, ...data }), timestamp = Date.now();
    const response = await fetch(this.config.gatewayUrl, { method: 'POST', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ timestamp, body, signature: mac(this.config.gatewaySecret, `${timestamp}.${body}`) }) });
    if (!response.ok) throw new Error('Research storage unavailable');
    const result = await response.json() as { ok?: boolean; data?: unknown };
    if (!result.ok) throw new Error('Research storage rejected request');
    return result.data;
  }
  async participant(participantId: string): Promise<Participant | null> { return this.call('participant', { participantId }); }
  async join(participant: Participant): Promise<void> { await this.call('join', { participant }); }
  async append(sheet: 'RawEvents' | 'SurveyResponses', rows: SheetRow[]): Promise<string[]> {
    const result = await this.call('append', { sheet, rows });
    if (!Array.isArray(result) || result.some(id => typeof id !== 'string' || !rows.some(r=>r.id===id))) throw new Error('Invalid storage acknowledgement');
    return result;
  }
}
