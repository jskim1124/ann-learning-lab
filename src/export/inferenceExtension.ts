import type { PixelModel } from "../core/pixelNetwork";

export interface InferenceInput { kind: "image" | "numbers" | "text"; axes?: number[]; ranges?: Array<[number, number]>; featureCount?: number; }
/** A self-contained, inference-only extension: parameters and preprocessing, never training examples. */
export function generateInferenceExtension(model: PixelModel, classes: string[], input: InferenceInput = { kind: "image" }): string {
  if (!model.epoch) throw new Error("학습한 모델만 내보낼 수 있습니다.");
  const payload = JSON.stringify({ model, classes, input });
  return `// Neural Lab · 학습 완료 모델 · TurboWarp 사용자 확장 (샌드박스 없이 실행)
// 모델/전처리만 포함합니다. 학습 자료 전송, 재학습, 외부 서버 호출은 없습니다.
(function(Scratch){
"use strict";
if(!Scratch.extensions.unsandboxed) throw new Error("사용자 확장에서 ‘샌드박스 없이 실행’을 선택해 주세요.");
const saved=${payload};
const MODEL=saved.model, LABELS=saved.classes, INPUT=saved.input;
const activate=x=>MODEL.activation==="relu"?Math.max(0,x):MODEL.activation==="sigmoid"?1/(1+Math.exp(-x)):Math.tanh(x);
class NeuralLab {
 constructor(){this.scores=LABELS.map(()=>0);this.answer="아직 분류하지 않음";this.status="준비";this.threshold=.5;this.stream=null;this.video=null;this.panel=null;this.clock=0;this.token=0;Scratch.vm.runtime.on("PROJECT_STOP_ALL",()=>this.stop());}
 getInfo(){const text=Scratch.ArgumentType.STRING,num=Scratch.ArgumentType.NUMBER,block=Scratch.BlockType;
 const labelArg={LABEL:{type:text,menu:"labels",defaultValue:LABELS[0]}};
 return {id:"neurallabmodel",name:"내 학습 모델",color1:"#1769d2",blocks:[
 ...(INPUT.kind==="image"?[
 {opcode:"camera",blockType:block.COMMAND,text:"카메라 켜기"},
 {opcode:"cameraClassify",blockType:block.COMMAND,text:"카메라 그림 분류하기"},
 {opcode:"file",blockType:block.COMMAND,text:"그림 파일 골라 분류하기"},
 {opcode:"repeat",blockType:block.COMMAND,text:"매 [SECONDS] 초마다 카메라 분류",arguments:{SECONDS:{type:num,defaultValue:1}}},
 {opcode:"stop",blockType:block.COMMAND,text:"분류 멈추고 카메라 끄기"}
 ]:[{opcode:"classifyRaw",blockType:block.COMMAND,text:INPUT.kind==="text"?"글 [VALUE] 분류하기":"숫자 자료 [VALUE] 분류하기",arguments:{VALUE:{type:text,defaultValue:INPUT.kind==="text"?"안녕하세요":"1, 2, 3"}}}]),
 {opcode:"whenLabel",blockType:block.HAT,text:"[LABEL] 감지되었을 때",isEdgeActivated:true,arguments:labelArg},
 {opcode:"detected",blockType:block.BOOLEAN,text:"[LABEL] 감지됨",arguments:labelArg},
 {opcode:"label",blockType:block.REPORTER,text:"예측 라벨"},
 {opcode:"confidence",blockType:block.REPORTER,text:"[LABEL] 예측 점수 (0~1)",arguments:labelArg},
 {opcode:"setThreshold",blockType:block.COMMAND,text:"감지 기준 [VALUE]",arguments:{VALUE:{type:num,defaultValue:.5}}},
 {opcode:"state",blockType:block.REPORTER,text:"모델 상태"}
 ],menus:{labels:{acceptReporters:true,items:LABELS}}};}
 classify(values){
  if(values.length!==MODEL.inputSize||values.some(v=>!Number.isFinite(v))) {this.fail("입력값 개수를 확인해 주세요.");return;}
  const hidden=MODEL.inputHidden.map((weights,h)=>activate(weights.reduce((s,w,i)=>s+w*values[i],MODEL.hiddenBias[h])));
  const logits=MODEL.hiddenOutput.map((weights,c)=>weights.reduce((s,w,h)=>s+w*hidden[h],MODEL.outputBias[c]));
  const top=Math.max(...logits), exps=logits.map(v=>Math.exp(v-top)),sum=exps.reduce((a,b)=>a+b,0);
  this.scores=exps.map(v=>v/sum);this.answer=LABELS[this.scores.indexOf(Math.max(...this.scores))];this.status="분류 완료";
 }
 fail(message){this.status=message;this.answer="아직 분류하지 않음";this.scores=LABELS.map(()=>0);}
 classifyRaw({VALUE}){let values;
  if(INPUT.kind==="text"){const source=String(VALUE),chars=[...source].filter(c=>!/\\s/u.test(c));values=[chars.length,source.trim()?source.trim().split(/\\s+/u).length:0,chars.length?new Set(chars.map(c=>c.toLocaleLowerCase())).size/chars.length*100:0,chars.length?chars.filter(c=>/[0-9]/u.test(c)).length/chars.length*100:0];}
  else {const parts=String(VALUE).split(",");if(parts.some(v=>!v.trim()))return this.fail("쉼표 사이에 숫자를 적어 주세요.");values=parts.map(Number);}
  if(values.length!==INPUT.featureCount||values.some(v=>!Number.isFinite(v)))return this.fail("수집할 때와 같은 순서·개수로 입력해 주세요.");
  this.classify(INPUT.axes.map((axis,i)=>{const [low,high]=INPUT.ranges[i];return Math.abs(high-low)<1e-9?0:(values[axis]-low)/(high-low)*1.8-.9;}));
 }
 pixels(source,mirror){const w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height,side=Math.min(w,h);if(!side)throw Error("영상을 기다려 주세요.");
  const original=document.createElement("canvas");original.width=224;original.height=224;const c=original.getContext("2d");c.fillStyle="white";c.fillRect(0,0,224,224);if(mirror){c.translate(224,0);c.scale(-1,1);}c.drawImage(source,(w-side)/2,(h-side)/2,side,side,0,0,224,224);
  const small=document.createElement("canvas");small.width=14;small.height=14;const ctx=small.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(original,0,0,14,14);const data=ctx.getImageData(0,0,14,14).data,values=[];for(let i=0;i<data.length;i+=4)values.push(Math.max(0,Math.min(1,(1-(.299*data[i]+.587*data[i+1]+.114*data[i+2])/255)*data[i+3]/255)));return values;
 }
 async camera(){if(this.stream)return;const token=++this.token;try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false});if(token!==this.token){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
  this.panel=document.createElement("div");this.panel.style.cssText="position:fixed;right:16px;bottom:16px;z-index:99999;background:white;padding:10px;border:1px solid #ccd2dc;border-radius:12px;width:220px";
  const title=document.createElement("span");title.textContent="모델이 보는 중앙 정사각형";this.panel.append(title);this.video=document.createElement("video");this.video.muted=true;this.video.playsInline=true;this.video.style.cssText="width:200px;height:200px;object-fit:cover;transform:scaleX(-1)";this.video.srcObject=stream;this.panel.append(this.video);const close=document.createElement("button");close.textContent="카메라 끄기";close.onclick=()=>this.stop();this.panel.append(close);document.body.append(this.panel);await this.video.play();this.status="카메라 준비";
 }catch(e){this.stop();this.fail("카메라 권한을 확인해 주세요.");}}
 cameraClassify(){try{if(!this.video||!this.stream)return this.fail("먼저 카메라를 켜 주세요.");this.classify(this.pixels(this.video,true));}catch(e){this.fail(String(e.message));}}
 file(){const picker=document.createElement("input");picker.type="file";picker.accept="image/*";picker.onchange=()=>{const f=picker.files&&picker.files[0];if(!f)return;const url=URL.createObjectURL(f),img=new Image();img.onload=()=>{try{this.classify(this.pixels(img,false));}finally{URL.revokeObjectURL(url);}};img.onerror=()=>{URL.revokeObjectURL(url);this.fail("그림 파일을 열지 못했습니다.");};img.src=url;};picker.click();}
 async repeat({SECONDS}){clearInterval(this.clock);this.clock=0;await this.camera();if(this.stream){this.cameraClassify();this.clock=setInterval(()=>this.cameraClassify(),Math.max(.2,Number(SECONDS)||1)*1000);}}
 stop(){this.token++;clearInterval(this.clock);this.clock=0;if(this.stream)this.stream.getTracks().forEach(t=>t.stop());this.stream=null;if(this.panel)this.panel.remove();this.panel=null;this.video=null;this.fail("멈춤");}
 label(){return this.answer;} confidence({LABEL}){return this.scores[LABELS.indexOf(String(LABEL))]||0;}
 detected(args){return this.status==="분류 완료"&&this.answer===String(args.LABEL)&&this.confidence(args)>=this.threshold;}
 whenLabel(args){return this.detected(args);}setThreshold({VALUE}){this.threshold=Math.max(0,Math.min(1,Number(VALUE)||0));}state(){return this.status;}
}
Scratch.extensions.register(new NeuralLab());
})(Scratch);
`;
}
