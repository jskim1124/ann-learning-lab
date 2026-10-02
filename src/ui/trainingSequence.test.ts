import {it,expect} from 'vitest';
import {trainingStage,trainingAllowed,renderTrainingSequence} from './trainingSequence';
it('uses ten-epoch batches ten times, then a hundred, then free training',()=>{
 for(let i=0;i<100;i+=10){expect(trainingAllowed(i,10)).toBe(true);expect(trainingAllowed(i,1)).toBe(false);expect(trainingAllowed(i,100)).toBe(false);expect(trainingAllowed(i,'auto')).toBe(false);}
 expect(trainingStage(100)).toBe('hundred');expect(trainingAllowed(100,100)).toBe(true);expect(trainingAllowed(100,'auto')).toBe(false);
 expect(trainingStage(200)).toBe('free');expect(trainingAllowed(200,'auto')).toBe(true);
 const buttons=Array.from({length:4},()=>document.createElement('button'));
 renderTrainingSequence(buttons[0]!,buttons[1]!,buttons[2]!,buttons[3]!,0);
 expect(buttons[0]!.textContent).toBe('10번 학습');expect(buttons[2]!.textContent).toBe('100번 학습');
});
