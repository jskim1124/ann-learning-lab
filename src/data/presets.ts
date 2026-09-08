import type { DataPoint, PresetName } from "../types";

export interface DatasetPreset {
  title: string;
  description: string;
  points: DataPoint[];
}

export const PRESETS: Record<PresetName, DatasetPreset> = {
  xor: {
    title: "양쪽 스위치와 전등 · XOR",
    description: "두 스위치의 상태가 다를 때만 전등이 켜지는 패턴입니다.",
    points: [
      { x: -0.86, y: -0.82, label: 0 }, { x: -0.66, y: -0.58, label: 0 }, { x: -0.48, y: -0.76, label: 0 },
      { x: 0.86, y: 0.82, label: 0 }, { x: 0.64, y: 0.56, label: 0 }, { x: 0.47, y: 0.78, label: 0 },
      { x: -0.84, y: 0.81, label: 1 }, { x: -0.62, y: 0.56, label: 1 }, { x: -0.46, y: 0.77, label: 1 },
      { x: 0.84, y: -0.81, label: 1 }, { x: 0.63, y: -0.56, label: 1 }, { x: 0.45, y: -0.76, label: 1 },
    ],
  },
  and: {
    title: "안전장치 이중 확인 · AND",
    description: "두 안전 조건이 모두 충족될 때만 장치가 작동하는 패턴입니다.",
    points: [
      { x: -0.84, y: -0.81, label: 0 }, { x: -0.62, y: -0.56, label: 0 },
      { x: -0.8, y: 0.79, label: 0 }, { x: -0.56, y: 0.55, label: 0 },
      { x: 0.82, y: -0.78, label: 0 }, { x: 0.58, y: -0.54, label: 0 },
      { x: 0.83, y: 0.81, label: 1 }, { x: 0.62, y: 0.56, label: 1 }, { x: 0.46, y: 0.76, label: 1 },
    ],
  },
  custom: {
    title: "빈 화면에서 직접 만들기",
    description: "두 범주의 점을 직접 배치해 신경망이 어떤 경계를 만드는지 관찰합니다.",
    points: [],
  },
};

export function clonePreset(name: PresetName): DataPoint[] {
  return PRESETS[name].points.map((point) => ({ ...point }));
}
