// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {predictionEvidence} from './predictionEvidence';
import {forwardPixels,type PixelModel} from '../core/pixelNetwork';
import {classificationReadout} from '../core/trainingEvidence';
import {withParameter} from '../core/explorationLearning';

const model:PixelModel={inputSize:2,hiddenUnits:1,classCount:3,epoch:0,activation:'relu',inputHidden:[[1,0]],hiddenBias:[0],hiddenOutput:[[1],[-1],[0]],outputBias:[0,0,0]};
const rows=[{pixels:[.5,.2],label:0},{pixels:[-.5,.2],label:1},{pixels:[1,-.2],label:2}];
function render(expanded=false){const root=document.createElement('div');root.innerHTML=predictionEvidence(model,withParameter(model,0,'bias',-.1),rows,0,0,'bias',['A','B','C'],'줄이는 방향',expanded);return root;}

describe('그래프에서 읽는 예측 근거',()=>{
  it('세 후보의 × 개수와 막대는 실제 모델 결과다',()=>{
    const root=render(),counts=[...root.querySelectorAll('.prediction-comparison b')].map(e=>e.textContent);
    expect(counts).toEqual([-.1,0,.1].map(v=>`× ${classificationReadout(withParameter(model,0,'bias',v),rows).wrong}개`));
    expect(root.querySelector('progress')!.value).toBeCloseTo(forwardPixels(model,rows[0]!.pixels).probabilities[0]!*100,10);
    expect(root.textContent).not.toContain('출발 100');
  });
  it('간단한 식과 실제 계산은 기본적으로 접혀 있으며 사용자가 열면 유지한다',()=>{
    expect(render().querySelector('details')!.open).toBe(false);expect(render(true).querySelector('details')!.open).toBe(true);
    expect(render().textContent).toContain('0.50 × (1.00) + 0.20 × (0.00) + (0.00) = 0.50');
    expect(render().textContent).toContain('선까지의 거리가 아니');expect(render().textContent).toContain('다른 점은 반대로 변할 수도');
  });
  it('학습자가 만든 클래스 이름은 HTML로 실행되지 않는다',()=>{
    const root=document.createElement('div');root.innerHTML=predictionEvidence(model,model,rows,0,0,'bias',['<img src=x onerror=alert(1)>','B','C'],'<script>bad</script>');
    expect(root.querySelector('img,script')).toBeNull();expect(root.textContent).toContain('<img');
    expect(predictionEvidence(model,model,[],0,0,'bias',[],'')).toContain('자료를 먼저');
  });
});
