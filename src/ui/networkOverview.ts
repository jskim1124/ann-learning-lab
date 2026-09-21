import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { NEURON_COLORS } from '../visualization/neuronColors';
import './networkOverview.css';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const CLASS_COLORS = ['#f17605', '#df466f', '#7446f5', '#1f6bd6', '#1558b7', '#a93658'];

/** A fixed, bounded scale: changing another neuron never rescales this one's ink. */
export function responseInk(value: number, activation: PixelModel['activation']): number {
  const magnitude = Math.abs(value);
  return activation === 'relu' ? magnitude / (1 + magnitude) : Math.min(1, magnitude);
}

export function networkOverview(model: PixelModel, input: number[], labels: readonly string[], selected: boolean, neuron: number, output: number): string {
  const result = forwardPixels(model, input);
  const reference = model.classCount === 2 && model.hiddenOutput[0]!.every(v => v === 0) && model.outputBias[0] === 0;
  const colors = reference ? ['#1f6bd6', '#f17605'] : CLASS_COLORS;
  const columns = model.hiddenUnits > 12 ? 3 : model.hiddenUnits > 4 ? 2 : 1;
  const rows = Math.ceil(model.hiddenUnits / columns);
  const height = Math.max(152, rows * 30, model.classCount * 36);
  const position = (i: number, count: number) => (i + .5) / count * height;
  const hidden = result.hidden.map((value, i) => ({ value, x: 156 + ((i % columns) - (columns - 1) / 2) * 48, y: position(Math.floor(i / columns), rows) }));
  const outputs = result.probabilities.map((value, i) => ({ value, y: position(i, model.classCount) }));
  const top = Math.max(...result.probabilities);
  const winners = result.probabilities.map((v, i) => top - v < 1e-10 ? i : -1).filter(i => i >= 0);
  const path = (x: number, y: number, endX: number, endY: number) => `M${x},${y} C${(x + endX) / 2},${y} ${(x + endX) / 2},${endY} ${endX},${endY}`;
  const lines = hidden.map((h, i) => `<path data-input-wire="${i}" d="${path(35, height / 2, h.x, h.y)}" class="${i === neuron ? 'is-route' : ''}" style="--wire-color:${NEURON_COLORS[i % NEURON_COLORS.length]}"/>`).join('') + hidden.map((h, i) => outputs.map((o, c) => `<path data-output-wire="${i}-${c}" d="${path(h.x, h.y, 280, o.y)}" class="${i === neuron ? 'is-route' : ''}" style="--wire-color:${NEURON_COLORS[i % NEURON_COLORS.length]}"/>`).join('')).join('');
  return `<div class="network-overview" aria-label="입력, 은닉 뉴런의 반응, 답별 예상">
    <div class="network-headings"><span>입력</span><span>은닉 뉴런</span><span>예상</span></div>
    <div class="network-stage" style="height:${height}px">
      <svg class="network-lines" viewBox="0 0 400 ${height}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      <div class="network-source" style="left:8.75%;top:50%" aria-label="${model.inputSize === 2 ? '가로와 세로, 두 입력값' : `그림 ${model.inputSize}칸을 한 묶음으로 표시`}">${model.inputSize === 2 ? '<i>↔</i><i>↕</i>' : '<i>▦</i>'}</div>
      ${hidden.map((h, i) => `<button type="button" class="response-node" data-network-neuron="${i}" aria-label="뉴런 ${i + 1} 경로 보기${selected ? `, 반응 ${h.value.toFixed(3)}` : ''}" aria-pressed="${i === neuron}" style="left:${h.x / 4}%;top:${h.y / height * 100}%;--node-color:${NEURON_COLORS[i % NEURON_COLORS.length]};--response-ink:${selected ? 12 + responseInk(h.value, model.activation) * 68 : 0}%"><span>${i + 1}</span>${selected ? `<small aria-hidden="true">${h.value > 0 ? '+' : h.value < 0 ? '−' : '·'}</small>` : ''}</button>`).join('')}
      ${outputs.map((o, i) => `<button type="button" class="response-answer${selected && winners.includes(i) ? ' is-leading' : ''}" data-network-output="${i}" aria-label="${esc(labels[i] ?? String(i))} 출력 보기${selected ? `, 예상 ${(o.value * 100).toFixed(1)}%` : ''}" aria-pressed="${i === output}" style="left:82%;top:${o.y / height * 100}%;--class-color:${colors[i % colors.length]}"><span>${esc(labels[i] ?? String(i))}</span><i class="answer-track" aria-hidden="true"><i style="width:${selected ? o.value * 100 : 0}%"></i></i></button>`).join('')}
    </div>
    <p class="network-verdict">${!selected ? '자료의 점을 눌러 반응을 살펴보세요.' : winners.length > 1 ? '현재 예상이 같아요' : `현재 예상 <strong style="color:${colors[winners[0]! % colors.length]}">${esc(labels[winners[0]!] ?? String(winners[0]))}</strong>`}</p>
    <p class="network-key network-change" aria-live="polite">원은 반응의 크기 · 막대는 답의 예상 비율</p>
  </div>`;
}
