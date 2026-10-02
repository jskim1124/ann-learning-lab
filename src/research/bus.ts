import { validPayload, type Action, type EventContext, type Payload } from './schema';
type Observer = (action: Action, payload: Payload, context: EventContext) => void;
const listeners = new Set<Observer>();
let observationGeneration=0;
let context: EventContext = { condition: 'experimental', task: 'digits', page: '1', engine: 'none', workspaceId: crypto.randomUUID(), datasetVersion: 0, modelVersion: 0 };
export function researchContext(patch: Partial<EventContext>): void { context = { ...context, ...patch }; }
export function currentResearchContext(): EventContext { return { ...context }; }
export function observeResearch(listener: Observer): () => void { observationGeneration++;listeners.add(listener); return () => {observationGeneration++;listeners.delete(listener);}; }
export function researchIsObserved():boolean {return listeners.size>0;}
export function researchObservationGeneration():number {return observationGeneration;}
/** No observers until consent. Instrumentation never changes model calculations. */
export function recordResearch(action: Action, payload: Payload = {}, patch: Partial<EventContext> = {}): void {
  if (!listeners.size) return;
  // Retain a diagnostic instead of silently hiding a schema gap. Never copy the
  // rejected content: it may contain a private/unlisted value.
  if (!validPayload(payload)) {payload={operation:action,reason:'payload-schema'};action='collection_error';}
  for (const listener of listeners) { try { listener(action, payload, { ...context, ...patch }); } catch { /* Collection must not interrupt learning. */ } }
}
