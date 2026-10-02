import { PROFILE_QUESTIONS } from './questionnaire.js';
/** Versioned raw observations, not inferences about attention, intent, or understanding. */
export const SCHEMA_VERSION = 1;
// Limits also enforced by the server and Apps Script receiver.
export const MAX_EVENT_BATCH = 200;
export const MAX_EVENT_BATCH_BYTES = 110000;
export const ACTIONS = {
  session_start: 'system', session_end: 'system', page_view: 'common', visibility_change: 'system', heartbeat: 'system',
  data_value: 'common', feature_edit: 'internal', collection_error: 'system',
  task_select: 'common', dataset_change: 'common', class_change: 'common', sample_select: 'common',
  input_capture: 'common', training_start: 'common', training_batch: 'common', training_stop: 'common',
  model_reset: 'common', config_change: 'common', prediction: 'common', test_record: 'common',
  export_model: 'common', import_model: 'common', action_rejected: 'system',
  scene_view: 'internal', feature_change: 'internal', feature_inspect: 'internal',
  parameter_change: 'internal', direction_predict: 'internal', neuron_change: 'internal',
  visualization_change: 'internal', simulation_action: 'internal',
  survey_open: 'assessment', survey_answer: 'assessment', survey_submit: 'assessment',
  ui_click: 'interaction', ui_pointer_start: 'interaction', ui_pointer_move: 'interaction', ui_pointer_end: 'interaction', ui_input: 'interaction', ui_change: 'interaction',
} as const;
export type Action = keyof typeof ACTIONS;
export type Payload = Record<string, string | number | boolean | number[]>;
export interface EventContext {
  condition: 'experimental' | 'comparison'; task: string; page: string; engine: string;
  workspaceId: string; datasetVersion: number; modelVersion: number;
}
export interface RawEvent {
  schemaVersion: 1; appBuild: string; eventId: string; sessionId: string; sequence: number;
  occurredAt: string; elapsedMs: number; action: Action; context: EventContext; payload: Payload;
}
export interface ResearchProfile { version: string; answers: Record<string, string | string[]>; }
export interface SurveyItem { id: string; text: string; required: boolean; }
export interface Instrument { version: string; title: string; draft: boolean; items: SurveyItem[]; anchors: string[]; }
export interface SurveySubmission { submissionId: string; version: string; answers: Record<string, number>; }
export const DRAFT_INSTRUMENT: Instrument = {
  version: 'draft-v1', title: '검사 화면 미리보기', draft: true,
  items: [{ id: 'demo1', text: '[개발 확인용] 실제 연구 문항은 추후 설정합니다.', required: true }],
  anchors: ['전혀 그렇지 않다', '그렇지 않다', '보통이다', '그렇다', '매우 그렇다'],
};
export const PROFILE_VERSION = 'background-12-v1';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const token = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_.:-]{1,90}$/.test(v);
const numberFields = new Set(['from', 'to', 'value', 'previous', 'label', 'predicted', 'sampleId', 'count', 'classCount', 'hiddenUnits', 'epoch', 'epochs', 'loss', 'accuracy', 'durationMs', 'x', 'y', 'neuron', 'output', 'width', 'height', 'visibleMs', 'gradient', 'rate', 'step', 'scene', 'axis', 'cell', 'rowIndex', 'correctCount', 'testCount', 'inputSize', 'positionX', 'positionY', 'pointerSamples', 'optionIndex']);
const tokenFields = new Set(['operation', 'parameter', 'featureX', 'featureY', 'source', 'mode', 'activation', 'reason', 'format', 'itemId', 'instrumentVersion', 'sampleToken', 'runId', 'batchSizePolicy', 'truthSource', 'elementId', 'control', 'gestureId', 'pointerType', 'coordinateSpace', 'traceVersion']);
const booleanFields = new Set(['correct', 'visible', 'enabled', 'novel', 'trained', 'completed', 'cancelled', 'coordinatesOmitted', 'empty', 'valid']);
const arrayFields = new Set(['probabilities', 'classCounts', 'coordinates', 'values', 'hidden', 'logits']);

