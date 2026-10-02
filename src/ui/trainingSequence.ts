/** One epoch means one pass over the current training set, not a click or a sample. */
export function trainingStage(epoch:number):'single'|'hundred'|'free' {
  return epoch<100?'single':epoch<200?'hundred':'free';
}
export function trainingAllowed(epoch:number,count:number|'auto'):boolean {
  const stage=trainingStage(epoch);
  return count===10||stage==='free'||stage==='hundred'&&count===100;
}
export function renderTrainingSequence(one:HTMLButtonElement,ten:HTMLButtonElement,hundred:HTMLButtonElement,auto:HTMLButtonElement,epoch:number):void {
  const stage=trainingStage(epoch);
  one.textContent='10번 학습';
  one.title=stage==='single'?`10번 학습을 ${Math.min(10,Math.floor(epoch/10))}/10회 실행했어요.`:'';
  hundred.textContent='100번 학습';
  ten.hidden=true;
  hundred.disabled=!trainingAllowed(epoch,100);
  auto.disabled=!trainingAllowed(epoch,'auto');
  hundred.title=stage==='single'?'10번 학습을 10회 해 본 뒤 열립니다.':'';
  auto.title=stage!=='free'?'100번 학습한 뒤 자유롭게 계속합니다.':'';
}
