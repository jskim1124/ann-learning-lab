import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { projectedPixelModel } from '../visualization/pixelLatentMap';
import type { PixelProjection } from '../core/pixelProjection';
import { classContours } from '../visualization/classContours';

const COLORS=['#f17605','#df466f','#7446f5','#1f6bd6','#1558b7','#a93658'];
const mix=(hex:string,amount:number)=>`rgb(${[1,3,5].map(i=>Math.round(255+(parseInt(hex.slice(i,i+2),16)-255)*Math.min(1,Math.max(0,amount)))).join(' ')})`;
/** An affine slice through the training mean, not predictions for projected photographs.
 * Exact identity: slice(x,y) = fullModel(reconstructProjectedPixels(projection,x,y)). */
export function sliceModel(model:PixelModel,projection:PixelProjection):PixelModel {return projectedPixelModel(model,projection);}
export function sliceHeatmap(model:PixelModel,neuron?:number,size=24):string {
  let svg='<rect width="100" height="100" fill="white"/>';
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const f=forwardPixels(model,[-1+2*(x+.5)/size,1-2*(y+.5)/size]);
    const h=neuron===undefined?0:f.hidden[neuron]!,winner=f.probabilities.indexOf(Math.max(...f.probabilities));
    const fill=neuron===undefined?mix(COLORS[winner%COLORS.length]!,f.probabilities[winner]!*.65):mix(h<0?'#f17605':'#1f6bd6',model.activation==='relu'?Math.abs(h)/(1+Math.abs(h)):Math.abs(h));
    svg+=`<rect x="${100*x/size}" y="${100*y/size}" width="${100/size+.2}" height="${100/size+.2}" fill="${fill}"/>`;
  }
  if(neuron===undefined){
    const grid=Array.from({length:size+1},(_,y)=>Array.from({length:size+1},(_,x)=>({x:x*100/size,y:y*100/size,scores:forwardPixels(model,[-1+2*x/size,1-2*y/size]).probabilities})));
    let path='';for(let y=0;y<size;y++)for(let x=0;x<size;x++)for(const [a,b]of classContours([grid[y]![x]!,grid[y]![x+1]!,grid[y+1]![x+1]!,grid[y+1]![x]!]))path+=`M${a.x} ${a.y}L${b.x} ${b.y}`;
    svg+=`<path d="${path}" fill="none" stroke="#202633" stroke-width="1.2"/>`;
  }
  return svg;
}
