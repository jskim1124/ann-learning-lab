import type { NetworkConfig, NetworkModel } from "../types";

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initializeNetwork(config: NetworkConfig): NetworkModel {
  const random = mulberry32(config.seed);
  const scale = Math.sqrt(2 / (2 + config.hiddenUnits));
  const signed = () => (random() * 2 - 1) * scale;
  return {
    config: { ...config },
    parameters: {
      inputHidden: Array.from({ length: config.hiddenUnits }, () => [signed(), signed()]),
      hiddenBias: Array.from({ length: config.hiddenUnits }, () => (random() * 2 - 1) * 0.08),
      hiddenOutput: Array.from({ length: config.hiddenUnits }, signed),
      outputBias: 0,
    },
    epoch: 0,
  };
}

