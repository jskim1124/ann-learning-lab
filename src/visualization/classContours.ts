export interface ScorePoint { x:number; y:number; scores:number[]; }
export type ContourSegment = [{x:number;y:number},{x:number;y:number}];
/** Piecewise-linear multiclass contours, clipped where either class is actually the winner. */
export function classContours(corners:[ScorePoint,ScorePoint,ScorePoint,ScorePoint]):ContourSegment[]{
  const segments:ContourSegment[]=[];
  const mix=(a:ScorePoint,b:ScorePoint,t:number):ScorePoint=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,scores:a.scores.map((v,i)=>v+(b.scores[i]!-v)*t)});
  for(const triangle of [[corners[0],corners[1],corners[2]],[corners[0],corners[2],corners[3]]]){
    for(let a=0;a<corners[0].scores.length;a++)for(let b=a+1;b<corners[0].scores.length;b++){
      const hits:ScorePoint[]=[];
      for(let e=0;e<3;e++){const p=triangle[e]!,q=triangle[(e+1)%3]!,d=p.scores[a]!-p.scores[b]!,f=q.scores[a]!-q.scores[b]!;
        if((d>=0)!==(f>=0))hits.push(mix(p,q,d/(d-f)));
      }
      if(hits.length!==2)continue;
      const p=hits[0]!,q=hits[1]!;let low=0,high=1;
      for(let k=0;k<p.scores.length;k++){if(k===a||k===b)continue;const d=p.scores[a]!-p.scores[k]!,f=q.scores[a]!-q.scores[k]!;
        if(d<0&&f<0){high=-1;break;}if((d>=0)!==(f>=0)){const t=d/(d-f);if(d<0)low=Math.max(low,t);else high=Math.min(high,t);}
      }
      if(high>low)segments.push([mix(p,q,low),mix(p,q,high)]);
    }
  }
  return segments;
}
