import type { ImageLabStore } from '../state/imageLabStore';
import type { FeatureLabStore } from '../state/featureLabStore';
import type { LabStore } from '../state/labStore';
import { evaluate, forward } from '../core/neuralNetwork';
import { projectPixels } from '../core/pixelProjection';
import { recordResearch, researchContext, researchIsObserved } from './bus';
import type { Action, EventContext, Payload } from './schema';

/** Instrument public commands, not rendering or arbitrary DOM content. Nested resets are one command. */
function commands(target: object, names: string[], around: (name:string,args:any[],run:()=>any)=>any):()=>void {
  const t=target as Record<string,any>, originals=new Map<string,Function>();let depth=0;
  for(const name of names){const original=t[name];if(typeof original!=='function')continue;originals.set(name,original);t[name]=function(...args:any[]){
    // Keep navigation context current, but do not compute/store extra research
    // predictions or numeric traces while collection is disabled.
    if(depth||!researchIsObserved()&&!['setPreset','setLessonStep'].includes(name))return original.apply(this,args);
    depth++;try{return around(name,args,()=>original.apply(this,args));}finally{depth--;}
  };}
  return ()=>originals.forEach((fn,name)=>t[name]=fn);
}
const classCounts=(data:Array<{label:number}>,count:number)=>Array.from({length:count},(_,i)=>data.filter(r=>r.label===i).length);
const contexts=new WeakMap<object,()=>Partial<EventContext>>();
export function recordStoreResearch(store:object,action:Action,payload:Payload):void {recordResearch(action,payload,contexts.get(store)?.()??{});}
export function instrumentImageStore(store:ImageLabStore,condition:'experimental'|'comparison'='experimental'):()=>void {
  const workspaceId=crypto.randomUUID();let datasetVersion=0,modelVersion=0;
  contexts.set(store,()=>({condition,task:store.snapshot.task,engine:store.snapshot.mode==='pixels'?'pixel-ann-196':'projected-ann-2',workspaceId,datasetVersion,modelVersion}));
  const inputIds=new Map<string,string>();
  const inputId=(pixels:number[])=>{const key=JSON.stringify(pixels);let id=inputIds.get(key);if(!id){if(inputIds.size>=1000)inputIds.delete(inputIds.keys().next().value!);id=crypto.randomUUID();inputIds.set(key,id);}return id;};
  const names=['configure','resetModel','setMode','setAxes','addFeature','setHiddenUnits','setRate','selectClass','renameClass','addClass','removeClass','setInput','addInput','removeSample','selectSample','loadSample','train','recordTest'];
  return commands(store,names,(name,args,run)=> {
    const before=store.snapshot,epoch=before.model.epoch,oldHidden=before.model.hiddenUnits,oldRate=before.rate,t=performance.now();const result=run();const s=store.snapshot;
    const patch:Partial<EventContext>={condition,task:s.task,engine:s.mode==='pixels'?'pixel-ann-196':'projected-ann-2',workspaceId,datasetVersion,modelVersion};
    if(typeof result==='string'){recordResearch('action_rejected',{operation:name,reason:'validation'},patch);return result;}
    let action:Action='config_change',payload:Payload={operation:name};
    if(name==='setInput'){
      if(before.inputSource===s.inputSource&&before.input.every((v,i)=>v===s.input[i]))return result;
      const {probabilities:p,hidden,logits}=store.predict(s.input),position=projectPixels(s.projection,s.input);
      action='prediction';payload={source:s.inputSource,probabilities:p,hidden,logits,x:position.x,y:position.y,predicted:p.indexOf(Math.max(...p)),trained:s.model.epoch>0,truthSource:'unknown',sampleToken:inputId(s.input)};
    }
    else if(['configure','addInput','removeSample','addClass','removeClass'].includes(name)){datasetVersion++;modelVersion++;action='dataset_change';payload={operation:name,count:s.data.length,classCount:s.classes.length,classCounts:classCounts(s.data,s.classes.length)};if(name==='addInput'){payload.label=before.selectedClass;payload.sampleId=s.data[0]!.id;payload.source=before.inputSource;payload.sampleToken=inputId(before.input);}if(name==='removeSample')payload.sampleId=args[0];if(name==='removeClass')payload.label=args[0];}
    else if(name==='train'){modelVersion++;action='training_batch';const m=store.metrics(),p=store.predict();payload={epochs:s.model.epoch-epoch,epoch:s.model.epoch,loss:m.loss,accuracy:m.accuracy,durationMs:performance.now()-t,hiddenUnits:s.model.hiddenUnits,classCounts:classCounts(s.data,s.classes.length),rate:s.rate,inputSize:s.model.inputSize,probabilities:p.probabilities,hidden:p.hidden,logits:p.logits,sampleId:s.selectedSample??-1};}
    else if(name==='recordTest'){const p=store.predict(s.input).probabilities,predicted=p.indexOf(Math.max(...p));action='test_record';payload={label:args[0],predicted,probabilities:p,correct:predicted===args[0],novel:true,truthSource:'learner-label',sampleToken:inputId(s.input),testCount:s.testCount,correctCount:s.testCorrect};}
    else if(name==='selectSample'||name==='loadSample'){action='sample_select';payload={sampleId:args[0]??-1};if(args[0]!==null){const f=store.focus(),p=store.predict().probabilities;payload={...payload,label:f.label,predicted:p.indexOf(Math.max(...p)),probabilities:p,trained:s.model.epoch>0,novel:false};}}
    else if(name==='selectClass'||name==='renameClass'){action='class_change';payload={operation:name,label:args[0]};}
    else if(name==='setAxes'||name==='addFeature'){action='feature_change';payload={operation:name,featureX:s.xFeature,featureY:s.yFeature};if(name==='setAxes')modelVersion++;}
    else if(name==='resetModel'){modelVersion++;action='model_reset';}
    else if(name==='setHiddenUnits'){modelVersion++;payload={parameter:'hiddenUnits',from:oldHidden,to:s.model.hiddenUnits};}
    else if(name==='setRate')payload={parameter:'learningRate',from:oldRate,to:s.rate};
    else if(name==='setMode'){modelVersion++;payload={mode:s.mode};}
    recordResearch(action,payload,{...patch,datasetVersion,modelVersion});
    if(name==='addFeature'){
      const feature=s.features.at(-1)!;
      for(let rowIndex=0;rowIndex<14;rowIndex++)recordResearch('feature_edit',{operation:'saved-row',featureX:feature.id,rowIndex,values:feature.weights.slice(rowIndex*14,(rowIndex+1)*14)},{...patch,datasetVersion,modelVersion});
    }
    return result;
  });
}
export function instrumentFeatureStore(store:FeatureLabStore):()=>void {
  const workspaceId=crypto.randomUUID();let datasetVersion=0,modelVersion=0;
  contexts.set(store,()=>({task:'custom',engine:'feature-ann-2',workspaceId,datasetVersion,modelVersion}));
  return commands(store,['setDataset','resetModel','train','setHiddenUnits','setActivation','setLearningRate','setTestInput','setLayers'],(name,args,run)=>{
    const before=store.snapshot,epoch=before.model.epoch,t=performance.now(),result=run(),s=store.snapshot;let action:Action='config_change',payload:Payload={operation:name};
    if(name==='setDataset'){datasetVersion++;modelVersion++;action='dataset_change';payload={operation:'replace',count:s.data.length,classCount:s.classes.length,classCounts:classCounts(s.data,s.classes.length)};}
    else if(name==='train'){modelVersion++;const m=store.metrics();action='training_batch';payload={epochs:s.model.epoch-epoch,epoch:s.model.epoch,loss:m.loss,accuracy:m.accuracy,durationMs:performance.now()-t,hiddenUnits:s.model.hiddenUnits,rate:s.learningRate,x:s.testInput.x,y:s.testInput.y,probabilities:store.probabilities()};}
    else if(name==='setTestInput'){action='prediction';payload={x:s.testInput.x,y:s.testInput.y,probabilities:store.probabilities(),trained:s.model.epoch>0,truthSource:'unknown'};}
    else if(name==='setLayers'){action='visualization_change';payload={operation:'layers',enabled:s.showDecisionBoundary,visible:s.showNeuronBoundaries};}
    else if(name==='resetModel'){modelVersion++;action='model_reset';}
    else if(name==='setHiddenUnits'){modelVersion++;payload={parameter:'hiddenUnits',from:before.model.hiddenUnits,to:s.model.hiddenUnits};}
    else if(name==='setActivation'){modelVersion++;payload={activation:s.model.activation};}
    else if(name==='setLearningRate')payload={parameter:'learningRate',from:before.learningRate,to:s.learningRate};
    recordResearch(action,payload,{task:'custom',engine:'feature-ann-2',workspaceId,datasetVersion,modelVersion});return result;
  });
}
export function instrumentLabStore(store:LabStore):()=>void {
  const workspaceId=crypto.randomUUID();let datasetVersion=0,modelVersion=0;
  contexts.set(store,()=>({task:store.snapshot.preset,engine:'binary-ann-2',workspaceId,datasetVersion,modelVersion}));
  researchContext({task:store.snapshot.preset,page:String(store.snapshot.lessonStep)});
  return commands(store,['setPreset','setLessonStep','addDataPoint','undoDataPoint','setConfig','resetModel','trainEpochs','setTestInput','setLayers','setSelectedNeuron','toggleAuto','stopAuto','importModel'],(name,args,run)=>{
    const before=store.snapshot,t=performance.now(),result=run(),s=store.snapshot;
    if(name==='setPreset'||name==='setLessonStep')researchContext({condition:'experimental',task:s.preset,page:String(s.lessonStep)});
    const patch={task:s.preset,engine:'binary-ann-2',workspaceId,datasetVersion,modelVersion};
    if(typeof result==='string'){recordResearch('action_rejected',{operation:name,reason:'validation'},patch);return result;}
    let action:Action='config_change',payload:Payload={operation:name};
    if(name==='setPreset'){action='task_select';datasetVersion++;modelVersion++;}
    else if(name==='setLessonStep'){action='page_view';payload={from:before.lessonStep,to:s.lessonStep};}
    else if(name==='addDataPoint'||name==='undoDataPoint'){action='dataset_change';datasetVersion++;modelVersion++;payload={operation:name,count:s.data.length,classCounts:classCounts(s.data,2)};if(name==='addDataPoint')Object.assign(payload,{x:args[0],y:args[1],label:args[2]??s.pointClass});}
    else if(name==='trainEpochs'){modelVersion++;const m=evaluate(s.model,s.data),p=forward(s.model,s.testInput.x,s.testInput.y);action='training_batch';payload={epoch:s.model.epoch,epochs:s.model.epoch-before.model.epoch,loss:m.loss??0,accuracy:m.accuracy??0,durationMs:performance.now()-t,hiddenUnits:s.model.config.hiddenUnits,rate:s.model.config.learningRate,x:s.testInput.x,y:s.testInput.y,probabilities:[1-p.probability,p.probability],hidden:p.hidden,logits:[p.logit]};}
    else if(name==='setConfig'){modelVersion++;payload={hiddenUnits:s.model.config.hiddenUnits,rate:s.model.config.learningRate,activation:s.model.config.activation};}
    else if(name==='resetModel'){modelVersion++;action='model_reset';}
    else if(name==='setTestInput'){const p=forward(s.model,s.testInput.x,s.testInput.y);action='prediction';payload={x:s.testInput.x,y:s.testInput.y,probabilities:[1-p.probability,p.probability],hidden:p.hidden,logits:[p.logit],trained:s.model.epoch>0,truthSource:'unknown'};}
    else if(name==='setLayers'||name==='setSelectedNeuron'){action='visualization_change';payload={operation:name,neuron:s.selectedNeuron,enabled:s.showDecisionBoundary,visible:s.showNeuronBoundaries};}
    else if(name==='toggleAuto'||name==='stopAuto'){action=s.autoTraining?'training_start':'training_stop';payload={epoch:s.model.epoch};}
    else if(name==='importModel'){datasetVersion++;modelVersion++;action='import_model';}
    recordResearch(action,payload,{...patch,datasetVersion,modelVersion});return result;
  });
}
/** A small explicit allowlist, never capture button text or generic input values. */
export function instrumentSurface(root:Document=document,stores?:{image:object;feature:object;binary:object}):()=>void {
  const listener=(event:Event)=>{
    const button=(event.target as Element)?.closest<HTMLElement>('button');if(!button)return;
    const key=button.id;
    if(/^(exportScratchProject|exportScratch|exportJson|featureExportScratch|featureExportExtension|featureExportJson|imageExportJson|imageExportSb3|imageExportExtension)$/.test(key)){
      const store=stores?.[key.startsWith('image')?'image':key.startsWith('feature')?'feature':'binary'];
      if(store)recordStoreResearch(store,'export_model',{operation:key});else recordResearch('export_model',{operation:key});
    }
    if(button.matches('[data-layer],[data-neuron],[data-signal-neuron]'))recordResearch('visualization_change',{operation:'select-layer-or-neuron'});
  };
  const change=(event:Event)=>{const el=event.target as HTMLInputElement;if(['imageLines','imageBoundary','boundaryNeuronLayer','boundaryDecisionLayer','featureNeuronLayer','featureDecisionLayer'].includes(el.id))recordResearch('visualization_change',{operation:el.id,enabled:el.checked});};
  root.addEventListener('click',listener);root.addEventListener('change',change);return()=>{root.removeEventListener('click',listener);root.removeEventListener('change',change);};
}
