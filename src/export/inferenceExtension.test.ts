import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { forwardPixels, initializePixelModel, trainPixelModel } from "../core/pixelNetwork";
import { generateInferenceExtension } from "./inferenceExtension";
import { createPixelDataset } from "../data/pixelDatasets";

function load(source:string){let extension:any;const runtime={on:vi.fn()};runInNewContext(source,{Scratch:{extensions:{unsandboxed:true,register:(e:any)=>extension=e},BlockType:{COMMAND:"command",REPORTER:"reporter",BOOLEAN:"boolean",HAT:"hat"},ArgumentType:{NUMBER:"number",STRING:"string"},vm:{runtime}},console,setInterval,clearInterval});return extension;}
describe("추론 전용 Scratch 호환 확장",()=>{
  it("학습 전에는 내보내지 않는다",()=>expect(()=>generateInferenceExtension(initializePixelModel(196,3,3),["0","1","2"])).toThrow());
  it.each(["tanh","sigmoid","relu"] as const)("%s 모델의 라벨과 모든 클래스 점수가 원본과 일치한다",activation=>{
    const data=createPixelDataset("digits"),model=trainPixelModel(initializePixelModel(196,4,3,31,activation),data,5,.12),source=generateInferenceExtension(model,["0","1","2"]),extension=load(source);
    for(const row of data.slice(0,8)){extension.classify(row.pixels);const probabilities=forwardPixels(model,row.pixels).probabilities;probabilities.forEach((v,i)=>expect(extension.confidence({LABEL:String(i)})).toBeCloseTo(v,12));expect(extension.label()).toBe(String(probabilities.indexOf(Math.max(...probabilities))));}
    expect(extension.getInfo().blocks.some((b:any)=>/학습|train/i.test(b.text))).toBe(false);expect(source).not.toContain('fetch(');expect(source).not.toContain('"data":');
    expect(extension.getInfo().blocks.map((b:any)=>b.opcode)).toContain("whenLabel");
    extension.setThreshold({VALUE:1});expect(extension.detected({LABEL:extension.label()})).toBe(false);
    extension.stop();expect(extension.label()).toBe("아직 분류하지 않음");
  });
  it("숫자는 수집 당시 축·범위를 담아 원래 단위에서 자동 변환한다",()=>{
    const model=initializePixelModel(2,3,2);model.epoch=3;const extension=load(generateInferenceExtension(model,["A","B"],{kind:"numbers",axes:[2,0],featureCount:3,ranges:[[0,20],[10,30]]}));
    extension.classifyRaw({VALUE:"20, 500, 5"});const p=forwardPixels(model,[-.45,0]).probabilities;
    expect(extension.confidence({LABEL:"A"})).toBeCloseTo(p[0]!,12);
    extension.classifyRaw({VALUE:"20, , 5"});expect(extension.detected({LABEL:"A"})).toBe(false);expect(extension.state()).toContain("숫자");
  });
  it("텍스트의 공백·비율 처리가 앱과 같고 재학습 블록이 없다",()=>{
    const model=initializePixelModel(2,3,2);model.epoch=1;const extension=load(generateInferenceExtension(model,["A","B"],{kind:"text",axes:[0,3],featureCount:4,ranges:[[0,10],[0,100]]}));
    extension.classifyRaw({VALUE:"가나 12"});const p=forwardPixels(model,[-.18,0]).probabilities;
    expect(extension.confidence({LABEL:"A"})).toBeCloseTo(p[0]!,12);
    expect(extension.getInfo().blocks.some((b:any)=>b.opcode==="camera")).toBe(false);
  });
});
