import type { NetworkModel } from "../types";
import { PALETTE } from "./canvasUtils";
import { NEURON_COLORS } from "./neuronColors";

export function networkGraphMarkup(model: NetworkModel, activations: number[], inputs?:[number,number]): string {
  const inputX = 38; const hiddenX = 165; const outputX = 292;
  const hiddenYs = Array.from({ length: model.config.hiddenUnits }, (_, index) => 24 + ((index + 0.5) / model.config.hiddenUnits) * 182);
  const lines: string[] = [];
  const nodes: string[] = [];
  const weightLine = (x1: number, y1: number, x2: number, y2: number, weight: number, label: string) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${weight >= 0 ? PALETTE.positive : PALETTE.negative}" stroke-width="${Math.min(7, 1 + Math.abs(weight) * 3)}"><title>${label}: ${weight.toFixed(5)}</title></line>`;
  hiddenYs.forEach((y, h) => {
    const pair = model.parameters.inputHidden[h] ?? [0, 0];
    lines.push(weightLine(inputX, 76, hiddenX, y, pair[0], `가로값 → 은닉 뉴런 ${h + 1}`));
    lines.push(weightLine(inputX, 154, hiddenX, y, pair[1], `세로값 → 은닉 뉴런 ${h + 1}`));
    lines.push(weightLine(hiddenX, y, outputX, 115, model.parameters.hiddenOutput[h] ?? 0, `은닉 뉴런 ${h + 1} → 결과`));
    const activation = activations[h] ?? 0;
    const intensity = Math.min(1, Math.abs(activation));
    const color = NEURON_COLORS[h % NEURON_COLORS.length];
    nodes.push(`<g class="network-node" data-kind="hidden"><circle cx="${hiddenX}" cy="${y}" r="15" style="fill:${color};fill-opacity:${0.12 + intensity * .45};stroke:${color};stroke-width:2"/><text x="${hiddenX}" y="${y + 4}">${h + 1}</text><text x="${hiddenX+38}" y="${y+4}" style="fill:${color};font-size:14px;paint-order:stroke;stroke:white;stroke-width:3px">${activation.toFixed(2)}</text><title>은닉 뉴런 ${h + 1}: ${activation.toFixed(5)}</title></g>`);
  });
  nodes.unshift(`<g class="network-node"><circle cx="${inputX}" cy="76" r="16"/><text x="${inputX}" y="80">가로</text>${inputs?`<text x="${inputX}" y="106">${inputs[0].toFixed(2)}</text>`:''}</g><g class="network-node"><circle cx="${inputX}" cy="154" r="16"/><text x="${inputX}" y="158">세로</text>${inputs?`<text x="${inputX}" y="184">${inputs[1].toFixed(2)}</text>`:''}</g>`);
  nodes.push(`<g class="network-node"><circle cx="${outputX}" cy="115" r="18"/><text x="${outputX}" y="119">답</text></g>`);
  return `<g class="network-lines">${lines.join("")}</g><g class="network-nodes">${nodes.join("")}</g>`;
}

export function hiddenNodeCount(markup: string): number {
  return (markup.match(/data-kind="hidden"/g) ?? []).length;
}
