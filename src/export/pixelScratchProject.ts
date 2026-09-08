import type { PixelModel } from "../core/pixelNetwork";
import { zipStored } from "./scratchProject";

type Input = [number, string | [number, string]];
type Block = { opcode: string; next: string | null; parent: string | null; inputs: Record<string, Input>; fields: Record<string, [string, string | null]>; shadow: boolean; topLevel: boolean; x?: number; y?: number; mutation?: Record<string, string | string[]> };
type Expr = (parent: string) => Input;

export function createPixelScratchProjectFiles(model: PixelModel, labels: readonly string[], pixels: readonly number[] = []): Record<string, Uint8Array> {
  const blocks: Record<string, Block> = {}; let serial = 0; const id = (name: string) => `${name}_${serial++}`;
  const variableNames = ["i", "h", "c", "합", "점수", "가장 큰 점수", "예측 번호", "예측 결과"];
  const variableIds = Object.fromEntries(variableNames.map((name, index) => [name, `v${index}`]));
  const listIds = { pixels: "list_pixels", w1: "list_w1", b1: "list_b1", hidden: "list_hidden", w2: "list_w2", b2: "list_b2", labels: "list_labels" };
  const num = (value: number): Expr => () => [1, [4, String(value)]];
  const variable = (name: string): Expr => (parent) => { const blockId = id("var"); blocks[blockId] = { opcode: "data_variable", next: null, parent, inputs: {}, fields: { VARIABLE: [name, variableIds[name] ?? ""] }, shadow: false, topLevel: false }; return [2, blockId]; };
  const item = (name: string, listId: string, index: Expr): Expr => (parent) => { const blockId = id("item"); blocks[blockId] = { opcode: "data_itemoflist", next: null, parent, inputs: {}, fields: { LIST: [name, listId] }, shadow: false, topLevel: false }; blocks[blockId].inputs.INDEX = index(blockId); return [2, blockId]; };
  const binary = (opcode: string, left: Expr, right: Expr, a = "NUM1", b = "NUM2"): Expr => (parent) => { const blockId = id("op"); blocks[blockId] = { opcode, next: null, parent, inputs: {}, fields: {}, shadow: false, topLevel: false }; blocks[blockId].inputs[a] = left(blockId); blocks[blockId].inputs[b] = right(blockId); return [2, blockId]; };
  const add = (a: Expr, b: Expr) => binary("operator_add", a, b); const sub = (a: Expr, b: Expr) => binary("operator_subtract", a, b); const mul = (a: Expr, b: Expr) => binary("operator_multiply", a, b);
  const exp = (value: Expr): Expr => (parent) => { const blockId = id("exp"); blocks[blockId] = { opcode: "operator_mathop", next: null, parent, inputs: {}, fields: { OPERATOR: ["e ^", null] }, shadow: false, topLevel: false }; blocks[blockId].inputs.NUM = value(blockId); return [2, blockId]; };
  const div = (a: Expr, b: Expr) => binary("operator_divide", a, b); const tanh = (value: Expr) => div(sub(exp(mul(num(2), value)), num(1)), add(exp(mul(num(2), value)), num(1)));
  const setVar = (name: string, value: Expr): string => { const blockId = id("set"); blocks[blockId] = { opcode: "data_setvariableto", next: null, parent: null, inputs: {}, fields: { VARIABLE: [name, variableIds[name] ?? ""] }, shadow: false, topLevel: false }; blocks[blockId].inputs.VALUE = value(blockId); return blockId; };
  const changeVar = (name: string, value: Expr): string => { const blockId = id("change"); blocks[blockId] = { opcode: "data_changevariableby", next: null, parent: null, inputs: {}, fields: { VARIABLE: [name, variableIds[name] ?? ""] }, shadow: false, topLevel: false }; blocks[blockId].inputs.VALUE = value(blockId); return blockId; };
  const chain = (...ids: string[]): void => ids.forEach((blockId, index) => { const block = blocks[blockId]!; const previous = ids[index - 1]; const next = ids[index + 1]; block.parent = previous ?? block.parent; block.next = next ?? null; });
  const repeat = (times: Expr, body: string): string => { const blockId = id("repeat"); blocks[blockId] = { opcode: "control_repeat", next: null, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: false }; blocks[blockId].inputs.TIMES = times(blockId); blocks[blockId].inputs.SUBSTACK = [2, body]; blocks[body]!.parent = blockId; return blockId; };

  blocks.define = { opcode: "procedures_definition", next: null, parent: null, inputs: { custom_block: [1, "prototype"] }, fields: {}, shadow: false, topLevel: true, x: 330, y: 25 };
  blocks.prototype = { opcode: "procedures_prototype", next: null, parent: "define", inputs: {}, fields: {}, shadow: true, topLevel: false, mutation: { tagName: "mutation", children: [], proccode: "픽셀 그림 예측하기", argumentids: "[]", argumentnames: "[]", argumentdefaults: "[]", warp: "true" } };
  const clearHidden = id("clear"); blocks[clearHidden] = { opcode: "data_deletealloflist", next: null, parent: null, inputs: {}, fields: { LIST: ["숨은 값", listIds.hidden] }, shadow: false, topLevel: false };
  const setH = setVar("h", num(1)); const setSum = setVar("합", item("숨은 기준", listIds.b1, variable("h"))); const setI = setVar("i", num(1));
  const w1Index = add(mul(sub(variable("h"), num(1)), num(model.inputSize)), variable("i"));
  const accumulateInput = changeVar("합", mul(item("입력 연결", listIds.w1, w1Index), item("그림 밝기", listIds.pixels, variable("i")))); const nextI = changeVar("i", num(1)); chain(accumulateInput, nextI);
  const inputLoop = repeat(num(model.inputSize), accumulateInput);
  const addHidden = id("addhidden"); blocks[addHidden] = { opcode: "data_addtolist", next: null, parent: null, inputs: {}, fields: { LIST: ["숨은 값", listIds.hidden] }, shadow: false, topLevel: false }; blocks[addHidden].inputs.ITEM = tanh(variable("합"))(addHidden);
  const nextH = changeVar("h", num(1)); chain(setSum, setI, inputLoop, addHidden, nextH); const hiddenLoop = repeat(num(model.hiddenUnits), setSum);
  const setC = setVar("c", num(1)); const setBest = setVar("가장 큰 점수", num(-999999)); const setAnswer = setVar("예측 번호", num(1));
  const setScore = setVar("점수", item("출력 기준", listIds.b2, variable("c"))); const setH2 = setVar("h", num(1)); const w2Index = add(mul(sub(variable("c"), num(1)), num(model.hiddenUnits)), variable("h"));
  const accumulateOutput = changeVar("점수", mul(item("출력 연결", listIds.w2, w2Index), item("숨은 값", listIds.hidden, variable("h")))); const nextH2 = changeVar("h", num(1)); chain(accumulateOutput, nextH2); const outputInner = repeat(num(model.hiddenUnits), accumulateOutput);
  const ifId = id("if"); blocks[ifId] = { opcode: "control_if", next: null, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: false }; blocks[ifId].inputs.CONDITION = binary("operator_gt", variable("점수"), variable("가장 큰 점수"), "OPERAND1", "OPERAND2")(ifId); const bestNow = setVar("가장 큰 점수", variable("점수")); const answerNow = setVar("예측 번호", variable("c")); chain(bestNow, answerNow); blocks[ifId].inputs.SUBSTACK = [2, bestNow]; blocks[bestNow]!.parent = ifId;
  const nextC = changeVar("c", num(1)); chain(setScore, setH2, outputInner, ifId, nextC); const outputLoop = repeat(num(model.classCount), setScore);
  const setLabel = setVar("예측 결과", item("답 이름", listIds.labels, variable("예측 번호")));
  chain("define", clearHidden, setH, hiddenLoop, setC, setBest, setAnswer, outputLoop, setLabel);
  blocks.flag = { opcode: "event_whenflagclicked", next: "call", parent: null, inputs: {}, fields: {}, shadow: false, topLevel: true, x: 20, y: 25 };
  blocks.call = { opcode: "procedures_call", next: "say", parent: "flag", inputs: {}, fields: {}, shadow: false, topLevel: false, mutation: { tagName: "mutation", children: [], proccode: "픽셀 그림 예측하기", argumentids: "[]", warp: "true" } };
  blocks.say = { opcode: "looks_say", next: null, parent: "call", inputs: {}, fields: {}, shadow: false, topLevel: false }; blocks.say.inputs.MESSAGE = variable("예측 결과")("say");

  const svgId = "33333333333333333333333333333333"; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="130"><rect x="5" y="5" width="170" height="120" rx="16" fill="#efedff" stroke="#7446f5" stroke-width="6"/><text x="90" y="58" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#343844">14×14 픽셀</text><text x="90" y="88" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#1769d2">Neural Lab</text></svg>`;
  const variables = Object.fromEntries(variableNames.map((name) => [variableIds[name], [name, 0]]));
  const drawing = Array.from({ length: model.inputSize }, (_, index) => pixels[index] ?? 0);
  const lists = { [listIds.pixels]: ["그림 밝기", drawing], [listIds.w1]: ["입력 연결", model.inputHidden.flat()], [listIds.b1]: ["숨은 기준", model.hiddenBias], [listIds.hidden]: ["숨은 값", []], [listIds.w2]: ["출력 연결", model.hiddenOutput.flat()], [listIds.b2]: ["출력 기준", model.outputBias], [listIds.labels]: ["답 이름", [...labels]] };
  const project = { targets: [{ isStage: true, name: "Stage", variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {}, currentCostume: 0, costumes: [], sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: "on", textToSpeechLanguage: null }, { isStage: false, name: "픽셀 모델", variables, lists, broadcasts: {}, blocks, comments: {}, currentCostume: 0, costumes: [{ assetId: svgId, name: "픽셀 모델", bitmapResolution: 1, md5ext: `${svgId}.svg`, dataFormat: "svg", rotationCenterX: 90, rotationCenterY: 65 }], sounds: [], volume: 100, layerOrder: 1, visible: true, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: "all around" }], monitors: [{ id: variableIds["예측 결과"], mode: "default", opcode: "data_variable", params: { VARIABLE: "예측 결과" }, spriteName: "픽셀 모델", value: "", width: 0, height: 0, x: 10, y: 10, visible: true, sliderMin: 0, sliderMax: 100, isDiscrete: true }], extensions: [], meta: { semver: "3.0.0", vm: "11.3.0", agent: "Neural Lab pixel exporter" } };
  const encoder = new TextEncoder(); return { "project.json": encoder.encode(JSON.stringify(project)), [`${svgId}.svg`]: encoder.encode(svg) };
}

export function createPixelScratchProject(model: PixelModel, labels: readonly string[], pixels: readonly number[] = []): Blob { const bytes = zipStored(createPixelScratchProjectFiles(model, labels, pixels)); return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/x.scratch.sb3" }); }
