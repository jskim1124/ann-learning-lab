import type { NetworkModel } from "../types";
import { PALETTE } from "./canvasUtils";

export function networkGraphMarkup(model: NetworkModel, activations: number[]): string {
  const inputX = 38; const hiddenX = 165; const outputX = 292;
  const hiddenYs = Array.from({ length: model.config.hiddenUnits }, (_, index) => 24 + ((index + 0.5) / model.config.hiddenUnits) * 182);
  const lines: string[] = [];
  const nodes: string[] = [];
  const weightLine = (x1: number, y1: number, x2: number, y2: number, weight: number, label: string) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${weight >= 0 ? PALETTE.positive : PALETTE.negative}" stroke-width="${Math.min(7, 1 + Math.abs(weight) * 3)}"><title>${label}: ${weight.toFixed(5)}</title></line>`;
  hiddenYs.forEach((y, h) => {
    const pair = model.parameters.inputHidden[h] ?? [0, 0];
    lines.push(weightLine(inputX, 76, hiddenX, y, pair[0], `A → H${h + 1}`));
    lines.push(weightLine(inputX, 154, hiddenX, y, pair[1], `B → H${h + 1}`));
    lines.push(weightLine(hiddenX, y, outputX, 115, model.parameters.hiddenOutput[h] ?? 0, `H${h + 1} → 출력`));
    const activation = activations[h] ?? 0;
    const intensity = Math.min(1, Math.abs(activation));
    nodes.push(`<g class="network-node" data-kind="hidden"><circle cx="${hiddenX}" cy="${y}" r="15" style="fill:rgba(35,103,213,${0.12 + intensity * 0.55})"/><text x="${hiddenX}" y="${y + 4}">${activation.toFixed(2)}</text><title>은닉 뉴런 ${h + 1}: ${activation.toFixed(5)}</title></g>`);
  });
  nodes.unshift(`<g class="network-node"><circle cx="${inputX}" cy="76" r="16"/><text x="${inputX}" y="80">A</text></g><g class="network-node"><circle cx="${inputX}" cy="154" r="16"/><text x="${inputX}" y="158">B</text></g>`);
  nodes.push(`<g class="network-node"><circle cx="${outputX}" cy="115" r="18"/><text x="${outputX}" y="119">P</text></g>`);
  return `<g class="network-lines">${lines.join("")}</g><g class="network-nodes">${nodes.join("")}</g>`;
}

export function hiddenNodeCount(markup: string): number {
  return (markup.match(/data-kind="hidden"/g) ?? []).length;
}

