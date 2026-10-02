import { evaluatePixelModel, forwardPixels, type PixelExample, type PixelModel } from './pixelNetwork';

/** Cross-entropy derivative for one hidden → class connection, averaged over data. */
export function outputWeightGradient(model:PixelModel,rows:PixelExample[],hidden:number,output:number):number {
  if(!rows.length)return 0;
  return rows.reduce((sum,row)=>{const f=forwardPixels(model,row.pixels);return sum+(f.probabilities[output]!-(row.label===output?1:0))*f.hidden[hidden]!;},0)/rows.length;
}

/** The same argmax rule as practice evaluation; these marks can be counted on the map. */
export function classificationReadout(model:PixelModel,rows:PixelExample[]) {
  const predictions=rows.map(row=>{const p=forwardPixels(model,row.pixels).probabilities;return p.indexOf(Math.max(...p));});
  const wrongIndices=predictions.flatMap((prediction,i)=>prediction===rows[i]!.label?[]:[i]);
  return {predictions,wrongIndices,total:rows.length,wrong:wrongIndices.length,correct:rows.length-wrongIndices.length};
}

/** Retain the real training objective, without inventing a baseline-100 score. */
export function trainingEvidence(before: PixelModel, after: PixelModel, rows: PixelExample[]) {
  const baseline = evaluatePixelModel(before, rows).loss;
  const loss = evaluatePixelModel(after, rows).loss;
  const result = loss < baseline - 1e-9 ? 'better' : loss > baseline + 1e-9 ? 'worse' : 'same';
  const examples = rows.map((row, index) => ({index, label: row.label,
    from: forwardPixels(before, row.pixels).probabilities[row.label]!,
    to: forwardPixels(after, row.pixels).probabilities[row.label]!}));
  return {baseline, loss, result, examples, before:classificationReadout(before,rows), after:classificationReadout(after,rows)};
}
