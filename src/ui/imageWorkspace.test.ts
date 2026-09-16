import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ImageWorkspace } from "./imageWorkspace";

const { capture } = vi.hoisted(() => ({ capture: vi.fn(() => ({ pixels: Array<number>(196).fill(.3), image: "data:image/jpeg;base64,test" })) }));
vi.mock("../core/imageInput", async (original) => ({ ...await original<typeof import("../core/imageInput")>(), captureImage: capture, drawImagePixels: vi.fn() }));

describe("공통 이미지 UI 연결", () => {
  let workspace: ImageWorkspace;
  const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
  beforeEach(() => {
    document.body.innerHTML = readFileSync("index.html", "utf8");
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({ fillRect: vi.fn(), strokeRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    workspace = new ImageWorkspace(vi.fn(), vi.fn(), vi.fn());
  });
  afterEach(() => { workspace.show(false,1); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
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
  it("그림·정답 클래스·모델 입력을 재계산 없이 그대로 추가한다", () => {
    workspace.configure("digits"); workspace.show(true,2);
    const input = Array.from({length:196}, (_, i) => i/195);
    workspace.store.selectClass(2); workspace.store.setInput(input,undefined,"drawing");
    button("imageCaptureAdd").click();
    expect(workspace.store.snapshot.data[0]).toMatchObject({pixels:input,label:2,source:"drawing"});
    expect(workspace.store.snapshot.input).toEqual(input);
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
});
