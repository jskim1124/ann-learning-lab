import type { DataPoint, Label } from "../types";

export type CustomInputKind = "numbers" | "drawing" | "webcam" | "text";

export interface CustomRow {
  id: number;
  name: string;
  label: Label;
  values: number[];
}

export interface CustomDatasetDraft {
  inputKind: CustomInputKind;
  classes: [string, string];
  features: string[];
  rows: CustomRow[];
  xFeature: number;
  yFeature: number;
  nextId: number;
}

export interface CustomProjection {
  axes: [string, string];
  classes: [string, string];
  points: DataPoint[];
}

export function featuresForInput(kind: CustomInputKind): string[] {
  if (kind === "text") return ["글자 수", "단어 수", "다른 글자 비율", "숫자 비율"];
  if (kind === "drawing" || kind === "webcam") return ["진한 양", "가로 위치", "세로 위치", "퍼진 정도"];
  return ["특징 1", "특징 2", "특징 3"];
}

export function createCustomDraft(inputKind: CustomInputKind = "numbers"): CustomDatasetDraft {
  return { inputKind, classes: ["A 결과", "B 결과"], features: featuresForInput(inputKind), rows: [], xFeature: 0, yFeature: 1, nextId: 1 };
}

export function createCustomExample(): CustomDatasetDraft {
  return {
    inputKind: "numbers",
    classes: ["A 종류", "B 종류"],
    features: ["길이", "무게", "밝기"],
    rows: [
      { id: 1, name: "관찰 1", label: 0, values: [2, 7, 3] },
      { id: 2, name: "관찰 2", label: 0, values: [3, 4, 7] },
      { id: 3, name: "관찰 3", label: 0, values: [4, 8, 4] },
      { id: 4, name: "관찰 4", label: 0, values: [3, 6, 8] },
      { id: 5, name: "관찰 5", label: 1, values: [8, 5, 4] },
      { id: 6, name: "관찰 6", label: 1, values: [9, 8, 8] },
      { id: 7, name: "관찰 7", label: 1, values: [7, 4, 3] },
      { id: 8, name: "관찰 8", label: 1, values: [10, 7, 7] },
    ],
    xFeature: 0,
    yFeature: 1,
    nextId: 9,
  };
}

export function textFeatures(source: string): number[] {
  const compact = [...source].filter((character) => !/\s/u.test(character));
  const words = source.trim() ? source.trim().split(/\s+/u).length : 0;
  const unique = new Set(compact.map((character) => character.toLocaleLowerCase())).size;
  const digits = compact.filter((character) => /[0-9]/u.test(character)).length;
  return [compact.length, words, compact.length ? unique / compact.length * 100 : 0, compact.length ? digits / compact.length * 100 : 0];
}

export function imageFeatures(rgba: Uint8ClampedArray, width: number, height: number): number[] {
  let ink = 0; let weightedX = 0; let weightedY = 0;
  const strengths: number[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = (y * width + x) * 4; const alpha = (rgba[offset + 3] ?? 255) / 255;
    const brightness = ((rgba[offset] ?? 255) + (rgba[offset + 1] ?? 255) + (rgba[offset + 2] ?? 255)) / (3 * 255);
    const strength = Math.max(0, 1 - brightness) * alpha; strengths.push(strength); ink += strength; weightedX += x * strength; weightedY += y * strength;
  }
  if (ink < 1e-6) return [0, (width - 1) / 2, (height - 1) / 2, 0];
  const centerX = weightedX / ink; const centerY = weightedY / ink; let spread = 0;
  strengths.forEach((strength, index) => { const x = index % width; const y = Math.floor(index / width); spread += ((x - centerX) ** 2 + (y - centerY) ** 2) * strength; });
  const maxDistance = Math.hypot(width - 1, height - 1) || 1;
  return [ink / (width * height) * 100, centerX, centerY, Math.sqrt(spread / ink) / maxDistance * 100];
}

function normalized(values: number[]): number[] {
  const low = Math.min(...values); const high = Math.max(...values);
  if (!Number.isFinite(low) || !Number.isFinite(high) || Math.abs(high - low) < 1e-9) return values.map(() => 0);
  return values.map((value) => ((value - low) / (high - low)) * 1.8 - .9);
}

export function projectCustomDataset(draft: CustomDatasetDraft): CustomProjection {
  const xValues = normalized(draft.rows.map((row) => row.values[draft.xFeature] ?? 0));
  const yValues = normalized(draft.rows.map((row) => row.values[draft.yFeature] ?? 0));
  return {
    axes: [draft.features[draft.xFeature] ?? "가로 특징", draft.features[draft.yFeature] ?? "세로 특징"],
    classes: [...draft.classes],
    points: draft.rows.map((row, index) => ({ x: xValues[index] ?? 0, y: yValues[index] ?? 0, label: row.label })),
  };
}

export function validateCustomDataset(draft: CustomDatasetDraft): string | null {
  if (draft.features.length < 2 || draft.features.some((name) => !name.trim())) return "특징 이름을 두 개 이상 적어 주세요.";
  if (!draft.classes[0].trim() || !draft.classes[1].trim()) return "두 클래스의 이름을 모두 적어 주세요.";
  if (draft.rows.length < 4) return "사례를 네 개 이상 입력해 주세요.";
  if (!draft.rows.some((row) => row.label === 0) || !draft.rows.some((row) => row.label === 1)) return "두 클래스의 사례를 모두 입력해 주세요.";
  if (draft.rows.some((row) => row.values.length !== draft.features.length || row.values.some((value) => !Number.isFinite(value)))) return "모든 사례의 특징값을 숫자로 입력해 주세요.";
  if (draft.xFeature === draft.yFeature) return "가로와 세로에는 서로 다른 특징을 골라 주세요.";
  return null;
}

export function centroidAccuracy(points: DataPoint[]): number {
  if (!points.length) return 0;
  const centers = ([0, 1] as const).map((label) => {
    const members = points.filter((point) => point.label === label);
    return members.length ? { x: members.reduce((sum, point) => sum + point.x, 0) / members.length, y: members.reduce((sum, point) => sum + point.y, 0) / members.length } : { x: 0, y: 0 };
  });
  const correct = points.filter((point) => {
    const distances = centers.map((center) => (point.x - center.x) ** 2 + (point.y - center.y) ** 2);
    return (distances[1]! < distances[0]! ? 1 : 0) === point.label;
  }).length;
  return correct / points.length;
}
