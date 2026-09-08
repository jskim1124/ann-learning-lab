import type { NetworkModel } from "../types";

export function generateScratchExtension(model: NetworkModel): string {
  const payload = JSON.stringify({
    activation: model.config.activation,
    inputHidden: model.parameters.inputHidden,
    hiddenBias: model.parameters.hiddenBias,
    hiddenOutput: model.parameters.hiddenOutput,
    outputBias: model.parameters.outputBias,
  });
  return `// Neural Lab model-v2 · TurboWarp custom extension\n(function(Scratch){\n  \"use strict\";\n  if(!Scratch.extensions.unsandboxed) throw new Error(\"Neural Lab 확장은 비샌드박스 모드가 필요합니다.\");\n  const MODEL=${payload};\n  const sigmoid=v=>1/(1+Math.exp(-Math.max(-40,Math.min(40,v))));\n  const activate=v=>MODEL.activation===\"relu\"?Math.max(0,v):MODEL.activation===\"sigmoid\"?sigmoid(v):Math.tanh(v);\n  const predict=(x,y)=>{\n    x=Math.max(-1,Math.min(1,Number(x)||0)); y=Math.max(-1,Math.min(1,Number(y)||0));\n    const hidden=MODEL.inputHidden.map((w,i)=>activate(w[0]*x+w[1]*y+MODEL.hiddenBias[i]));\n    const probability=sigmoid(hidden.reduce((sum,value,i)=>sum+value*MODEL.hiddenOutput[i],MODEL.outputBias));\n    return {hidden,probability};\n  };\n  class NeuralLabExtension {\n    getInfo(){ return {id:\"neurallab\",name:\"Neural Lab\",blocks:[\n      {opcode:\"category\",blockType:Scratch.BlockType.REPORTER,text:\"입력 A [X] B [Y] 의 범주\",arguments:{X:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},Y:{type:Scratch.ArgumentType.NUMBER,defaultValue:0}}},\n      {opcode:\"probability\",blockType:Scratch.BlockType.REPORTER,text:\"입력 A [X] B [Y] 의 범주 1 확률\",arguments:{X:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},Y:{type:Scratch.ArgumentType.NUMBER,defaultValue:0}}},\n      {opcode:\"hidden\",blockType:Scratch.BlockType.REPORTER,text:\"입력 A [X] B [Y] 의 은닉 뉴런 [N] 값\",arguments:{X:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},Y:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},N:{type:Scratch.ArgumentType.NUMBER,defaultValue:1}}}\n    ]};}\n    category(args){ return predict(args.X,args.Y).probability>=0.5?1:0; }\n    probability(args){ return predict(args.X,args.Y).probability; }\n    hidden(args){ const values=predict(args.X,args.Y).hidden; return values[Math.max(0,Math.floor(Number(args.N)||1)-1)]??0; }\n  }\n  Scratch.extensions.register(new NeuralLabExtension());\n})(Scratch);\n`;
}
