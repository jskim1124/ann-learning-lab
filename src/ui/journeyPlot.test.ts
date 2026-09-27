import { describe, expect, it } from 'vitest';
import { JOURNEY_MARGIN as m, journeyCoordinate, renderJourneyPlot } from './journeyPlot';
import { journeyModel } from '../core/understandingJourney';

describe('responsive journey graph',()=>{
  it.each([[694,280],[450,340],[400,270],[320,150]])('keeps pointer and plotted coordinates aligned at %s × %s',(width,height)=>{
    for(const [x,y] of [[0,0],[.75,.25],[1,1]]){
      const px=m.left+x!*(width-m.left-m.right),py=height-m.bottom-y!*(height-m.top-m.bottom);
      const point=journeyCoordinate(px,py,width,height);
      expect(point[0]).toBeCloseTo(x!);expect(point[1]).toBeCloseTo(y!);
    }
  });
  it('bounds a touch outside the axes',()=>{
    expect(journeyCoordinate(-10,-10,400,300)).toEqual([0,1]);
    expect(journeyCoordinate(450,350,400,300)).toEqual([1,0]);
  });
  it('uses the same margins in the rendered graph',()=>{
    const markup=renderJourneyPlot({width:400,height:280,scene:3,separated:1,cursor:[.75,.25],located:false,threshold:0,oldThreshold:null,selected:0,model:journeyModel(),frame:0,solved:false});
    expect(markup).toContain(`x="${m.left}" y="${m.top}" width="304" height="210"`);
    expect(markup).toContain('cx="296" cy="183.5"');
  });
});
