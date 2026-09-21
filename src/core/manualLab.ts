import { forwardPixels, type PixelExample, type PixelModel } from './pixelNetwork';

export type ManualMission = 'move' | 'bend' | 'data';
export type ManualParameter = 'bias' | 'direction' | 'connection' | 'outputBias';
export interface ManualSource { data: PixelExample[]; classes: string[]; axes: [string, string]; note: string; }
export const MANUAL_DIRECTIONS: readonly [number, number][] = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
export const copyModel = (m: PixelModel): PixelModel => ({...m,inputHidden:m.inputHidden.map(r=>[...r]),hiddenBias:[...m.hiddenBias],hiddenOutput:m.hiddenOutput.map(r=>[...r]),outputBias:[...m.outputBias]});
export const roundManual = (v: number) => Math.round(v*100)/100;

/** Ties are unresolved, never awarded to the first class simply because of its index. */
export function manualPrediction(model: PixelModel, point: number[]): number | null {
  const {logits}=forwardPixels(model,point),top=Math.max(...logits);
  const winners=logits.map((v,i)=>Math.abs(v-top)<1e-9?i:-1).filter(i=>i>=0);
  return winners.length===1?winners[0]!:null;
}
export function manualScore(model: PixelModel, data: PixelExample[]): number {
  return data.filter(row=>manualPrediction(model,row.pixels)===row.label).length;
}
export function manualMissionSource(mission: ManualMission, source: ManualSource): ManualSource {
  if(mission==='data')return {...source,classes:[...source.classes],axes:[...source.axes],data:source.data.map(row=>({pixels:[...row.pixels],label:row.label}))};
  const rows: [number,number,number][] = mission==='move'
    ? [[-.75,-.5,0],[-.5,.5,0],[-.5,0,0],[.5,-.5,1],[.5,.5,1],[.75,0,1]]
    : [[-.5,-.5,0],[.25,0,0],[0,.25,0],[.75,-.5,1],[-.5,.75,1],[.5,.5,1]];
  return {data:rows.map(([x,y,label])=>({pixels:[x,y],label})),classes:['A','B'],axes:['가로','세로'],note:'계산을 쉽게 만든 작은 연습입니다. 원래 학습 자료와는 별개예요.'};
}

/** All knobs edit a real 2-input ReLU network. Nothing fits the boundary independently. */
export class ManualLab {
  readonly source: ManualSource;
  readonly initial: PixelModel;
  model: PixelModel;
  previous: PixelModel | undefined;
  selected=0;
  output=1;
  point: number[];
  pointIndex: number | null=0;
  muted: number | null=null;
  edits=0;
  calculations=0;
  outputCalculations=0;
  predictions=0;
  compared=false;
  best=0;
  private inGesture=false;
  private gestureEdited=false;
  readonly history: PixelModel[]=[];
  constructor(readonly mission: ManualMission, source: ManualSource) {
    this.source=manualMissionSource(mission,source);
    const count=this.source.classes.length;
    this.model={inputSize:2,hiddenUnits:1,classCount:count,epoch:0,activation:'relu',inputHidden:[[1,0]],hiddenBias:[mission==='move'?-.5:0],hiddenOutput:Array.from({length:count},(_,c)=>[c===0?0:1]),outputBias:Array.from({length:count},(_,c)=>c===0?0:-.5*c)};
    if(mission==='move')this.model.hiddenOutput[1]=[2];
    this.initial=copyModel(this.model);this.point=[...this.source.data[0]?.pixels??[.5,.5]];
    this.pointIndex=this.source.data.length?0:null;
    this.best=this.score;
  }
  get effective(): PixelModel {
    if(this.muted===null)return this.model;
    const m=copyModel(this.model);m.hiddenOutput.forEach(row=>{row[this.muted!]=0;});return m;
  }
  get score(): number {return manualScore(this.effective,this.source.data);}
  get won(): boolean {return this.source.data.length>0&&this.score===this.source.data.length;}
  beginGesture(): void {this.inGesture=true;this.gestureEdited=false;}
  endGesture(): void {this.inGesture=false;this.gestureEdited=false;}
  private record(): void {if(!this.inGesture||!this.gestureEdited){this.previous=copyModel(this.model);this.history.push(this.previous);if(this.history.length>60)this.history.shift();this.edits++;}this.gestureEdited=true;this.model=copyModel(this.model);this.muted=null;}
  edit(parameter: ManualParameter,value: number): void {
    if(!Number.isFinite(value))return;
    const bounded=roundManual(Math.max(-2,Math.min(2,value)));
    const direction=MANUAL_DIRECTIONS[Math.max(0,Math.min(7,Math.round(value)))]!;
    if(parameter==='direction'?this.model.inputHidden[this.selected]!.every((v,i)=>v===direction[i]):(parameter==='bias'?this.model.hiddenBias[this.selected]:parameter==='connection'?this.model.hiddenOutput[this.output]![this.selected]:this.model.outputBias[this.output])===bounded)return;
    this.record();
    if(parameter==='bias')this.model.hiddenBias[this.selected]=bounded;
    if(parameter==='direction')this.model.inputHidden[this.selected]=[...direction];
    if(parameter==='connection')this.model.hiddenOutput[this.output]![this.selected]=bounded;
    if(parameter==='outputBias')this.model.outputBias[this.output]=bounded;
    this.best=Math.max(this.best,this.score);
  }
  addNeuron(): void {
    if(this.model.hiddenUnits>=4)return;
    this.record();this.model.inputHidden.push([0,1]);this.model.hiddenBias.push(0);
    // Adding a disconnected neuron must preserve EVERY previous prediction.
    this.model.hiddenOutput.forEach(row=>row.push(0));this.model.hiddenUnits++;this.selected=this.model.hiddenUnits-1;
  }
  removeNeuron(): void {
    if(this.model.hiddenUnits<=1)return;
    this.record();this.model.inputHidden.splice(this.selected,1);this.model.hiddenBias.splice(this.selected,1);
    this.model.hiddenOutput.forEach(row=>row.splice(this.selected,1));this.model.hiddenUnits--;this.selected=Math.min(this.selected,this.model.hiddenUnits-1);
    this.best=Math.max(this.best,this.score);
  }
  undo(): void {const old=this.history.pop();if(!old)return;this.previous=copyModel(this.model);this.model=copyModel(old);this.muted=null;this.selected=Math.min(this.selected,this.model.hiddenUnits-1);}
  reset(): void {this.previous=undefined;this.model=copyModel(this.initial);this.selected=0;this.muted=null;this.edits=0;this.calculations=0;this.outputCalculations=0;this.predictions=0;this.compared=false;this.best=this.score;this.history.length=0;}
  choosePoint(point:number[],index:number|null): void {this.point=[...point];this.pointIndex=index;}
  get calculation() {
    const m=this.effective,w=m.inputHidden[this.selected]!,products=w.map((v,i)=>v*this.point[i]!);
    const sum=products.reduce((a,b)=>a+b,m.hiddenBias[this.selected]!);
    return {products,sum,answer:roundManual(Math.max(0,sum)),...forwardPixels(m,this.point)};
  }
  /** The prediction is about one named parameter and this point, not a universal learning direction. */
  biasPreview(delta=.25): {before:number;after:number} {
    const before=forwardPixels(this.model,this.point).logits[this.output]!,m=copyModel(this.model);
    m.hiddenBias[this.selected]=Math.min(2,m.hiddenBias[this.selected]!+delta);
    return {before,after:forwardPixels(m,this.point).logits[this.output]!};
  }
}
