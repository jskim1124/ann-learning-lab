/** Deliberate 1D teaching landscape, NOT a measurement of the learner's network. */
export const exampleLoss=(x:number)=>(x*x-1)**2+.35*x+1;
export const exampleGradient=(x:number)=>4*x*(x*x-1)+.35;
export function descentTrace(start:number):number[]{const points=[start];for(let i=0;i<100;i++)points.push(points.at(-1)!-.04*exampleGradient(points.at(-1)!));return points;}
export function exampleMinima():number[]{
  return [[-1.5,-.5],[.5,1.5]].map(([left,right])=>{let a=left!,b=right!;for(let i=0;i<60;i++){const m=(a+b)/2;if(exampleGradient(m)>0)b=m;else a=m;}return(a+b)/2;});
}
