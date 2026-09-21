import type {ImageLabStore} from '../state/imageLabStore';
/** Feature creation belongs to the real-data workspace, not the common teaching example. */
export function installImageFeatureEditor(host:HTMLElement,store:ImageLabStore,message:(text:string)=>void):void {
  const button=document.createElement('button');button.textContent='+ 특징 만들기';button.className='practice-feature-create';host.append(button);
  const dialog=document.createElement('dialog');dialog.className='practice-feature-editor';dialog.setAttribute('aria-label','새 그림 특징 만들기');
  dialog.innerHTML='<header><h2>계산에 넣을 칸을 골라요</h2><button data-feature-close aria-label="특징 만들기 닫기">×</button></header><p>주황은 더하기 · 보라는 빼기 · 흰 칸은 제외</p><label>특징 이름<input maxlength="18" aria-label="새 특징 이름"></label><div class="feature-brush"><button data-feature-brush="1" aria-pressed="true">+1.00</button><button data-feature-brush="-1" aria-pressed="false">−1.00</button><button data-feature-brush="0" aria-pressed="false">지우기</button></div><div class="practice-feature-grid"></div><p role="status"></p><button data-feature-save>특징에 추가</button>';
  const weights=Array<number>(196).fill(0);let brush=1,drag=false;
  dialog.querySelector('.practice-feature-grid')!.innerHTML=weights.map((_,i)=>`<button data-feature-cell="${i}" aria-label="${Math.floor(i/14)+1}행 ${i%14+1}열 제외"></button>`).join('');
  document.body.append(dialog);
  const paint=(target:Element|null)=>{const cell=target?.closest<HTMLButtonElement>('[data-feature-cell]');if(!cell)return;const i=Number(cell.dataset.featureCell);weights[i]=brush;cell.style.background=brush===1?'#f17605':brush===-1?'#7446f5':'white';cell.setAttribute('aria-label',`${Math.floor(i/14)+1}행 ${i%14+1}열 ${brush===1?'더하기':brush===-1?'빼기':'제외'}`);};
  button.addEventListener('click',()=>dialog.showModal());
  dialog.addEventListener('pointerdown',e=>{drag=true;paint(e.target as Element);});dialog.addEventListener('pointerover',e=>{if(drag)paint(e.target as Element);});for(const type of ['pointerup','pointercancel','pointerleave'])dialog.addEventListener(type,()=>drag=false);
  dialog.addEventListener('click',event=>{const target=(event.target as Element).closest<HTMLElement>('button');if(!target)return;
    if(target.dataset.featureClose!==undefined)dialog.close();
    if(target.dataset.featureCell!==undefined)paint(target);
    if(target.dataset.featureBrush!==undefined){brush=Number(target.dataset.featureBrush);dialog.querySelectorAll<HTMLElement>('[data-feature-brush]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.featureBrush)===brush)));}
    if(target.dataset.featureSave!==undefined){const name=dialog.querySelector('input')!.value;const error=store.addFeature(name,weights);dialog.querySelector('[role=status]')!.textContent=error??'';if(!error){dialog.close();message('특징을 추가했어요. 가로·세로 목록에서 골라 보세요.');}}
  });
}
