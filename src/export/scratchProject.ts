import type { NetworkModel } from "../types";

type ScratchInput = [number, string | [number, string]];
type ScratchBlock = {
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs: Record<string, ScratchInput>;
  fields: Record<string, [string, string | null]>;
  shadow: boolean;
  topLevel: boolean;
  x?: number;
  y?: number;
  mutation?: Record<string, string | string[]>;
};

type Expression = (parent: string) => ScratchInput;

const BACKDROP_ID = "11111111111111111111111111111111";
const SPRITE_ID = "22222222222222222222222222222222";
const backdropSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#f7f9fc"/><text x="240" y="58" text-anchor="middle" font-family="sans-serif" font-size="25" fill="#253047">Neural Lab 모델</text><text x="240" y="92" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#5f6670">스프라이트를 선택하고 나의 블록을 확인하세요</text></svg>`;
const spriteSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="110"><rect x="4" y="4" width="142" height="102" rx="16" fill="#e8f0fe" stroke="#1967d2" stroke-width="6"/><circle cx="42" cy="55" r="12" fill="#3568d4"/><circle cx="108" cy="55" r="12" fill="#ed7b32"/><path d="M54 55h42" stroke="#253047" stroke-width="5"/><text x="75" y="92" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#253047">Neural Lab</text></svg>`;

