import { describe, expect, it } from "vitest";
import { NEURON_PROBES, neuronCalculation, neuronLessonModel } from "./neuronLesson";

describe("하나의 계산기로 두 선을 이해하는 예제",()=>{
  it("곱한 두 값과 더해주는 값의 합을 실제 뉴런에 보낸다",()=>{
    const r=neuronCalculation(neuronLessonModel(),NEURON_PROBES.input!.point);
    expect(r.terms).toEqual([.2,.1]);expect(r.sum).toBeCloseTo(.3);
    expect(r.hidden[0]).toBeCloseTo(.3);expect(r.logits[0]).toBeCloseTo(.7);expect(r.logits[1]).toBeCloseTo(.3);
    expect(r.probabilities[1]).not.toBeCloseTo(.3);
  });
  it.each(["purple1","purple2","purple3"])("%s는 합 0이지만 A/B의 동점 경계가 아니다",key=>{
    const r=neuronCalculation(neuronLessonModel(),NEURON_PROBES[key]!.point);
    expect(r.sum).toBeCloseTo(0);expect(r.hidden[0]).toBe(0);
    expect(r.logits).toEqual([1,0]);
  });
  it.each(["black1","black2","black3","tie"])("%s는 출력 동점이며 뉴런 합은 0.5이다",key=>{
    const r=neuronCalculation(neuronLessonModel(),NEURON_PROBES[key]!.point);
    expect(r.sum).toBeCloseTo(.5);expect(r.logits).toEqual([.5,.5]);
    expect(r.probabilities).toEqual([.5,.5]);
  });
  it("검은 경계 양쪽에서 예상 답이 바뀐다",()=>{
    const model=neuronLessonModel(),a=neuronCalculation(model,NEURON_PROBES.sideA!.point),b=neuronCalculation(model,NEURON_PROBES.sideB!.point);
    expect(a.logits[0]).toBeGreaterThan(a.logits[1]!);expect(b.logits[1]).toBeGreaterThan(b.logits[0]!);
    const negative=neuronCalculation(model,[-1,0]);expect(negative.sum).toBe(-1);expect(negative.hidden[0]).toBe(0);
  });
});
