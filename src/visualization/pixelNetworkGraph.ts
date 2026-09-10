import type { PixelModel } from "../core/pixelNetwork";

const COLORS = ["#f17605", "#df466f", "#7446f5", "#1f6bd6", "#1558b7", "#a93658"];
function escape(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)); }
function positions(count: number, top: number, bottom: number): number[] { if (count <= 1) return [(top + bottom) / 2]; return Array.from({ length: count }, (_, index) => top + (bottom - top) * index / (count - 1)); }

export function pixelNetworkGraphMarkup(model: PixelModel, labels: readonly string[], hiddenValues: number[], probabilities: number[] = []): string {
  const shown = Math.min(8, model.hiddenUnits); const hiddenY = positions(shown, 35, 260); const outputY = positions(model.classCount, 42, 258);
  const inputStrength = model.inputHidden.slice(0, shown).map((weights) => Math.sqrt(weights.reduce((sum, value) => sum + value * value, 0) / Math.max(1, weights.length)));
  const maxInput = Math.max(.001, ...inputStrength); const maxOutput = Math.max(.001, ...model.hiddenOutput.flatMap((row) => row.slice(0, shown).map(Math.abs)));
  const inputLines = hiddenY.map((y, h) => `<line x1="72" y1="150" x2="155" y2="${y}" stroke="#8b90a0" stroke-width="${(1 + 5 * (inputStrength[h] ?? 0) / maxInput).toFixed(2)}" opacity=".48"/>`).join("");
  const outputLines = model.hiddenOutput.map((row, c) => row.slice(0, shown).map((weight, h) => `<line x1="175" y1="${hiddenY[h]}" x2="264" y2="${outputY[c]}" stroke="${COLORS[c % COLORS.length]}" stroke-width="${(1 + 5 * Math.abs(weight) / maxOutput).toFixed(2)}" opacity=".62"/>`).join("")).join("");
  const hiddenNodes = hiddenY.map((y, h) => { const value = hiddenValues[h] ?? 0; const alpha = (.12 + Math.abs(value) * .32).toFixed(2); return `<g><circle cx="165" cy="${y}" r="12" fill="rgba(116,70,245,${alpha})" stroke="#7446f5"/><text x="165" y="${y + 3}" text-anchor="middle">${h + 1}</text><text x="183" y="${y + 3}" fill="#596574">${value >= 0 ? "+" : ""}${value.toFixed(2)}</text></g>`; }).join("");
  const outputNodes = outputY.map((y, c) => `<g><circle cx="276" cy="${y}" r="14" fill="#fff" stroke="${COLORS[c % COLORS.length]}" stroke-width="3"/><text x="276" y="${y + 4}" text-anchor="middle" fill="${COLORS[c % COLORS.length]}" font-weight="800">${escape(labels[c] ?? String(c + 1))}</text><text x="296" y="${y + 4}" fill="#596574">${((probabilities[c] ?? 0) * 100).toFixed(0)}%</text></g>`).join("");
  return `<g font-family="sans-serif" font-size="10" fill="#343844">${inputLines}${outputLines}<rect x="12" y="112" width="60" height="76" rx="8" fill="#f4f5f8" stroke="#697383"/><text x="42" y="139" text-anchor="middle" font-weight="800">14×14</text><text x="42" y="156" text-anchor="middle">196 픽셀</text><text x="42" y="173" text-anchor="middle">한 묶음</text>${hiddenNodes}${outputNodes}<text x="42" y="286" text-anchor="middle">입력</text><text x="165" y="286" text-anchor="middle">은닉 ${model.hiddenUnits}개${model.hiddenUnits > shown ? ` (앞 ${shown}개)` : ""}</text><text x="276" y="286" text-anchor="middle">출력 ${model.classCount}개</text></g>`;
}