function createBlocks(model: NetworkModel, variableIds: Record<string, string>): Record<string, ScratchBlock> {
  const blocks: Record<string, ScratchBlock> = {};
  let serial = 0;
  const id = (prefix: string) => `${prefix}_${serial++}`;
  const number = (value: number): Expression => () => [1, [4, String(value)]];
  const argument = (name: "A" | "B"): Expression => (parent) => {
    const blockId = id(`arg_${name}`);
    blocks[blockId] = { opcode: "argument_reporter_string_number", next: null, parent, inputs: {}, fields: { VALUE: [name, null] }, shadow: false, topLevel: false };
    return [2, blockId];
  };
  const variable = (name: string): Expression => (parent) => {
    const blockId = id("variable");
    blocks[blockId] = { opcode: "data_variable", next: null, parent, inputs: {}, fields: { VARIABLE: [name, variableIds[name] ?? ""] }, shadow: false, topLevel: false };
    return [2, blockId];
  };
  const binary = (opcode: string, left: Expression, right: Expression, leftName = "NUM1", rightName = "NUM2"): Expression => (parent) => {
    const blockId = id(opcode);
    blocks[blockId] = { opcode, next: null, parent, inputs: {}, fields: {}, shadow: false, topLevel: false };
    blocks[blockId].inputs[leftName] = left(blockId);
    blocks[blockId].inputs[rightName] = right(blockId);
    return [2, blockId];
  };
  const math = (operator: string, value: Expression): Expression => (parent) => {
    const blockId = id("math");
    blocks[blockId] = { opcode: "operator_mathop", next: null, parent, inputs: {}, fields: { OPERATOR: [operator, null] }, shadow: false, topLevel: false };
    blocks[blockId].inputs.NUM = value(blockId);
    return [2, blockId];
  };
  const add = (a: Expression, b: Expression) => binary("operator_add", a, b);
  const sub = (a: Expression, b: Expression) => binary("operator_subtract", a, b);
  const mul = (a: Expression, b: Expression) => binary("operator_multiply", a, b);
  const div = (a: Expression, b: Expression) => binary("operator_divide", a, b);
  const zExpression = (h: number): Expression => {
    const weights = model.parameters.inputHidden[h] ?? [0, 0];
    const bias = model.parameters.hiddenBias[h] ?? 0;
    return add(add(mul(number(weights[0]), argument("A")), mul(number(weights[1]), argument("B"))), number(bias));
  };
  const sigmoidExpression = (value: Expression): Expression => div(number(1), add(number(1), math("e ^", sub(number(0), value))));
  const activationExpression = (h: number): Expression => {
    if (model.config.activation === "sigmoid") return sigmoidExpression(zExpression(h));
    const exp2z = () => math("e ^", mul(number(2), zExpression(h)));
    return div(sub(exp2z(), number(1)), add(exp2z(), number(1)));
  };
  const createSet = (name: string, value: Expression, parent: string | null): string => {
    const blockId = id("set");
    blocks[blockId] = { opcode: "data_setvariableto", next: null, parent, inputs: {}, fields: { VARIABLE: [name, variableIds[name] ?? ""] }, shadow: false, topLevel: false };
    blocks[blockId].inputs.VALUE = value(blockId);
    return blockId;
  };
  const chain = (previous: string, next: string) => { const before = blocks[previous]; const after = blocks[next]; if (before && after) { before.next = next; after.parent = previous; } };

  const defineId = "define_neural_lab";
  const prototypeId = "prototype_neural_lab";
  const argumentAId = "prototype_arg_a";
  const argumentBId = "prototype_arg_b";
  const proccode = "Neural Lab 예측하기 A %s B %s";
  blocks[defineId] = { opcode: "procedures_definition", next: null, parent: null, inputs: { custom_block: [1, prototypeId] }, fields: {}, shadow: false, topLevel: true, x: 320, y: 32 };
  blocks[prototypeId] = {
    opcode: "procedures_prototype", next: null, parent: defineId,
    inputs: { inputA: [1, argumentAId], inputB: [1, argumentBId] }, fields: {}, shadow: true, topLevel: false,
    mutation: { tagName: "mutation", children: [], proccode, argumentids: '["inputA","inputB"]', argumentnames: '["A","B"]', argumentdefaults: '["0","0"]', warp: "true" },
  };
  blocks[argumentAId] = { opcode: "argument_reporter_string_number", next: null, parent: prototypeId, inputs: {}, fields: { VALUE: ["A", null] }, shadow: true, topLevel: false };
  blocks[argumentBId] = { opcode: "argument_reporter_string_number", next: null, parent: prototypeId, inputs: {}, fields: { VALUE: ["B", null] }, shadow: true, topLevel: false };

  let previous = defineId;
  for (let h = 0; h < model.config.hiddenUnits; h += 1) {
    const name = `은닉 H${h + 1}`;
    if (model.config.activation !== "relu") {
      const setId = createSet(name, activationExpression(h), previous);
      chain(previous, setId); previous = setId;
      continue;
    }
    const ifId = id("relu_if");
    blocks[ifId] = { opcode: "control_if_else", next: null, parent: previous, inputs: {}, fields: {}, shadow: false, topLevel: false };
    blocks[ifId].inputs.CONDITION = binary("operator_gt", zExpression(h), number(0), "OPERAND1", "OPERAND2")(ifId);
    const positive = createSet(name, zExpression(h), ifId);
    const zero = createSet(name, number(0), ifId);
    blocks[ifId].inputs.SUBSTACK = [2, positive]; blocks[ifId].inputs.SUBSTACK2 = [2, zero];
    chain(previous, ifId); previous = ifId;
  }

  let logit: Expression = number(model.parameters.outputBias);
  for (let h = 0; h < model.config.hiddenUnits; h += 1) {
    logit = add(logit, mul(number(model.parameters.hiddenOutput[h] ?? 0), variable(`은닉 H${h + 1}`)));
  }
  const probabilitySet = createSet("범주 1 확률", sigmoidExpression(logit), previous);
  chain(previous, probabilitySet); previous = probabilitySet;
  const classIf = id("class_if");
  blocks[classIf] = { opcode: "control_if_else", next: null, parent: previous, inputs: {}, fields: {}, shadow: false, topLevel: false };
  blocks[classIf].inputs.CONDITION = binary("operator_gt", variable("범주 1 확률"), number(0.499999), "OPERAND1", "OPERAND2")(classIf);
  const setOne = createSet("예측 범주", number(1), classIf);
  const setZero = createSet("예측 범주", number(0), classIf);
  blocks[classIf].inputs.SUBSTACK = [2, setOne]; blocks[classIf].inputs.SUBSTACK2 = [2, setZero];
  chain(previous, classIf);

  const flagId = "green_flag";
  const callId = "sample_call";
  const sayId = "say_result";
  blocks[flagId] = { opcode: "event_whenflagclicked", next: callId, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: true, x: 20, y: 32 };
  blocks[callId] = {
    opcode: "procedures_call", next: sayId, parent: flagId,
    inputs: { inputA: [1, [4, "-0.8"]], inputB: [1, [4, "0.8"]] }, fields: {}, shadow: false, topLevel: false,
    mutation: { tagName: "mutation", children: [], proccode, argumentids: '["inputA","inputB"]', warp: "true" },
  };
  blocks[sayId] = { opcode: "looks_say", next: null, parent: callId, inputs: { MESSAGE: variable("예측 범주")(sayId) }, fields: {}, shadow: false, topLevel: false };
  return blocks;
}

