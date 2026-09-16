import { createPixelProjection, projectionFromFeatures, type PixelAxisLegend, type PixelProjection } from "./pixelProjection";
import type { PixelExample } from "./pixelNetwork";

export interface ImageFeature { id: string; name: string; description: string; weights: number[]; }
export function imageFeatures(data: PixelExample[]): ImageFeature[] {
  const weights = (fn: (x: number, y: number) => number) => Array.from({ length: 196 }, (_, i) => fn(i % 14, Math.floor(i / 14)));
  const auto = createPixelProjection(data);
  return [
    { id: "lr", name: "오른쪽 − 왼쪽", description: "오른쪽 7열의 진하기 합에서 왼쪽 7열의 합을 뺍니다.", weights: weights(x => x >= 7 ? 1 : -1) },
    { id: "tb", name: "위 − 아래", description: "위쪽 7행의 진하기 합에서 아래쪽 7행의 합을 뺍니다.", weights: weights((_, y) => y < 7 ? 1 : -1) },
    { id: "ink", name: "전체 진하기", description: "196칸의 진하기를 모두 더합니다.", weights: weights(() => 1) },
    { id: "center", name: "가운데 진하기", description: "가운데 6×6칸(5~10행·열)의 진하기만 더합니다.", weights: weights((x, y) => x >= 4 && x < 10 && y >= 4 && y < 10 ? 1 : 0) },
    { id: "position", name: "열 번호 × 진하기 합", description: "각 칸의 진하기에 왼쪽부터 열 번호 1~14를 곱해 더합니다. 위치뿐 아니라 총 진하기도 영향을 줍니다.", weights: weights(x => x + 1) },
    { id: "auto1", name: "그림 차이 1", description: "정답 이름을 보지 않고, 그림들에서 차이가 큰 방향을 찾은 곱셈표입니다.", weights: auto.horizontal },
    { id: "auto2", name: "그림 차이 2", description: "첫 방향과 겹치지 않는 두 번째 차이의 곱셈표입니다. 잘 분류된다는 보장은 없습니다.", weights: auto.vertical },
  ];
}
export function featureScore(feature: ImageFeature, pixels: number[]) { return feature.weights.reduce((sum, w, i) => sum + w * (pixels[i] ?? 0), 0); }
export function featureCalculation(feature: ImageFeature, pixels: number[]) {
  const terms = feature.weights.map((weight, i) => ({ pixel: pixels[i] ?? 0, weight, product: weight * (pixels[i] ?? 0) }));
  return { terms, positive: terms.reduce((sum, t) => sum + Math.max(0, t.product), 0), negative: terms.reduce((sum, t) => sum + Math.min(0, t.product), 0), total: featureScore(feature, pixels) };
}
export function selectedImageProjection(data: PixelExample[], features: ImageFeature[], x: string, y: string): PixelProjection {
  return projectionFromFeatures(data, features.find(f => f.id === x)!.weights, features.find(f => f.id === y)!.weights);
}
export function imageFeatureLegend(features: ImageFeature[], x: string, y: string): PixelAxisLegend {
  const axis = (id: string) => ({ title: features.find(f => f.id === id)?.name ?? id, negative: "평균보다 작음", positive: "평균보다 큼" });
  // Coordinates are centered and scaled; zero is the training mean, not zero raw ink.
  return { horizontal: { ...axis(x), negative: "평균보다 작음", positive: "평균보다 큼" }, vertical: { ...axis(y), negative: "평균보다 작음", positive: "평균보다 큼" } };
}
