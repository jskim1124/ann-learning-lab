import { describe, expect, it, vi } from "vitest";
import { coordinatePosition, drawCoordinateGrid, drawCoordinateTicks } from "./coordinateGrid";

describe("원점 중심의 실제 좌표 눈금",()=>{
  const box={left:50,top:10,width:600,height:400};
  it("모델 좌표와 가로 세로 눈금의 위치가 일치한다",()=>{
    expect(coordinatePosition(box,0,0)).toEqual({x:350,y:210});
    expect(coordinatePosition(box,-.5,.5)).toEqual({x:200,y:110});
    expect(coordinatePosition(box,1,-1)).toEqual({x:650,y:410});
  });
  it("범위 화살표 대신 다섯 값과 원점 0을 직접 표시한다",()=>{
    const ctx={save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),fillRect:vi.fn(),fillText:vi.fn()} as unknown as CanvasRenderingContext2D;
    drawCoordinateGrid(ctx,box);drawCoordinateTicks(ctx,box);
    const labels=vi.mocked(ctx.fillText).mock.calls.map(c=>c[0]);
    expect(labels).toEqual(["-1.00","-1.00","-0.50","-0.50","0.00","0.50","0.50","1.00","1.00"]);
    expect(ctx.stroke).toHaveBeenCalledTimes(10);
  });
});
