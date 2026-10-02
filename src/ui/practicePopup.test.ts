import {it,expect,vi} from 'vitest';
import {organizePracticeStage} from './workspacePanels';
import {updatePracticePopup} from './practicePopup';
it('점을 누르면 정답·예상을 보이고 X 후 모델을 다시 그려도 닫힘 상태를 유지한다',()=>{
  const root=document.createElement('div');root.innerHTML='<div class="image-train"><section class="image-results-panel"><canvas id="imageMap"></canvas></section><aside class="image-model-panel"></aside></div>';document.body.append(root);
  organizePracticeStage(root);const map=root.querySelector('canvas')!,popup=root.querySelector<HTMLElement>('.practice-point-popup')!;
  updatePracticePopup(root,[.2,.3],'④','②');expect(popup.hidden).toBe(true);
  map.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));updatePracticePopup(root,[.2,.3],'④','②');expect(popup.hidden).toBe(false);expect(popup.textContent).toContain('정답 ④ · 예상 ②');
  popup.querySelector<HTMLButtonElement>('button')!.click();updatePracticePopup(root,[.2,.3],'④','④');expect(popup.hidden).toBe(true);
  root.remove();vi.restoreAllMocks();
});
