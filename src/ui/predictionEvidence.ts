import {classificationReadout,trainingEvidence} from '../core/trainingEvidence';
import {forwardPixels,type PixelExample,type PixelModel} from '../core/pixelNetwork';
import {withParameter,parameterValue,type InputParameter} from '../core/explorationLearning';

const n=(v:number)=>Math.abs(v)<.005?'0.00':v.toFixed(2);
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Visible counts, a per-example probability bar, and opt-in exact arithmetic.
 * Counts/probability are observations, NOT a replacement training objective. */
export function predictionEvidence(model:PixelModel,before:PixelModel,rows:PixelExample[],index:number,neuron:number,parameter:InputParameter,classes:string[],direction:string,expanded=false):string {
  const row=rows[index];if(!row)return '<p>자료를 먼저 추가해 주세요.</p>';
  const e=trainingEvidence(before,model,rows),f=forwardPixels(model,row.pixels),old=forwardPixels(before,row.pixels);
  const value=parameterValue(model,neuron,parameter),p=f.probabilities[row.label]!,label=escape(classes[row.label]??String(row.label));
  const weights=model.inputHidden[neuron]!,sum=weights.reduce((a,w,i)=>a+w*row.pixels[i]!,model.hiddenBias[neuron]!);
  const max=Math.max(...f.logits),positive=f.logits.map(s=>Math.exp(s-max)),denominator=positive.reduce((a,b)=>a+b,0);
  const cards=[-.1,0,.1].map(delta=>{const result=classificationReadout(withParameter(model,neuron,parameter,value+delta),rows);return `<div class="${delta===0?'current':''}"><span>${n(value+delta)}${delta<0?'로 줄이면':delta>0?'로 늘리면':' 지금'}</span><b>× ${result.wrong}개</b></div>`;}).join('');
  return `<div class="training-evidence" data-result="${e.result}"><strong class="learning-direction">${escape(direction)}</strong><div class="prediction-comparison" aria-label="값에 따른 틀린 자료 수">${cards}</div>
    <div class="correct-share"><span>고른 점 · 정답 <b>${label}</b>에 준 몫</span><strong>${n(old.probabilities[row.label]!*100)}% → ${n(p*100)}%</strong><progress max="100" value="${p*100}" aria-label="정답 ${label}에 준 몫">${n(p*100)}%</progress></div>
    <details ${expanded?'open':''}><summary>그래프와 숫자는 어떻게 이어지나요?</summary>
      <p><b>틀린 자료 수 = × 표시가 있는 자료의 개수.</b> 점 색은 정답, 바탕색은 모델의 예상입니다. 같으면 맞힌 점, 다르면 ×를 표시합니다. 같은 좌표의 점은 겹칠 수 있지만 각각 셉니다. 동점일 때는 실제 모델과 같이 앞 순서의 답을 고릅니다.</p>
      <p><b>정답까지 부족한 몫 = 100% − 정답에 준 몫</b><br>이 점에서는 100% − ${n(p*100)}% = ${n((1-p)*100)}%예요. 막대에서 채우지 못한 부분입니다. 이것은 선까지의 거리가 아니에요.</p>
      <p><b>좌표 → 뉴런의 합 → 답별 점수 → 정답의 몫</b><br>뉴런 ${neuron+1}의 합: ${n(row.pixels[0]!)} × (${n(weights[0]!)}) + ${n(row.pixels[1]!)} × (${n(weights[1]!)}) + (${n(model.hiddenBias[neuron]!)}) = ${n(sum)}.<br>색 선은 이 합이 0인 자리입니다. 합은 ${n(f.hidden[neuron]!)}로 바뀌어 다음 연결로 갑니다. 출력들은 받은 값에 각자의 가중치를 곱해 더합니다.</p>
      <p>답별 점수는 음수일 수도 있어 그대로 비율로 나누지 않습니다. 실제 모델은 각 점수를 양수로 바꾼 뒤 나눠요: <b>정답의 몫 = 정답의 양수값 ÷ 모든 답의 양수값 합 × 100</b>.<br>${n(positive[row.label]!)} ÷ ${n(denominator)} × 100 = ${n(p*100)}%. 양수로 바꾸는 실제 식은 exp(답 점수 − 가장 큰 점수)입니다. 표시는 둘째 자리까지, 계산은 반올림 전 값으로 합니다.</p>
      <p><b>개수가 같아도 학습은 계속됩니다.</b> 정답에 준 몫까지 함께 보기 때문이에요. 실제 학습 기준은 L = −Σ ln(각 자료의 정답 몫) ÷ 자료 수입니다(몫은 0~1). 지금 ${n(e.loss)}예요. 화살표는 이 기준을 줄이는 실제 수정 방향입니다. 틀린 개수나 이 한 점의 몫만 보고 방향을 정하지 않습니다. 다른 점은 반대로 변할 수도 있어요. ±0.10은 비교용 변화이고 모델의 실제 수정 폭과 같지는 않아요.</p>
    </details></div>`;
}
