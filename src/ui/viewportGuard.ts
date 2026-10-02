/** Detect available space, not devicePixelRatio (which cannot identify browser zoom). */
export function viewportTooSmall(width:number,height:number):boolean { return width<650||height<500||(height<750&&width<760); }
export function installViewportGuard():void {
  if(document.querySelector('.viewport-guard'))return;
  const dialog=document.createElement('dialog');dialog.className='viewport-guard';
  dialog.innerHTML='<h2>학습 화면을 볼 공간이 부족해요</h2><p>창을 최대화하거나 <b>Ctrl + −</b>로 화면을 줄여 주세요. 너무 작아졌다면 <b>Ctrl + +</b>로 키울 수 있어요.</p><p>태블릿에서는 가로로 돌리거나 전체 화면으로 열어 주세요.</p><p data-viewport-size></p><button type="button">현재 크기로 계속 보기</button>';
  document.body.append(dialog);let dismissed=false;
  const check=()=>{const small=viewportTooSmall(window.innerWidth,window.innerHeight);dialog.querySelector('[data-viewport-size]')!.textContent=`현재 사용 가능한 화면: ${window.innerWidth} × ${window.innerHeight}`;if(!small){dismissed=false;if(dialog.open)dialog.close();}else if(!dismissed&&!dialog.open&&typeof dialog.showModal==='function')dialog.showModal();};
  dialog.querySelector('button')!.addEventListener('click',()=>{dismissed=true;dialog.close();});
  dialog.addEventListener('cancel',()=>{dismissed=true;});window.addEventListener('resize',check);check();
}
