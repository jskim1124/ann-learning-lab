import { describe, expect, it } from "vitest";
import { ImageLabStore } from "./imageLabStore";
import { FeatureLabStore } from "./featureLabStore";
import { LabStore } from "./labStore";

describe("연습 시작과 학습 기록",()=>{
  it.each(["digits","omr","webcam"] as const)("%s는 은닉 1개로 시작해도 클래스 출력은 유지한다",task=>{
    const store=new ImageLabStore(task);
    expect(store.snapshot.model.hiddenUnits).toBe(1);
    expect(store.snapshot.model.classCount).toBe(store.snapshot.classes.length);
    if(task!=="webcam"){
      expect(store.snapshot.history[0]!.accuracy).toBe(store.metrics().accuracy);
      store.train(2);expect(store.snapshot.history.at(-1)!.accuracy).toBe(store.metrics().accuracy);
    }
  });
  it("자율 모델도 은닉 1개로 시작한다",()=>expect(new FeatureLabStore().snapshot.model.hiddenUnits).toBe(1));
  it("승부차기는 이해에서 뉴런을 늘려도 첫 연습은 1개다",()=>{
    const store=new LabStore();store.setConfig({hiddenUnits:4});store.beginPractice();
    expect(store.snapshot.model.config.hiddenUnits).toBe(1);
    expect(store.snapshot.history[0]!.accuracy).toBeDefined();
  });
});
