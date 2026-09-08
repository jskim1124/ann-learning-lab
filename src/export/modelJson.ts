import type { StoredModelV2 } from "../types";
import { parseStoredModel } from "../core/modelSchema";

export function serializeModel(model: StoredModelV2): string {
  return JSON.stringify(model, null, 2);
}

export function deserializeModel(source: string): StoredModelV2 {
  return parseStoredModel(source);
}

export function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
