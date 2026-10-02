import { currentResearchContext, recordResearch, researchIsObserved, researchObservationGeneration } from './bus';
import type { Action, EventContext, Payload } from './schema';

const controlSelector='button,a,summary,select,input,textarea,canvas,[role=slider],[data-network-neuron]';
const safe=/^[a-zA-Z0-9_.:-]{1,90}$/;
const indexedAttributes=new Set(['data-preset','data-teachable','data-go-step','data-source','data-pane','data-select-class','data-sample','data-select-image-class','data-image-sample','data-explore-chapter','data-neuron','data-network-neuron','data-image-input','data-custom-input','data-custom-value','data-knob','data-parameter','data-feature','data-layer','data-guess']);
interface Target { element:HTMLElement; payload:Payload; context:EventContext; }
interface Gesture { target:Target; id:string; start:number; lastPosition:string; count:number; pointerId:number; owner:string; }

/** Structural locator only: never button text, class names, aria labels, input contents, or URLs. */
export function interactionElementId(element:HTMLElement):string {
  if(element.id&&safe.test(element.id))return element.id;
  const attribute=Array.from(element.attributes).find(a=>a.name.startsWith('data-')&&!a.name.startsWith('data-private'));
  let part=element.tagName.toLowerCase();
  if(attribute){part=attribute.name;if(indexedAttributes.has(attribute.name)&&safe.test(attribute.value))part+=`:${attribute.value}`;}
  const scope=element.closest<HTMLElement>('[id],[data-app-page],[data-research-page]');
  const siblings=element.parentElement?Array.from(element.parentElement.children).filter(n=>n.tagName===element.tagName):[];
  return `${scope?.id||scope?.dataset.appPage||scope?.dataset.researchPage||'shell'}:${part}:${Math.max(0,siblings.indexOf(element))}`.slice(0,90);
}
function numeric(el:HTMLElement):Payload {
  // Research/authentication fields are excluded by locate(), not logged as UI inputs.
  if(el instanceof HTMLInputElement&&['range','number'].includes(el.type)){
    const empty=el.value==='',valid=!empty&&Number.isFinite(el.valueAsNumber);
    return {...(valid?{value:el.valueAsNumber}:{}),empty,valid};
  }
  if(el instanceof HTMLInputElement&&['checkbox','radio'].includes(el.type))return {enabled:el.checked};
  if(el instanceof HTMLSelectElement)return {optionIndex:el.selectedIndex};
  return {};
}
function locate(event:Event):Target|null {
  const node=event.target instanceof Element?event.target.closest<HTMLElement>(controlSelector):null;
  if(!node||node.closest('.research-dialog,.research-header,[data-private-log]')||node.closest('[hidden]'))return null;
  // Log that a text/file control was used, never its content.
  const page=node.closest<HTMLElement>('[data-app-page],[data-research-page]');
  const current=currentResearchContext(),context={...current,page:page?.dataset.researchPage??page?.dataset.appPage??current.page};
  const scene=node.closest<HTMLElement>('[data-chapter]')?.dataset.chapter;
  return {element:node,context,payload:{traceVersion:'ui-v1',elementId:interactionElementId(node),control:node.tagName.toLowerCase(),...(scene!==undefined?{scene:Number(scene)}:{})}};
}
function coordinates(target:Target,e:PointerEvent):Payload {
  const el=target.element;
  const isSlider=el instanceof HTMLInputElement&&el.type==='range';
  const isPlot=el.matches('#modelCanvas,#featureModelCanvas,#imageMap,.explore-map canvas,.journey-plot canvas');
  if(!isSlider&&!isPlot)return {coordinatesOmitted:true};
  const r=el.getBoundingClientRect();
  return {coordinateSpace:'element-fraction',positionX:r.width?(e.clientX-r.left)/r.width:0,positionY:r.height?(e.clientY-r.top)/r.height:0};
}

/** Raw low-level actions supplement semantic/model events; no inferred learning indicators.
 * Every delivered changed graph/slider position is retained, never drawing strokes.
 * Capture phase preserves the source page before a click navigates or rerenders it.
 */
export function instrumentInteractions(root:Document=document):()=>void {
  let gesture:Gesture|null=null;
  const previous=new Map<string,Payload>();
  let generation=researchObservationGeneration();
  const active=()=>{const next=researchObservationGeneration();if(next!==generation){gesture=null;previous.clear();generation=next;}return researchIsObserved();};
  const emit=(action:Action,t:Target,p:Payload={})=>recordResearch(action,{...t.payload,...p},t.context);
  const click=(e:Event)=>{if(!active())return;const t=locate(e);if(t)emit('ui_click',t,numeric(t.element));};
  const focus=(e:Event)=>{if(!active())return;const t=locate(e);if(t)previous.set(String(t.payload.elementId),numeric(t.element));};
  const change=(e:Event)=>{
    if(!active())return;const t=locate(e);if(!t)return;
    const key=String(t.payload.elementId),before=previous.get(key),after=numeric(t.element);
    if(gesture&&gesture.target.payload.elementId===t.payload.elementId)gesture.target.element=t.element;
    emit(e.type==='input'?'ui_input':'ui_change',t,{...after,...(typeof before?.value==='number'?{previous:before.value}:{}),...(gesture&&gesture.target.payload.elementId===t.payload.elementId?{gestureId:gesture.id}:{})});if(previous.size>5000)previous.clear();previous.set(key,after);
  };
  const down=(event:Event)=>{
    if(!active()){gesture=null;return;}const e=event as PointerEvent,t=locate(e);if(!t||!(t.element.matches('canvas,input[type=range],[role=slider]')))return;
    const now=performance.now();gesture={target:t,id:crypto.randomUUID(),start:now,lastPosition:JSON.stringify(coordinates(t,e)),count:0,pointerId:e.pointerId,owner:currentResearchContext().workspaceId};
    previous.set(String(t.payload.elementId),numeric(t.element));emit('ui_pointer_start',t,{gestureId:gesture.id,pointerType:safe.test(e.pointerType)?e.pointerType:'unknown',...numeric(t.element),...coordinates(t,e)});
  };
  const move=(event:Event)=>{
    if(!active())return;
    const g=gesture,e=event as PointerEvent;if(!g||g.pointerId!==e.pointerId)return;
    if(!researchIsObserved()||g.owner!==currentResearchContext().workspaceId){gesture=null;return;}
    g.count++;const position=coordinates(g.target,e);if(position.coordinatesOmitted)return;
    const key=JSON.stringify(position);if(key===g.lastPosition)return;g.lastPosition=key;
    emit('ui_pointer_move',g.target,{gestureId:g.id,durationMs:performance.now()-g.start,...numeric(g.target.element),...position});
  };
  const end=(event:Event)=>{
    if(!active())return;
    const g=gesture,e=event as PointerEvent;if(!g||g.pointerId!==e.pointerId)return;gesture=null;
    if(!researchIsObserved()||g.owner!==currentResearchContext().workspaceId)return;
    emit('ui_pointer_end',g.target,{gestureId:g.id,durationMs:performance.now()-g.start,pointerSamples:g.count,cancelled:e.type==='pointercancel',...numeric(g.target.element),...coordinates(g.target,e)});
  };
  const registrations:[string,EventListener][]=[['click',click],['focusin',focus],['input',change],['change',change],['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end]];
  registrations.forEach(([type,fn])=>root.addEventListener(type,fn,true));return()=>{registrations.forEach(([type,fn])=>root.removeEventListener(type,fn,true));gesture=null;previous.clear();};
}
