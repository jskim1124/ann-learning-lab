import {afterEach,describe,expect,it,vi} from 'vitest';
import {organizePracticeStage,revealModelPanel,workspacePanels} from './workspacePanels';

describe('tablet workspace navigation',()=>{
  afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();});
  it.each([768,1024,1200,1366,1440,1920])('reveals the model when pane tabs are shown, even at %s px',width=>{
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
  it('does not switch panes when the responsive tabs are hidden',()=>{
    vi.spyOn(window,'innerWidth','get').mockReturnValue(1024);
    const root=document.createElement('main');root.innerHTML='<section>Capture</section><section>Data</section>';
    document.body.append(root);const redraw=vi.fn();
    workspacePanels(root,[...root.querySelectorAll('section')],['Capture','Data'],redraw);
    root.querySelector<HTMLElement>('nav')!.style.display='none';
    revealModelPanel(root);expect(redraw).not.toHaveBeenCalled();
  });
  it.each(['numeric','image'])('gives the %s plot a separate viewport without replacing interactive elements',kind=>{
    const root=document.createElement('div');root.innerHTML=`<section class="image-results-panel"><div class="practice-readouts"><input type="range"></div><div class="practice-selected-input">Selected</div>${kind==='numeric'?'<div class="stage-toolbar">Layers</div><div class="model-canvas"><div class="training-motion">Motion</div><canvas id="testMap"></canvas><span class="axis-x">X</span></div><div class="trainer"><button>Train</button></div><div class="loss-strip"><canvas></canvas></div>':'<div class="training-motion">Motion</div><canvas id="imageMap"></canvas><div id="imageMapControls">Layers</div><div class="image-trainer"><button>Train</button></div><div class="image-loss"><canvas></canvas></div>'}</section>`;
    const canvas=root.querySelector('canvas'),button=root.querySelector('button')!,changed=vi.fn();button.addEventListener('click',changed);
    organizePracticeStage(root);organizePracticeStage(root);
    expect(root.querySelectorAll('.practice-plot-area')).toHaveLength(1);
    expect(root.querySelector('.practice-plot-viewport canvas')).toBe(canvas);
    expect(root.querySelector('.practice-control-rail .training-motion')).not.toBeNull();
    expect(root.querySelector('.practice-plot-area .practice-readouts')).toBeNull();
    expect(root.querySelector('.practice-control-rail .practice-readouts')).not.toBeNull();
    expect(root.querySelector('.practice-control-rail .loss-strip, .practice-control-rail .image-loss')).not.toBeNull();
    button.click();expect(changed).toHaveBeenCalledOnce();
  });
});