/** Applied on BOTH sides. Never accept arbitrary text, images, filenames, or identity fields. */
export function validPayload(value: unknown): value is Payload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).length <= 32 && Object.entries(value).every(([key, v]) =>
    numberFields.has(key) ? typeof v === 'number' && Number.isFinite(v) :
    tokenFields.has(key) ? token(v) : booleanFields.has(key) ? typeof v === 'boolean' :
    arrayFields.has(key) ? Array.isArray(v) && v.length <= 16 && v.every(n => typeof n === 'number' && Number.isFinite(n)) : false);
}
export function validEvent(e: unknown): e is RawEvent {
  if (!e || typeof e !== 'object') return false;
  const r = e as RawEvent, c = r.context;
  return r.schemaVersion === 1 && token(r.appBuild) && UUID.test(r.eventId) && UUID.test(r.sessionId) && Number.isSafeInteger(r.sequence) && r.sequence > 0 &&
    typeof r.occurredAt === 'string' && /^\d{4}-\d\d-\d\dT/.test(r.occurredAt) && Number.isFinite(Date.parse(r.occurredAt)) && r.occurredAt.length <= 30 &&
    Number.isFinite(r.elapsedMs) && r.elapsedMs >= 0 && r.elapsedMs < 1e12 && Object.hasOwn(ACTIONS, r.action) && !!c &&
    ['experimental', 'comparison'].includes(c.condition) && token(c.task) && token(c.page) && token(c.engine) && UUID.test(c.workspaceId) &&
    Number.isSafeInteger(c.datasetVersion) && c.datasetVersion >= 0 && Number.isSafeInteger(c.modelVersion) && c.modelVersion >= 0 && validPayload(r.payload) &&
    Object.keys(r).every(k => ['schemaVersion','appBuild','eventId','sessionId','sequence','occurredAt','elapsedMs','action','context','payload'].includes(k)) &&
    Object.keys(c).every(k => ['condition','task','page','engine','workspaceId','datasetVersion','modelVersion'].includes(k));
}
export function validProfile(p: unknown): p is ResearchProfile {
  const v = p as ResearchProfile;
  if (!v || v.version !== PROFILE_VERSION || Object.keys(v).length !== 2 || !v.answers || typeof v.answers !== 'object' || Array.isArray(v.answers)) return false;
  const short=(s:unknown):s is string=>typeof s==='string' && s.trim().length>0 && s.length<=40 && !/[\x00-\x1f]/.test(s);
  if (!Object.keys(v.answers).every(k=>PROFILE_QUESTIONS.some(q=>q.id===k) || (k==='A4_text' && v.answers.A4==='직접 입력'))) return false;
  if (v.answers.A4==='직접 입력' && !short(v.answers.A4_text)) return false;
  return PROFILE_QUESTIONS.every(q=>{
    const a=v.answers[q.id];
    if(q.multiple)return Array.isArray(a) && a.length>0 && new Set(a).size===a.length && a.every(s=>q.options!.includes(s)) && (!a.includes('없음') || a.length===1);
    return q.options?typeof a==='string' && q.options.includes(a):short(a);
  });
}
export function validSurvey(s: unknown, instrument: Instrument): s is SurveySubmission {
  const v = s as SurveySubmission;
  return !!v && UUID.test(v.submissionId) && v.version === instrument.version && !!v.answers && Object.keys(v).length === 3 &&
    typeof v.answers === 'object' && !Array.isArray(v.answers) &&
    Object.entries(v.answers).every(([id, n]) => instrument.items.some(i => i.id === id) && Number.isInteger(n) && n >= 1 && n <= instrument.anchors.length) &&
    instrument.items.every(i => !i.required || Object.hasOwn(v.answers,i.id));
}
