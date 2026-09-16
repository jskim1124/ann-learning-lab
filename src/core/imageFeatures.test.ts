import { describe, expect, it } from "vitest";
import { featureCalculation, featureScore, imageFeatures } from "./imageFeatures";
import { constrainPixelModelToProjection, projectPixels, projectionFromFeatures, reconstructProjectedPixels } from "./pixelProjection";
import { forwardPixels, initializePixelModel, trainPixelModel } from "./pixelNetwork";
import { ImageLabStore } from "../state/imageLabStore";
import { featureMovementExample } from "./featureLessonModel";
import { hiddenPlane, pixelHiddenLineValue } from "../visualization/pixelLatentMap";

describe("학생이 고른 특징과 실제 지도 계산",()=>{
  it("대표 칸의 곱과 더하기·빼기 합이 특징값과 일치한다",()=>{
    const pixels=Array<number>(196).fill(0);pixels[0]=.5;pixels[13]=1;pixels[195]=.25;
    const f=imageFeatures([]).find(f=>f.id==="lr")!,calc=featureCalculation(f,pixels);
    expect(calc.positive).toBe(1.25);expect(calc.negative).toBe(-.5);expect(calc.total).toBe(.75);
    expect(calc.terms.reduce((sum,t)=>sum+t.product,0)).toBe(featureScore(f,pixels));
  });
  it("겹치는 두 특징을 몰래 회전하지 않고 같은 원래 계산식을 유지한다",()=>{
    const data=[{pixels:[0,1,0],label:0},{pixels:[1,0,1],label:1},{pixels:[.2,.4,.8],label:0}];
    const p=projectionFromFeatures(data,[1,1,1],[0,1,0]);
    expect(p.horizontal).toEqual([1,1,1]);expect(p.vertical).toEqual([0,1,0]);
    const model=constrainPixelModelToProjection(initializePixelModel(3,3,2),p);
    for(const row of data){const point=projectPixels(p,row.pixels), reconstructed=reconstructProjectedPixels(p,point.x,point.y),again=projectPixels(p,reconstructed);
      expect(again.x).toBeCloseTo(point.x,12);expect(again.y).toBeCloseTo(point.y,12);
      forwardPixels(model,row.pixels).probabilities.forEach((v,i)=>expect(forwardPixels(model,reconstructed).probabilities[i]).toBeCloseTo(v,12));
      const plane=hiddenPlane(model,p,0);expect(plane.constant+point.x*plane.horizontal+point.y*plane.vertical).toBeCloseTo(pixelHiddenLineValue(model,row.pixels,0),12);
    }
  });
  it("동일하거나 배수인 축은 오류로 알리고 학습 상태를 보존한다",()=>{
    const store=new ImageLabStore("digits");store.train(2);const previous=store.snapshot;
    expect(store.setAxes("ink","ink")).not.toBeNull();expect(store.snapshot.model).toBe(previous.model);
    expect(store.addFeature("모든 칸",Array(196).fill(1))).toBeNull();expect(store.setAxes("ink","custom-7")).not.toBeNull();
  });
  it("학생이 만든 특징을 선택하면 새 좌표·모델에 반영하고 추가 자료 후에도 유지한다",()=>{
    const store=new ImageLabStore("omr");const mask=Array.from({length:196},(_,i)=>i%14<2?1:0);
    store.addFeature("첫 두 열",mask);expect(store.setAxes("custom-7","ink")).toBeNull();
    expect(store.snapshot.projection.horizontal).toEqual(mask);store.train(10);
    const s=store.snapshot;
    for(const row of s.data){const p=projectPixels(s.projection,row.pixels);
      forwardPixels(s.model,reconstructProjectedPixels(s.projection,p.x,p.y)).probabilities.forEach((v,i)=>expect(v).toBeCloseTo(forwardPixels(s.model,row.pixels).probabilities[i]!,10));}
    store.setInput(mask);store.addInput();expect(store.snapshot.features.find(f=>f.name==="첫 두 열")?.weights).toEqual(mask);expect(store.snapshot.model.epoch).toBe(0);
  });
  it.each(["digits","omr"] as const)("%s 대표선의 각 프레임은 실제 갱신이며 합과 정답 점수가 커진다",task=>{
    const s=new ImageLabStore(task).snapshot,lesson=featureMovementExample(s.data,s.projection,s.classes.length),before=lesson.frames[0]!,after=lesson.frames.at(-1)!;
    for(let i=1;i<lesson.frames.length;i++)expect(lesson.frames[i]).toEqual(constrainPixelModelToProjection(trainPixelModel(lesson.frames[i-1]!,[lesson.example],1,.025),s.projection));
    expect(pixelHiddenLineValue(before,lesson.example.pixels,0)).toBeCloseTo(-.4,10);
    expect(pixelHiddenLineValue(after,lesson.example.pixels,0)).toBeGreaterThan(0);
    expect(forwardPixels(after,lesson.example.pixels).probabilities[lesson.example.label]!).toBeGreaterThan(forwardPixels(before,lesson.example.pixels).probabilities[lesson.example.label]!);
  });
});
