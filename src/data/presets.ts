import type { DataPoint, PresetName } from "../types";

export interface DatasetPreset {
  title: string;
  description: string;
  story: string;
  question: string;
  axes: [string, string];
  classes: [string, string];
  difficulty: string;
  recommendedHiddenUnits: number;
  points: DataPoint[];
}

export const PRESETS: Record<PresetName, DatasetPreset> = {
  xor: {
    title: "복도 양쪽 스위치와 전등",
    description: "복도 양쪽 끝의 스위치로 전등 하나를 켜고 끄는 상황",
    story: "우리 학교 긴 복도에는 양쪽 끝에 스위치가 하나씩 있습니다. 두 스위치의 방향이 서로 다를 때 전등이 켜집니다. 어느 한쪽 스위치만 보고는 전등 상태를 맞힐 수 없습니다.",
    question: "두 스위치의 방향을 보고 전등이 켜질지 맞힐 수 있을까요?",
    axes: ["교실 쪽 스위치", "계단 쪽 스위치"], classes: ["전등 꺼짐", "전등 켜짐"], difficulty: "생각 열기", recommendedHiddenUnits: 2,
    points: [
      { x: -0.86, y: -0.82, label: 0 }, { x: -0.66, y: -0.58, label: 0 }, { x: -0.48, y: -0.76, label: 0 },
      { x: 0.86, y: 0.82, label: 0 }, { x: 0.64, y: 0.56, label: 0 }, { x: 0.47, y: 0.78, label: 0 },
      { x: -0.84, y: 0.81, label: 1 }, { x: -0.62, y: 0.56, label: 1 }, { x: -0.46, y: 0.77, label: 1 },
      { x: 0.84, y: -0.81, label: 1 }, { x: 0.63, y: -0.56, label: 1 }, { x: 0.45, y: -0.76, label: 1 },
    ],
  },
  and: {
    title: "과학실 안전 준비 두 가지",
    description: "과학실 실험 전에 두 가지 안전 준비를 확인하는 상황",
    story: "과학실에서 가열 실험을 시작하려면 보안경을 쓰고 긴 머리도 묶어야 합니다. 둘 중 하나라도 준비되지 않으면 선생님은 실험을 시작하지 않습니다.",
    question: "두 준비 상태를 보고 실험을 시작해도 되는지 맞힐 수 있을까요?",
    axes: ["보안경 준비", "머리·옷 정리"], classes: ["잠시 멈춤", "실험 시작"], difficulty: "첫 연습", recommendedHiddenUnits: 1,
    points: [
      { x: -0.84, y: -0.81, label: 0 }, { x: -0.62, y: -0.56, label: 0 },
      { x: -0.8, y: 0.79, label: 0 }, { x: -0.56, y: 0.55, label: 0 },
      { x: 0.82, y: -0.78, label: 0 }, { x: 0.58, y: -0.54, label: 0 },
      { x: 0.83, y: 0.81, label: 1 }, { x: 0.62, y: 0.56, label: 1 }, { x: 0.46, y: 0.76, label: 1 },
    ],
  },
  focus: {
    title: "도서관 집중 자리 찾기",
    description: "밝기와 소음이 알맞은 자리를 여러 기준으로 찾는 상황",
    story: "학교 도서관의 자리는 창가에 가까울수록 밝지만 너무 밝으면 눈이 부십니다. 복도에 가까우면 소음도 커집니다. 밝기가 너무 어둡지도 눈부시지도 않고, 소음도 크지 않은 자리에서 학생들이 집중이 잘됐다고 답했습니다.",
    question: "밝기와 소음을 보고 집중하기 좋은 자리를 찾아낼 수 있을까요?",
    axes: ["밝기: 어두움 → 눈부심", "소음: 조용함 → 시끄러움"], classes: ["집중 어려움", "집중 잘됨"], difficulty: "도전 문제", recommendedHiddenUnits: 4,
    points: [
      { x: -.9, y: -.8, label: 0 }, { x: -.82, y: -.25, label: 0 }, { x: -.78, y: .38, label: 0 }, { x: -.66, y: .8, label: 0 },
      { x: .88, y: -.76, label: 0 }, { x: .82, y: -.18, label: 0 }, { x: .76, y: .35, label: 0 }, { x: .68, y: .82, label: 0 },
      { x: -.42, y: .72, label: 0 }, { x: -.06, y: .83, label: 0 }, { x: .36, y: .7, label: 0 }, { x: .03, y: .52, label: 0 },
      { x: -.46, y: -.65, label: 1 }, { x: -.28, y: -.38, label: 1 }, { x: -.34, y: -.05, label: 1 }, { x: -.12, y: .18, label: 1 },
      { x: .12, y: -.72, label: 1 }, { x: .28, y: -.43, label: 1 }, { x: .39, y: -.08, label: 1 }, { x: .31, y: .24, label: 1 },
      { x: -.05, y: -.22, label: 1 }, { x: .04, y: .08, label: 1 },
    ],
  },
  custom: {
    title: "빈 화면에서 직접 만들기",
    description: "두 범주의 점을 직접 배치해 신경망이 어떤 경계를 만드는지 관찰합니다.",
    story: "두 가지 결과가 나오는 나만의 학교생활 문제를 정해 보세요. 가로축과 세로축에 영향을 줄 것 두 가지를 놓고, 관찰한 결과를 점으로 표시합니다.",
    question: "내가 만든 점들의 규칙을 모델이 찾아낼 수 있을까요?",
    axes: ["조건 A", "조건 B"], classes: ["결과 0", "결과 1"], difficulty: "직접 만들기", recommendedHiddenUnits: 3,
    points: [],
  },
};

export function clonePreset(name: PresetName): DataPoint[] {
  return PRESETS[name].points.map((point) => ({ ...point }));
}
