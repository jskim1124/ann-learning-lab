import type { NetworkModel } from "../types";

export function generateScratchExtension(model: NetworkModel): string {
  const payload = JSON.stringify({
    activation: model.config.activation,
    inputHidden: model.parameters.inputHidden,
    hiddenBias: model.parameters.hiddenBias,
    hiddenOutput: model.parameters.hiddenOutput,
    outputBias: model.parameters.outputBias,
  });
  return `// Neural Lab model-v2 · TurboWarp custom extension (sandbox compatible)
(function(Scratch){
  "use strict";
  const MODEL=${payload};
  const sigmoid=v=>1/(1+Math.exp(-Math.max(-40,Math.min(40,v))));
  const activate=v=>MODEL.activation==="relu"?Math.max(0,v):MODEL.activation==="sigmoid"?sigmoid(v):Math.tanh(v);
  const predict=(x,y)=>{
    x=Math.max(-1,Math.min(1,Number(x)||0)); y=Math.max(-1,Math.min(1,Number(y)||0));
    const hidden=MODEL.inputHidden.map((w,i)=>activate(w[0]*x+w[1]*y+MODEL.hiddenBias[i]));
    const probability=sigmoid(hidden.reduce((sum,value,i)=>sum+value*MODEL.hiddenOutput[i],MODEL.outputBias));
    return {hidden,probability};
  };
  class NeuralLabExtension {
    getInfo(){ return {id:"neurallab",name:"Neural Lab",blocks:[
      {opcode:"category",blockType:Scratch.BlockType.REPORTER,text:"입력 A [X] B [Y] 의 결과",arguments:{X:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},Y:{type:Scratch.ArgumentType.NUMBER,defaultValue:0}}},
      {opcode:"probability",blockType:Scratch.BlockType.REPORTER,text:"입력 A [X] B [Y] 의 결과 1 가능성",arguments:{X:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},Y:{type:Scratch.ArgumentType.NUMBER,defaultValue:0}}},
      {opcode:"hidden",blockType:Scratch.BlockType.REPORTER,text:"입력 A [X] B [Y] 의 규칙 찾기 칸 [N] 값",arguments:{X:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},Y:{type:Scratch.ArgumentType.NUMBER,defaultValue:0},N:{type:Scratch.ArgumentType.NUMBER,defaultValue:1}}}
    ]};}
    category(args){ return predict(args.X,args.Y).probability>=0.5?1:0; }
    probability(args){ return predict(args.X,args.Y).probability; }
    hidden(args){ const values=predict(args.X,args.Y).hidden; return values[Math.max(0,Math.floor(Number(args.N)||1)-1)]??0; }
  }
  Scratch.extensions.register(new NeuralLabExtension());
})(Scratch);
`;
}
