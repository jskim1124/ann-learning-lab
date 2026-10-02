import type { CustomDatasetDraft } from '../data/customDataset';
import { researchIsObserved, researchObservationGeneration } from './bus';
import { recordStoreResearch } from './instrumentation';

/** Original numeric columns, including spreadsheet imports; never free-text names/content.
 * Changes only, scoped to the model workspace and the active consent session.
 */
export function createNumericDatasetRecorder() {
  let generation=-1;
  let previous=new Map<number,string>();
  let axes='';
  return (store:object,draft:CustomDatasetDraft):void=>{
    if(!researchIsObserved())return;
    const nextGeneration=researchObservationGeneration();
    const first=generation!==nextGeneration;
    if(first){previous.clear();axes='';generation=nextGeneration;}
    const next=new Map<number,string>();
    for(const row of draft.rows){
      const value=JSON.stringify([draft.inputKind,row.label,row.values]);next.set(row.id,value);
      if(previous.get(row.id)!==value)recordStoreResearch(store,'data_value',{
        operation:first?'snapshot':previous.has(row.id)?'update':'add',source:draft.inputKind,
        sampleId:row.id,label:row.label,values:[...row.values],
      });
    }
    for(const id of previous.keys())if(!next.has(id))recordStoreResearch(store,'data_value',{operation:'remove',sampleId:id});
    const selected=`${draft.xFeature}:${draft.yFeature}`;
    if(axes!==selected)recordStoreResearch(store,'feature_change',{featureX:String(draft.xFeature),featureY:String(draft.yFeature),source:draft.inputKind});
    previous=next;axes=selected;
  };
}
