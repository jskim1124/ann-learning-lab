import type { DataPoint, MediaKind, PresetName } from "../types";

export interface DatasetPreset {
  title: string;
  description: string;
  story: string;
  question: string;
  axes: [string, string];
  classes: [string, string];
  difficulty: string;
  sourceNote: string;
  mediaKind: MediaKind;
  recommendedHiddenUnits: number;
  points: DataPoint[];
}

export const PRESETS: Record<PresetName, DatasetPreset> = {
  sound: {
    title: "박수일까, 책상 소리일까?",
    description: "녹음한 소리의 오르내리는 파형 전체를 보고 두 소리를 비교합니다.",
    story: "교실에서 난 짧은 소리가 박수인지 책상을 톡 친 소리인지 컴퓨터가 알아맞힐 수 있을까요? 녹음하면 소리가 시간에 따라 오르내리는 긴 선으로 나타납니다. 치는 세기와 마이크 거리가 매번 달라서 똑같은 모양은 하나도 없습니다.",
    question: "소리 파형을 잘게 나누어 함께 보면 처음 듣는 소리도 구별할 수 있을까요?",
    axes: ["소리가 이어진 시간: 짧음 → 김", "소리 느낌: 둔함 → 날카로움"],
    classes: ["책상 소리", "박수"], difficulty: "파형으로 보기", sourceNote: "원래 소리는 시간에 따라 달라지는 수십 개의 높이입니다. 원자료 전체를 쓰는 모델은 한 장의 평면에 그릴 수 없어, 이 수업에서는 두 힌트를 배우는 작은 모델로 구분선 원리를 설명합니다.", mediaKind: "sound", recommendedHiddenUnits: 2,
    points: [
      { x: -.86, y: -.64, label: 0 }, { x: -.78, y: -.34, label: 0 }, { x: -.69, y: -.05, label: 0 }, { x: -.58, y: -.48, label: 0 },
      { x: -.46, y: .17, label: 0 }, { x: -.34, y: -.16, label: 0 }, { x: -.22, y: .38, label: 0 }, { x: -.12, y: -.28, label: 0 },
      { x: .02, y: .09, label: 0 }, { x: .18, y: -.06, label: 0 }, { x: -.03, y: .49, label: 0 }, { x: .29, y: .23, label: 0 },
      { x: -.41, y: .63, label: 1 }, { x: -.25, y: .82, label: 1 }, { x: -.08, y: .58, label: 1 }, { x: .06, y: .76, label: 1 },
      { x: .19, y: .42, label: 1 }, { x: .28, y: .69, label: 1 }, { x: .39, y: .18, label: 1 }, { x: .48, y: .51, label: 1 },
      { x: .58, y: .04, label: 1 }, { x: .66, y: .34, label: 1 }, { x: .77, y: -.12, label: 1 }, { x: .86, y: .21, label: 1 },
    ],
  },
  sketch: {
    title: "급히 그린 ○일까, △일까?",
    description: "두 숫자를 넣지 않고, 그림을 이루는 여러 칸을 한꺼번에 살펴봅니다.",
    story: "친구들이 칠판에 급히 그린 동그라미와 세모는 크기와 기울기가 모두 다릅니다. 컴퓨터는 이름표가 붙은 그림을 여러 장 보면서, 어느 칸이 자주 칠해지는지 비교해 처음 보는 낙서를 구별할 수 있습니다.",
    question: "컴퓨터가 그림 전체를 보고 삐뚤어진 ○와 △도 구별할 수 있을까요?",
    axes: ["설명 지도: 둥근 흔적이 적음 → 많음", "설명 지도: 위쪽 꼭짓점이 흐림 → 뚜렷함"],
    classes: ["동그라미", "세모"], difficulty: "픽셀로 보기", sourceNote: "원래 입력은 8×8 그림의 64칸입니다. 64칸을 모두 쓰는 모델의 경계는 평면에 그릴 수 없어, 이 수업에서는 두 힌트를 배우는 작은 모델로 원리를 설명합니다.", mediaKind: "sketch", recommendedHiddenUnits: 4,
    points: [
      { x: .72, y: -.64, label: 0 }, { x: .48, y: -.42, label: 0 }, { x: .83, y: -.21, label: 0 }, { x: .31, y: -.72, label: 0 },
      { x: .59, y: .02, label: 0 }, { x: .91, y: .18, label: 0 }, { x: .18, y: -.18, label: 0 }, { x: .41, y: .31, label: 0 },
      { x: .05, y: -.51, label: 0 }, { x: .67, y: .47, label: 0 }, { x: -.63, y: .74, label: 1 }, { x: -.36, y: .62, label: 1 },
      { x: -.78, y: .35, label: 1 }, { x: -.22, y: .86, label: 1 }, { x: -.54, y: .18, label: 1 }, { x: -.89, y: -.02, label: 1 },
      { x: -.17, y: .37, label: 1 }, { x: -.43, y: -.31, label: 1 }, { x: .02, y: .58, label: 1 }, { x: -.68, y: -.48, label: 1 },
      { x: .12, y: .22, label: 0 }, { x: -.08, y: .08, label: 1 },
    ],
  },
  digits: {
    title: "내가 그린 숫자를 읽을까?",
    description: "14×14 그림의 196개 칸을 실제 입력으로 써서 0·1·2를 구별합니다.",
    story: "종이에 쓴 숫자는 크기와 기울기, 선 굵기가 모두 다릅니다. 그림을 두 가지 말로 줄이지 않고 14×14칸의 밝기 196개를 그대로 신경망에 보여 줍니다.",
    question: "처음 보는 손글씨 0·1·2를 그림 전체로 구별할 수 있을까요?",
    axes: ["픽셀 가로 위치", "픽셀 세로 위치"],
    classes: ["숫자 그림", "숫자 그림"], difficulty: "그림 직접 학습", sourceNote: "실제 입력은 14×14 그림의 밝기 196개입니다.", mediaKind: "digits", recommendedHiddenUnits: 4,
    points: [
      { x: .78, y: -.51, label: 0 }, { x: .63, y: -.18, label: 0 }, { x: .41, y: -.63, label: 0 }, { x: .86, y: .06, label: 0 },
      { x: .25, y: -.29, label: 0 }, { x: .54, y: .25, label: 0 }, { x: .09, y: -.48, label: 0 }, { x: .34, y: .48, label: 0 },
      { x: .7, y: .56, label: 0 }, { x: -.68, y: .62, label: 1 }, { x: -.46, y: .81, label: 1 }, { x: -.82, y: .28, label: 1 },
      { x: -.24, y: .53, label: 1 }, { x: -.57, y: .09, label: 1 }, { x: -.9, y: -.17, label: 1 }, { x: -.31, y: -.36, label: 1 },
      { x: -.08, y: .22, label: 1 }, { x: -.72, y: -.58, label: 1 }, { x: .04, y: .64, label: 1 }, { x: .16, y: .08, label: 0 },
    ],
  },
  omr: {
    title: "OMR 답을 읽을 수 있을까?",
    description: "한 문항 그림의 196개 칸을 보고 ①~⑤ 가운데 칠한 답을 찾습니다.",
    story: "연필로 칠한 OMR 표시는 위치가 조금씩 비뚤고 진하기도 다릅니다. 한 문항 그림 전체를 14×14칸으로 바꾸어 신경망에 보여 줍니다.",
    question: "비뚤게 칠한 OMR 표시도 그림 전체를 보고 읽을 수 있을까요?",
    axes: ["픽셀 가로 위치", "픽셀 세로 위치"], classes: ["OMR", "OMR"], difficulty: "5가지 그림 분류", sourceNote: "실제 입력은 한 문항 그림의 밝기 196개입니다.", mediaKind: "omr", recommendedHiddenUnits: 4, points: [],
  },
  shot: {
    title: "자유투가 들어갈까?",
    description: "공을 놓는 각도와 힘이 성공에 어떤 모양으로 함께 영향을 주는지 살펴봅니다.",
    story: "체육 시간 자유투에서 힘이 세기만 해도, 각도가 높기만 해도 골이 되지는 않습니다. 알맞은 조합이 있고, 비슷하게 던져도 회전과 좌우 방향 때문에 결과가 달라질 수 있습니다. 여러 번 던진 기록으로 성공하기 쉬운 영역을 찾아봅시다.",
    question: "각도와 힘만 보고 다음 자유투의 성공 가능성을 어느 정도 예상할 수 있을까요?",
    axes: ["공을 놓는 힘: 약함 → 강함", "공을 놓는 각도: 낮음 → 높음"],
    classes: ["빗나감", "골인"], difficulty: "이전 자료", sourceNote: "이전 버전 호환용 자료입니다.", mediaKind: "points", recommendedHiddenUnits: 4,
    points: [
      { x: -.9, y: -.8, label: 0 }, { x: -.82, y: -.25, label: 0 }, { x: -.78, y: .38, label: 0 }, { x: -.66, y: .8, label: 0 },
      { x: .88, y: -.76, label: 0 }, { x: .82, y: -.18, label: 0 }, { x: .76, y: .35, label: 0 }, { x: .68, y: .82, label: 0 },
      { x: -.42, y: .72, label: 0 }, { x: -.06, y: .83, label: 0 }, { x: .36, y: .7, label: 0 }, { x: .03, y: .52, label: 0 },
      { x: -.46, y: -.65, label: 1 }, { x: -.28, y: -.38, label: 1 }, { x: -.34, y: -.05, label: 1 }, { x: -.12, y: .18, label: 1 },
      { x: .12, y: -.72, label: 1 }, { x: .28, y: -.43, label: 1 }, { x: .39, y: -.08, label: 1 }, { x: .31, y: .24, label: 1 },
      { x: -.05, y: -.22, label: 1 }, { x: .04, y: .08, label: 1 }, { x: -.2, y: .08, label: 0 }, { x: .35, y: .18, label: 0 },
    ],
  },
  plane: {
    title: "어떤 종이비행기가 멀리 갈까?",
    description: "앞쪽 무게와 날개 각도 사이의 알맞은 조합을 비행 기록에서 찾습니다.",
    story: "종이비행기 앞을 무겁게 하면 곧게 갈 수 있지만 너무 무거우면 금방 떨어집니다. 날개를 접는 각도도 너무 작거나 크면 불리합니다. 바람과 던지는 방향까지 매번 달라서 정확한 한 줄 규칙은 만들기 어렵습니다.",
    question: "두 가지 설계값만으로 5m를 넘기기 쉬운 종이비행기를 찾을 수 있을까요?",
    axes: ["앞쪽 무게: 가벼움 → 무거움", "날개 접는 각도: 작음 → 큼"],
    classes: ["5m 미만", "5m 이상"], difficulty: "이전 자료", sourceNote: "이전 버전 호환용 자료입니다.", mediaKind: "points", recommendedHiddenUnits: 4,
    points: [
      { x: -.9, y: -.8, label: 0 }, { x: -.82, y: -.25, label: 0 }, { x: -.78, y: .38, label: 0 }, { x: -.66, y: .8, label: 0 },
      { x: .88, y: -.76, label: 0 }, { x: .82, y: -.18, label: 0 }, { x: .76, y: .35, label: 0 }, { x: .68, y: .82, label: 0 },
      { x: -.42, y: .72, label: 0 }, { x: -.06, y: .83, label: 0 }, { x: .36, y: .7, label: 0 }, { x: .03, y: .52, label: 0 },
      { x: -.46, y: -.65, label: 1 }, { x: -.28, y: -.38, label: 1 }, { x: -.34, y: -.05, label: 1 }, { x: -.12, y: .18, label: 1 },
      { x: .12, y: -.72, label: 1 }, { x: .28, y: -.43, label: 1 }, { x: .39, y: -.08, label: 1 }, { x: .31, y: .24, label: 1 },
      { x: -.05, y: -.22, label: 1 }, { x: .04, y: .08, label: 1 },
    ],
  },
  xor: {
    title: "복도 양쪽 스위치와 전등",
    description: "복도 양쪽 끝의 스위치로 전등 하나를 켜고 끄는 상황",
    story: "우리 학교 긴 복도에는 양쪽 끝에 스위치가 하나씩 있습니다. 두 스위치의 방향이 서로 다를 때 전등이 켜집니다. 어느 한쪽 스위치만 보고는 전등 상태를 맞힐 수 없습니다.",
    question: "두 스위치의 방향을 보고 전등이 켜질지 맞힐 수 있을까요?",
    axes: ["교실 쪽 스위치", "계단 쪽 스위치"], classes: ["전등 꺼짐", "전등 켜짐"], difficulty: "이전 자료", sourceNote: "이전 버전 호환용 자료입니다.", mediaKind: "points", recommendedHiddenUnits: 2,
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
    axes: ["보안경 준비", "머리·옷 정리"], classes: ["잠시 멈춤", "실험 시작"], difficulty: "이전 자료", sourceNote: "이전 버전 호환용 자료입니다.", mediaKind: "points", recommendedHiddenUnits: 1,
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
    axes: ["밝기: 어두움 → 눈부심", "소음: 조용함 → 시끄러움"], classes: ["집중 어려움", "집중 잘됨"], difficulty: "이전 자료", sourceNote: "이전 버전 호환용 자료입니다.", mediaKind: "points", recommendedHiddenUnits: 4,
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
    axes: ["가로 힌트", "세로 힌트"], classes: ["파란 결과", "주황 결과"], difficulty: "직접 만들기", sourceNote: "직접 관찰한 자료인지, 연습용으로 만든 자료인지 기록해 두세요.", mediaKind: "points", recommendedHiddenUnits: 3,
    points: [],
  },
};

export function clonePreset(name: PresetName): DataPoint[] {
  return PRESETS[name].points.map((point) => ({ ...point }));
}
