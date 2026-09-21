import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ImageWorkspace } from "./imageWorkspace";

const { capture } = vi.hoisted(() => ({ capture: vi.fn(() => ({ pixels: Array<number>(196).fill(.3), image: "data:image/jpeg;base64,test" })) }));
vi.mock("../core/imageInput", async (original) => ({ ...await original<typeof import("../core/imageInput")>(), captureImage: capture, drawImagePixels: vi.fn() }));
vi.mock("../visualization/pixelLatentMap", async original => ({...await original<typeof import("../visualization/pixelLatentMap")>(), drawPixelLatentMap:vi.fn()}));
vi.mock("../visualization/lossChart", () => ({drawLossChart:vi.fn()}));

describe("공통 이미지 UI 연결", () => {
  let workspace: ImageWorkspace;
  const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
  beforeEach(() => {
    document.body.innerHTML = readFileSync("index.html", "utf8");
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({ fillRect: vi.fn(), strokeRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    workspace = new ImageWorkspace(vi.fn(), vi.fn(), vi.fn());
  });
  afterEach(() => { workspace.show(false,1); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it.each(['digits','omr','webcam'] as const)('%s의 실제 화면이 같은 네 단계 이해 과정을 사용한다',task=>{
    workspace.configure(task);workspace.show(true,3);
    const root=document.querySelector('.understanding-journey:not([hidden])')!;
    expect([...root.querySelectorAll('.journey-nav button')].map(b=>b.textContent)).toEqual(['1 특징 계산','2 분포·선택','3 뉴런·선','4 뉴런·출력']);
    expect(root.querySelector('#flMap')).toBeNull();expect(root.querySelectorAll('[data-journey-cell]')).toHaveLength(4);
    expect(root.textContent).not.toContain('원리 설명');expect(root.textContent).not.toContain('직접 고치기');
  });
  it('연습 지표·선택 그림은 지도 쪽에, 연결 지도는 한 개만 남긴다',()=>{
    workspace.configure('omr');workspace.show(true,4);
    for(const id of ['imageHidden','imageEpoch','imageAccuracy','imageFocusName'])expect(document.getElementById(id)!.closest('.image-results-panel')).not.toBeNull();
    expect(document.getElementById('imageSignalNetwork')!.querySelectorAll('.network-overview')).toHaveLength(1);
    expect(document.getElementById('imageSignalNetwork')!.querySelector('.network-calculations')).toBeNull();
    expect(document.getElementById('imageNetwork')!.classList.contains('retired-network')).toBe(true);
  });
  it("웹캠에 특징 선택 표가 없고 클래스와 원본·실제 입력을 나란히 보여 준다", () => {
    workspace.configure("webcam"); workspace.show(true,2);
    expect(document.getElementById("imageInputSwitch")!.hidden).toBe(true);
    expect(document.getElementById("imageCameraEmpty")!.hidden).toBe(false);
    expect(document.getElementById("imageCameraStill")!.hidden).toBe(true);
    expect(button("imageCaptureAdd").disabled).toBe(true);
    expect(document.getElementById("imageClassList")!.textContent).toContain("가위");
  });
  it("웹캠 사진을 고른 뒤에도 카메라 모드로 돌아갈 수 있다", () => {
    workspace.configure("webcam"); workspace.show(true,2);
    workspace.store.setInput(Array(196).fill(.4),"data:image/jpeg;base64,captured","webcam"); workspace.store.addInput();
    document.querySelector<HTMLButtonElement>("[data-image-sample]")!.click();
    expect(button("imageCameraStart").hidden).toBe(false);
    expect(document.getElementById("imageDraw")!.hidden).toBe(true);
    expect(document.getElementById("imageCameraStill")!.hidden).toBe(false);
    expect(workspace.store.focus().pixels).toEqual(Array(196).fill(.4));
  });
  it("원래 그림은 그대로 저장하고 추가 후 입력만 빈 그림으로 초기화한다", () => {
    workspace.configure("digits"); workspace.show(true,2);
    const input = Array.from({length:196}, (_, i) => i/195);
    workspace.store.selectClass(2); workspace.store.setInput(input,undefined,"drawing");
    capture.mockReturnValueOnce({pixels:Array(196).fill(0),image:'data:image/jpeg;base64,empty'});
    button("imageCaptureAdd").click();
    expect(workspace.store.snapshot.data[0]).toMatchObject({pixels:input,label:2,source:"drawing"});
    expect(workspace.store.snapshot.input).toEqual(Array(196).fill(0));
    expect(workspace.store.snapshot.selectedClass).toBe(2);
    expect(workspace.store.snapshot.selectedSample).toBeNull();
  });
  it('추가 버튼의 클래스 선택은 그림을 지우지 않고 즉시 저장 대상을 바꾼다',()=>{
    workspace.configure('omr');workspace.show(true,2);
    const input=Array(196).fill(.7);workspace.store.setInput(input,undefined,'drawing');
    const select=document.getElementById('imageAddClass') as HTMLSelectElement;
    select.value='4';select.dispatchEvent(new Event('change'));
    expect(workspace.store.snapshot.input).toEqual(input);expect(button('imageCaptureAdd').textContent).toBe('⑤에 추가');
    button('imageCaptureAdd').click();expect(workspace.store.snapshot.data[0]).toMatchObject({label:4,pixels:input});
    expect(document.getElementById('imageClassList')!.textContent).toContain('⑤');
    workspace.store.renameClass(4,'선택 5');expect(select.options[4]!.text).toBe('선택 5');
    workspace.store.removeClass(0);expect(select.options).toHaveLength(4);expect(select.value).toBe('3');
  });
  it("카메라 권한 응답을 기다리다 페이지를 나가면 늦게 열린 트랙도 종료한다", async () => {
    let resolve!: (value: MediaStream) => void;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((r) => {resolve=r;}));
    vi.stubGlobal("navigator", {mediaDevices:{getUserMedia}});
    const stop = vi.fn(), stream = {getTracks:() => [{stop}]} as unknown as MediaStream;
    workspace.configure("webcam"); workspace.show(true,2); button("imageCameraStart").click();
    workspace.show(false,1); resolve(stream); await Promise.resolve(); await Promise.resolve();
    expect(stop).toHaveBeenCalledOnce(); vi.unstubAllGlobals();
  });
  it("웹캠 프레임을 자료·실시간 예상에 같은 픽셀로 전달하고 카메라를 종료한다", async () => {
    const stop = vi.fn(); const stream = {getTracks: () => [{stop}]} as unknown as MediaStream;
    vi.stubGlobal("navigator",{mediaDevices:{getUserMedia:vi.fn().mockResolvedValue(stream)}});
    vi.spyOn(HTMLMediaElement.prototype,"play").mockResolvedValue();
    let tick!: FrameRequestCallback;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {tick=callback;return 1;}));
    vi.stubGlobal("cancelAnimationFrame",vi.fn());
    const video = document.getElementById("imageVideo")!;
    Object.defineProperty(video,"readyState",{get:() => 2,configurable:true});
    workspace.configure("webcam"); workspace.show(true,2); button("imageCameraStart").click();
    await Promise.resolve(); await Promise.resolve(); tick(200);
    expect(button("imageCaptureAdd").disabled).toBe(false);
    button("imageCaptureAdd").click();
    expect(workspace.store.snapshot.data[0]).toMatchObject({source:"webcam", pixels:Array(196).fill(.3)});
    expect(workspace.store.snapshot.input).toEqual(workspace.store.snapshot.data[0]!.pixels);
    button("imageCameraStop").click(); expect(stop).toHaveBeenCalledOnce();
  });
  it("클래스를 추가한 직후 출력 개수와 자료 수집 버튼도 함께 바뀐다", () => {
    workspace.configure("digits"); workspace.show(true,2);
    const input = document.querySelector<HTMLInputElement>("#imageNewClass input")!; input.value="3";
    document.getElementById("imageNewClass")!.dispatchEvent(new Event("submit",{cancelable:true}));
    expect(workspace.store.snapshot.model.classCount).toBe(4);
    expect(button("imageCaptureAdd").textContent).toBe("3에 추가");
    expect(workspace.ready()).toContain("3");
  });
  it("연습 안에서 특징·좌표를 바꾸고 뉴런 수를 늘려도 연결 지도는 항상 보인다",()=>{
    workspace.configure("omr"); workspace.show(true,4);
    const network=document.getElementById("imageNetwork")!,old=workspace.store.snapshot.projection;
    expect(network.closest("details")!.hidden).toBe(false);expect(document.getElementById('imageSignalNetwork')!.closest('details')!.open).toBe(true);
    const x=document.getElementById("imagePracticeX") as HTMLSelectElement;x.value="lr";x.dispatchEvent(new Event("change"));
    expect(workspace.store.snapshot.xFeature).toBe("lr");expect(workspace.store.snapshot.projection).not.toBe(old);
    const hidden=document.getElementById("imageHidden") as HTMLInputElement;hidden.value="16";hidden.dispatchEvent(new Event("input"));
    expect(network.querySelectorAll('[data-kind="hidden"]')).toHaveLength(16);
    expect(network.closest("details")!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.image-workspace:has(#imageMap)')!.hidden).toBe(false);
  });
  it('확인점을 움직이면 계산이 바뀌되 자료·모델은 유지하며 가져가기는 열려 있다',()=>{
    workspace.configure('digits');workspace.show(true,4);
    const original=JSON.stringify(workspace.store.snapshot.data),model=JSON.stringify(workspace.store.snapshot.model);
    const canvas=document.getElementById('imageMap') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
    const before=document.querySelector('#imageSignalNetwork .answer-track>i')!.getAttribute('style');
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight'}));
    expect(document.querySelector('#imageSignalNetwork .answer-track>i')!.getAttribute('style')).not.toBe(before);
    expect(document.getElementById('imageFocusName')!.textContent).toContain('정답 미지정');
    expect(JSON.stringify(workspace.store.snapshot.data)).toBe(original);expect(JSON.stringify(workspace.store.snapshot.model)).toBe(model);
    const select=document.getElementById('imageTrainingClass') as HTMLSelectElement;select.value='2';select.dispatchEvent(new Event('change'));
    expect(document.getElementById('imageFocusName')!.textContent).toContain('정답 2');
    workspace.show(true,5);expect(document.getElementById('imageExportSb3')!.closest('details')!.open).toBe(true);
  });
  it("자유 드로잉은 진한 검정 붓으로 그리고 실제 픽셀을 미리보기·학습에 같이 사용한다",()=>{
    const ctx={fillRect:vi.fn(),strokeRect:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),strokeStyle:"",lineWidth:0};
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    workspace.configure("digits");workspace.show(true,2);
    const canvas=document.getElementById("imageDraw") as HTMLCanvasElement;canvas.setPointerCapture=vi.fn();
    vi.spyOn(canvas,"getBoundingClientRect").mockReturnValue({x:0,y:0,left:0,top:0,right:420,bottom:420,width:420,height:420,toJSON:()=>({})});
    canvas.dispatchEvent(new MouseEvent("pointerdown",{clientX:100,clientY:100}));
    expect(ctx.strokeStyle).toBe("#000000");expect(ctx.lineWidth).toBe(24);
    expect(workspace.store.snapshot.input).toEqual(capture.mock.results.at(-1)!.value.pixels);
  });
});
