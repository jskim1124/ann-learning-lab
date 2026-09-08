import type { DataPoint, Label } from "../types";

export function clampInput(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function addPoint(data: DataPoint[], x: number, y: number, label: Label): DataPoint[] {
  return [...data, { x: clampInput(x), y: clampInput(y), label }];
}

export function undoPoint(data: DataPoint[]): DataPoint[] {
  return data.slice(0, -1);
}

export function validateTrainingData(data: DataPoint[]): string | null {
  if (data.length === 0) return "먼저 두 범주의 데이터를 추가하세요.";
  const labels = new Set(data.map((point) => point.label));
  if (labels.size < 2) return "범주 0과 범주 1의 점을 모두 추가해야 학습할 수 있습니다.";
  return null;
}
