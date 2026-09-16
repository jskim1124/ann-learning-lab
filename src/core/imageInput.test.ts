import { afterEach, describe, expect, it, vi } from "vitest";
import { captureImage, rgbaToPixels } from "./imageInput";

describe("그림 전처리", () => {
  afterEach(() => vi.restoreAllMocks());
  it("가로 영상을 찌그러뜨리지 않고 중앙 정사각형을 수집·예상에 똑같이 쓴다", () => {
    const video = document.createElement("video"); Object.defineProperties(video,{videoWidth:{value:640},videoHeight:{value:480}});
    const rgba = new Uint8ClampedArray(196*4); for(let i=0;i<196;i++)rgba.set([128,128,128,255],i*4);
    const ctx = {fillRect:vi.fn(),translate:vi.fn(),scale:vi.fn(),drawImage:vi.fn(),getImageData:vi.fn(() => ({data:rgba}))};
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype,"toDataURL").mockReturnValue("data:image/jpeg;base64,same");
    const collected = captureImage(video,true), predicted = captureImage(video,true);
    expect(ctx.drawImage).toHaveBeenCalledWith(video,80,0,480,480,0,0,224,224);
    expect(ctx.translate).toHaveBeenCalledWith(224,0); expect(ctx.scale).toHaveBeenCalledWith(-1,1);
    expect(collected.pixels).toHaveLength(196); expect(collected.pixels[0]).toBeCloseTo(127/255,12);
    expect(predicted).toEqual(collected);
  });
  it("임계값이나 굵게 칠하기 없이 검정·회색·흰색을 그대로 진하기로 바꾼다", () => {
    const values = rgbaToPixels(new Uint8ClampedArray([0,0,0,255,128,128,128,255,255,255,255,255,0,0,0,0]));
    expect(values[0]).toBe(1); expect(values[1]).toBeCloseTo(127/255, 12); expect(values[2]).toBeCloseTo(0, 12); expect(values[3]).toBe(0);
  });
  it("14×14 위치 순서와 모든 회색값을 보존한다", () => {
    const rgba = new Uint8ClampedArray(196*4);
    for (let i = 0; i < 196; i++) rgba.set([i,i,i,255],i*4);
    const result = rgbaToPixels(rgba);
    expect(result).toHaveLength(196); result.forEach((v,i) => expect(v).toBeCloseTo(1-i/255,12));
  });
});
