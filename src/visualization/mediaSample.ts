import type { MediaKind } from "../types";

const SKETCHES = [
  ["00111100", "01100110", "11000011", "11000011", "11000011", "11000011", "01100110", "00111100"],
  ["00011000", "00111100", "01100110", "11000011", "11000011", "11000011", "01111110", "00000000"],
];

const DIGITS = [
  ["00111000", "01100000", "11000000", "11111000", "11001100", "11001100", "01111000", "00000000"],
  ["00111100", "01100110", "01100110", "00111110", "00000110", "00001100", "00111000", "00000000"],
];
const pixelEdits = new Map<string, Set<number>>();

function waveform(sampleIndex: number): number[] {
  return Array.from({ length: 64 }, (_, index) => {
    const time = index / 63;
    if (sampleIndex % 2 === 0) {
      const envelope = Math.exp(-6 * time);
      return Math.sin(index * 1.62) * envelope + Math.sin(index * 2.8) * envelope * .22;
    }
    const envelope = Math.exp(-Math.pow((time - .34) * 4.2, 2));
    return Math.sin(index * .86) * envelope * .9 + Math.sin(index * 1.91) * envelope * .2;
  });
}

function drawWaveform(canvas: HTMLCanvasElement, sampleIndex: number, highlight: boolean): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const values = waveform(sampleIndex);
  ctx.fillStyle = "#f7f3e8"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(60,73,91,.13)"; ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += canvas.width / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
  if (highlight) { const start = canvas.width * .31; ctx.fillStyle = "rgba(241,200,75,.35)"; ctx.fillRect(start, 0, canvas.width * .13, canvas.height); }
  ctx.strokeStyle = "#125ca3"; ctx.lineWidth = 3; ctx.beginPath();
  values.forEach((value, index) => { const x = index / (values.length - 1) * canvas.width; const y = canvas.height / 2 - value * canvas.height * .39; if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.fillStyle = "#5f6874"; ctx.font = "700 12px system-ui"; ctx.fillText("시간이 흐르는 방향 →", 12, canvas.height - 10);
}

function drawPixels(canvas: HTMLCanvasElement, kind: "sketch" | "digits", sampleIndex: number, highlight: boolean): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const grid = (kind === "sketch" ? SKETCHES : DIGITS)[sampleIndex % 2]!;
  const size = Math.min(canvas.height - 18, canvas.width * .55) / 8;
  const left = (canvas.width - size * 8) / 2; const top = 8;
  ctx.fillStyle = "#f7f3e8"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const edits = pixelEdits.get(`${kind}-${sampleIndex % 2}`) ?? new Set<number>();
  for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
    const baseFilled = grid[row]![col] === "1"; const filled = edits.has(row * 8 + col) ? !baseFilled : baseFilled;
    ctx.fillStyle = filled ? "#253047" : "#fffdf8";
    ctx.fillRect(left + col * size, top + row * size, size, size);
    ctx.strokeStyle = "#d6d2c7"; ctx.strokeRect(left + col * size, top + row * size, size, size);
  }
  if (highlight) {
    const row = kind === "sketch" ? 1 : 5;
    ctx.strokeStyle = "#df762c"; ctx.lineWidth = 4; ctx.strokeRect(left - 2, top + row * size - 2, size * 8 + 4, size + 4);
  }
}

export function drawMediaSample(canvas: HTMLCanvasElement, kind: MediaKind, sampleIndex: number, highlight: boolean): void {
  if (kind === "sound") drawWaveform(canvas, sampleIndex, highlight);
  else if (kind === "sketch" || kind === "digits") drawPixels(canvas, kind, sampleIndex, highlight);
}

export function toggleMediaPixel(canvas: HTMLCanvasElement, event: MouseEvent, kind: MediaKind, sampleIndex: number, highlight: boolean): boolean {
  if (kind !== "sketch" && kind !== "digits") return false;
  const rect = canvas.getBoundingClientRect(); const size = Math.min(canvas.height - 18, canvas.width * .55) / 8;
  const left = (canvas.width - size * 8) / 2; const top = 8;
  const localX = (event.clientX - rect.left) / rect.width * canvas.width; const localY = (event.clientY - rect.top) / rect.height * canvas.height;
  const col = Math.floor((localX - left) / size); const row = Math.floor((localY - top) / size);
  if (row < 0 || row > 7 || col < 0 || col > 7) return false;
  const key = `${kind}-${sampleIndex % 2}`; const edits = pixelEdits.get(key) ?? new Set<number>(); const cell = row * 8 + col;
  if (edits.has(cell)) edits.delete(cell); else edits.add(cell); pixelEdits.set(key, edits);
  drawMediaSample(canvas, kind, sampleIndex, highlight); return true;
}

export function mediaSampleText(kind: MediaKind, sampleIndex: number, highlight: boolean): string {
  if (!highlight) {
    if (kind === "sound") return `예시 ${sampleIndex + 1}: 선 전체가 한 번 녹음한 소리입니다.`;
    return `예시 ${sampleIndex + 1}: 64칸 전체가 한 장의 입력입니다. 그림을 눌러 한 칸을 직접 바꿔 보세요.`;
  }
  if (kind === "sound") return "노란 구간만 강조했습니다. 컴퓨터는 이런 짧은 구간을 수십 개 함께 비교합니다.";
  return "주황 테두리의 한 줄만 강조했습니다. 한 칸만 보지 않고 다른 줄과 함께 보아야 모양을 알 수 있습니다.";
}

export function playSoundSample(sampleIndex: number): void {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const audio = new AudioContextClass(); const now = audio.currentTime;
  const oscillator = audio.createOscillator(); const gain = audio.createGain();
  oscillator.type = sampleIndex % 2 === 0 ? "square" : "triangle";
  oscillator.frequency.setValueAtTime(sampleIndex % 2 === 0 ? 145 : 210, now);
  gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.18, now + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, now + (sampleIndex % 2 === 0 ? .18 : .34));
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(now); oscillator.stop(now + .4);
  oscillator.addEventListener("ended", () => { void audio.close(); });
}
