import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { ComparisonWorkspace } from './comparison';
import { currentResearchContext,researchContext } from './bus';
vi.mock('../core/imageInput',()=>({IMAGE_INPUTS:196,captureImage:()=>({pixels:Array(196).fill(.1),image:'data:image/jpeg;base64,test'})}));
let workspace:ComparisonWorkspace;
beforeEach(()=>{document.body.innerHTML='';vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect:vi.fn()} as unknown as CanvasRenderingContext2D);HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};workspace=new ComparisonWorkspace(vi.fn());workspace.open();});
afterEach(()=>{workspace.close();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('TM-style image baseline',()=>{
  it('only exposes data, training and prediction, not the understanding journey',()=>{
    expect(workspace.root.querySelector('.understanding-journey')).toBeNull();expect(workspace.root.querySelector('[data-feature]')).toBeNull();expect(workspace.root.querySelectorAll('[data-pane]')).toHaveLength(3);
    expect(workspace.store.snapshot.mode).toBe('pixels');expect(workspace.store.snapshot.model.hiddenUnits).toBe(16);expect(workspace.root.textContent).toContain('Google Teachable Machine의 모델과는 다릅니다.');
    expect(workspace.root.querySelector('[data-epochs],[data-rate],[data-hidden-units]')).toBeNull();
    expect(workspace.root.tagName).toBe('SECTION');expect(workspace.isOpen).toBe(true);expect(workspace.root.textContent).not.toContain('이해 단계 없음');
  });
  it('keeps the input editor immediately below the selected class and marks its input type',()=>{
    const collector=workspace.root.querySelector('.comparison-capture')!;
    expect(collector.closest('.comparison-class')?.querySelector('[data-select-class]')?.getAttribute('data-select-class')).toBe('0');
    workspace.root.querySelector<HTMLButtonElement>('[data-select-class="1"]')!.click();
    expect(collector.closest('.comparison-class')?.querySelector('[data-select-class]')?.getAttribute('data-select-class')).toBe('1');
    workspace.root.querySelector<HTMLButtonElement>('[data-source="upload"]')!.click();
    expect(workspace.root.querySelector('[data-source="upload"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(workspace.root.querySelector<HTMLElement>('.comparison-upload')!.hidden).toBe(false);
    workspace.root.querySelector<HTMLButtonElement>('[data-source="drawing"]')!.click();
    expect(workspace.root.querySelector('[data-source="drawing"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(workspace.root.querySelector<HTMLElement>('.comparison-upload')!.hidden).toBe(true);
  });
  it('does not replace or detach the drawing canvas while its pixels change',()=>{
    const capture=workspace.root.querySelector('.comparison-capture')!,canvas=capture.querySelector('canvas');
    const parent=capture.parentNode,spy=vi.spyOn(capture,'remove');
    workspace.store.setInput(Array(196).fill(.5));workspace.store.setInput(Array(196).fill(.2));
    expect(spy).not.toHaveBeenCalled();expect(capture.parentNode).toBe(parent);expect(capture.querySelector('canvas')).toBe(canvas);
  });
  it('supports class creation and labeled sample addition, then clears drawing',()=>{
    const input=workspace.root.querySelector<HTMLInputElement>('[data-new-class]')!;input.value='test class';workspace.root.querySelector<HTMLButtonElement>('[data-add-class]')!.click();expect(workspace.store.snapshot.classes).toHaveLength(3);
    workspace.root.querySelector<HTMLButtonElement>('[data-capture]')!.click();expect(workspace.store.snapshot.data[0]!.label).toBe(2);expect(workspace.store.snapshot.selectedSample).toBeNull();
  });
  it('returns to the exact previous experimental context',()=>{workspace.close();researchContext({condition:'experimental',task:'omr',page:'3'});workspace.open();expect(currentResearchContext().condition).toBe('comparison');workspace.close();expect(currentResearchContext()).toMatchObject({condition:'experimental',task:'omr',page:'3'});});
  it('retains loaded task and real classes when switching to a builtin dataset',()=>{const select=workspace.root.querySelector<HTMLSelectElement>('[data-task]')!;select.value='omr';select.dispatchEvent(new Event('change',{bubbles:true}));expect(workspace.store.snapshot.classes).toHaveLength(5);expect(workspace.store.snapshot.data).toHaveLength(90);expect(workspace.store.snapshot.model.classCount).toBe(5);});
  it('renders the actual pixel input when a builtin sample has no original photo',()=>{
    const select=workspace.root.querySelector<HTMLSelectElement>('[data-task]')!;select.value='omr';select.dispatchEvent(new Event('change',{bubbles:true}));
    workspace.root.querySelector<HTMLButtonElement>('[data-sample]')!.click();
    expect(workspace.root.querySelector('[data-preview-image] canvas')).not.toBeNull();
    expect(workspace.store.snapshot.selectedSample).not.toBeNull();
  });
  it('locks data and training during import and discards late results after closing',async()=>{
    let finish!:()=>void;const decoding=new Promise<void>(resolve=>{finish=resolve;});
    vi.stubGlobal('Image',class {src='';decode(){return decoding;}});
    vi.stubGlobal('URL',Object.assign(class extends URL {},{createObjectURL:()=> 'blob:test',revokeObjectURL:vi.fn()}));
    const input=workspace.root.querySelector<HTMLInputElement>('[data-files]')!;
    Object.defineProperty(input,'files',{value:[new File(['test'],'example.png',{type:'image/png'})]});
    input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(workspace.root.querySelector<HTMLButtonElement>('[data-train]')!.disabled).toBe(true);
    expect(workspace.root.querySelector<HTMLSelectElement>('[data-task]')!.disabled).toBe(true);
    workspace.close();workspace.open();finish();await decoding;await Promise.resolve();
    expect(workspace.store.snapshot.data).toHaveLength(0);
    expect(workspace.root.querySelector<HTMLButtonElement>('[data-train]')!.disabled).toBe(false);
  });
  it('shows all real neurons during training without offering parameter controls',()=>{
    vi.useFakeTimers();
    try {
      const task=workspace.root.querySelector<HTMLSelectElement>('[data-task]')!;task.value='digits';task.dispatchEvent(new Event('change',{bubbles:true}));
      expect(workspace.root.querySelectorAll('[data-flow-neuron]')).toHaveLength(0);
      workspace.root.querySelector<HTMLButtonElement>('[data-train]')!.click();
      expect(workspace.root.dataset.pane).toBe('1');expect(workspace.root.querySelectorAll('[data-flow-neuron]')).toHaveLength(16);
      expect(workspace.root.querySelectorAll('[data-flow-boundary]')).toHaveLength(1);expect(workspace.root.querySelectorAll('[data-flow-wire]')).toHaveLength(64);expect(workspace.root.querySelector('[data-live-flow]')!.textContent).toContain('196칸 전체');
      const model=JSON.stringify(workspace.store.snapshot.model);
      workspace.root.querySelector<SVGGElement>('[data-flow-neuron="3"]')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(workspace.root.querySelector('[data-flow-neuron="3"]')!.getAttribute('aria-pressed')).toBe('true');expect(JSON.stringify(workspace.store.snapshot.model)).toBe(model);
      const sample=workspace.store.snapshot.data[3]!;workspace.root.querySelector<SVGGElement>(`[data-flow-sample="${sample.id}"]`)!.dispatchEvent(new MouseEvent('click',{bubbles:true}));expect(workspace.store.snapshot.selectedSample).toBe(sample.id);
      workspace.root.querySelector<HTMLButtonElement>('[data-pane="2"]')!.click();expect(workspace.root.dataset.pane).toBe('2');
      workspace.close();expect(vi.getTimerCount()).toBe(0);
    }finally{vi.useRealTimers();}
  });
});
