import { describe, expect, it } from "vitest";
import { initializePixelModel } from "../core/pixelNetwork";
import { pixelNetworkGraphMarkup } from "./pixelNetworkGraph";
import { NEURON_COLORS } from "./neuronColors";

describe("그래프와 연결 지도의 뉴런",()=>{
  it("16개까지 생략하지 않고 같은 번호·색으로 표시한다",()=>{
    const markup=pixelNetworkGraphMarkup(initializePixelModel(2,16,3),["A","B","C"],[]);
    const root=document.createElement("div");root.innerHTML=`<svg>${markup}</svg>`;
    expect(root.querySelectorAll('[data-kind="hidden"]')).toHaveLength(16);
    root.querySelectorAll('[data-kind="hidden"] circle').forEach((node,i)=>expect(node.getAttribute("stroke")).toBe(NEURON_COLORS[i]));
    expect(markup).not.toContain("0%");
  });
});
