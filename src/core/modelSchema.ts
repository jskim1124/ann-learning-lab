import type { DataPoint, NetworkModel, StoredModelV2 } from "../types";
import { PRESETS } from "../data/presets";

const FORMAT = "neural-lab/model-v2" as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function createStoredModel(
  task: StoredModelV2["task"],
  data: DataPoint[],
  model: NetworkModel,
  loss: number,
  accuracy: number,
): StoredModelV2 {
  return {
    format: FORMAT,
    createdAt: new Date().toISOString(),
    task,
    inputs: { names: PRESETS[task].axes, range: [-1, 1] },
    classes: PRESETS[task].classes,
    model: structuredClone(model),
    metrics: { loss, accuracy },
    data: data.map((point) => ({ ...point })),
  };
}

export function parseStoredModel(source: string): StoredModelV2 {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("JSON 형식이 올바르지 않습니다.");
  }
  if (!value || typeof value !== "object") throw new Error("모델 파일의 구조가 올바르지 않습니다.");
  const candidate = value as Partial<StoredModelV2>;
  if (candidate.format !== FORMAT) throw new Error("지원하지 않는 모델 포맷입니다. model-v2 파일을 사용하세요.");
  const model = candidate.model;
  if (!model || !model.config || !model.parameters) throw new Error("모델 파라미터가 없습니다.");
  const hidden = model.config.hiddenUnits;
  if (!Number.isInteger(hidden) || hidden < 1 || hidden > 6) throw new Error("규칙 찾기 칸 수가 범위를 벗어났습니다.");
  if (!["tanh", "relu", "sigmoid"].includes(model.config.activation)) throw new Error("지원하지 않는 활성화 함수입니다.");
  const p = model.parameters;
  if (
    p.inputHidden.length !== hidden ||
    p.hiddenBias.length !== hidden ||
    p.hiddenOutput.length !== hidden ||
    p.inputHidden.some((pair) => pair.length !== 2 || !pair.every(isFiniteNumber)) ||
    !p.hiddenBias.every(isFiniteNumber) ||
    !p.hiddenOutput.every(isFiniteNumber) ||
    !isFiniteNumber(p.outputBias)
  ) throw new Error("모델 파라미터 크기 또는 값이 올바르지 않습니다.");
  if (!Array.isArray(candidate.data) || candidate.data.some((point) =>
    !isFiniteNumber(point.x) || !isFiniteNumber(point.y) || ![0, 1].includes(point.label)
  )) throw new Error("학습 데이터가 올바르지 않습니다.");
  return candidate as StoredModelV2;
}