export function createScratchProjectFiles(model: NetworkModel): Record<string, Uint8Array> {
  const encoder = new TextEncoder();
  const variableNames = ["범주 1 확률", "예측 범주", ...Array.from({ length: model.config.hiddenUnits }, (_, i) => `은닉 H${i + 1}`)];
  const variableIds = Object.fromEntries(variableNames.map((name, index) => [name, `neural_var_${index}`]));
  const variables = Object.fromEntries(variableNames.map((name) => [variableIds[name], [name, 0]]));
  const project = {
    targets: [
      {
        isStage: true, name: "Stage", variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {}, currentCostume: 0,
        costumes: [{ assetId: BACKDROP_ID, name: "Neural Lab", md5ext: `${BACKDROP_ID}.svg`, dataFormat: "svg", rotationCenterX: 240, rotationCenterY: 180 }],
        sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: "on", textToSpeechLanguage: null,
      },
      {
        isStage: false, name: "Neural Lab 모델", variables, lists: {}, broadcasts: {}, blocks: createBlocks(model, variableIds), comments: {}, currentCostume: 0,
        costumes: [{ assetId: SPRITE_ID, name: "Neural Lab", bitmapResolution: 1, md5ext: `${SPRITE_ID}.svg`, dataFormat: "svg", rotationCenterX: 75, rotationCenterY: 55 }],
        sounds: [], volume: 100, layerOrder: 1, visible: true, x: 0, y: -20, size: 100, direction: 90, draggable: false, rotationStyle: "all around",
      },
    ],
    monitors: variableNames.slice(0, 2).map((name, index) => ({ id: variableIds[name], mode: "default", opcode: "data_variable", params: { VARIABLE: name }, spriteName: "Neural Lab 모델", value: 0, width: 0, height: 0, x: 8, y: 8 + index * 28, visible: true, sliderMin: 0, sliderMax: 100, isDiscrete: true })),
    extensions: [], meta: { semver: "3.0.0", vm: "11.3.0", agent: "Neural Lab model-v2 exporter" },
  };
  return {
    "project.json": encoder.encode(JSON.stringify(project)),
    [`${BACKDROP_ID}.svg`]: encoder.encode(backdropSvg),
    [`${SPRITE_ID}.svg`]: encoder.encode(spriteSvg),
  };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, value: number): void { view.setUint16(offset, value, true); }
function write32(view: DataView, offset: number, value: number): void { view.setUint32(offset, value, true); }

export function zipStored(files: Record<string, Uint8Array>): Uint8Array {
  const encoder = new TextEncoder();
  const entries = Object.entries(files).map(([name, data]) => ({ name: encoder.encode(name), data, crc: crc32(data), offset: 0 }));
  const localSize = entries.reduce((sum, entry) => sum + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let offset = 0;
  for (const entry of entries) {
    entry.offset = offset; write32(view, offset, 0x04034b50); write16(view, offset + 4, 20); write16(view, offset + 6, 0); write16(view, offset + 8, 0);
    write32(view, offset + 14, entry.crc); write32(view, offset + 18, entry.data.length); write32(view, offset + 22, entry.data.length); write16(view, offset + 26, entry.name.length);
    output.set(entry.name, offset + 30); output.set(entry.data, offset + 30 + entry.name.length); offset += 30 + entry.name.length + entry.data.length;
  }
  const centralOffset = offset;
  for (const entry of entries) {
    write32(view, offset, 0x02014b50); write16(view, offset + 4, 20); write16(view, offset + 6, 20); write16(view, offset + 8, 0); write16(view, offset + 10, 0);
    write32(view, offset + 16, entry.crc); write32(view, offset + 20, entry.data.length); write32(view, offset + 24, entry.data.length); write16(view, offset + 28, entry.name.length); write32(view, offset + 42, entry.offset);
    output.set(entry.name, offset + 46); offset += 46 + entry.name.length;
  }
  write32(view, offset, 0x06054b50); write16(view, offset + 8, entries.length); write16(view, offset + 10, entries.length); write32(view, offset + 12, centralSize); write32(view, offset + 16, centralOffset);
  return output;
}

export function createScratchProject(model: NetworkModel): Blob {
  const bytes = zipStored(createScratchProjectFiles(model));
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/x.scratch.sb3" });
}
