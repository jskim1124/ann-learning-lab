import {afterEach,describe,expect,it,vi} from 'vitest';
import {revealModelPanel,workspacePanels} from './workspacePanels';

describe('tablet workspace navigation',()=>{
  afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();});
  it.each([768,1024,1200,1366])('reveals the training model pane at %s px',width=>{
    vi.spyOn(window,'innerWidth','get').mockReturnValue(width);
    const root=document.createElement('main');
    root.innerHTML='<div class="image-train"><section>Graph</section><section>Model</section></div>';
    document.body.append(root);
    const panels=[...root.querySelectorAll('section')];
    const redraw=vi.fn();workspacePanels(root,panels,['학습 지도','모델 살펴보기'],redraw);
    revealModelPanel(root);
    expect(panels[0]!.classList.contains('workspace-pane-hidden')).toBe(true);
    expect(panels[1]!.classList.contains('workspace-pane-hidden')).toBe(false);
    expect(root.querySelectorAll('button')[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(redraw).toHaveBeenCalledOnce();
  });
  it('does not switch ordinary collection panes at landscape desktop width',()=>{
    vi.spyOn(window,'innerWidth','get').mockReturnValue(1024);
    const root=document.createElement('main');root.innerHTML='<section>Capture</section><section>Data</section>';
    document.body.append(root);const redraw=vi.fn();
    workspacePanels(root,[...root.querySelectorAll('section')],['Capture','Data'],redraw);
    revealModelPanel(root);expect(redraw).not.toHaveBeenCalled();
  });
});
