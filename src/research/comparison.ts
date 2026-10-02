import { ImageLabStore, type ImageTask } from '../state/imageLabStore';
import { captureImage } from '../core/imageInput';
import { generateInferenceExtension } from '../export/inferenceExtension';
import { createPixelScratchProject } from '../export/pixelScratchProject';
import { downloadBlob, downloadText } from '../export/modelJson';
import { currentResearchContext, recordResearch, researchContext } from './bus';
import { instrumentImageStore, recordStoreResearch } from './instrumentation';
import type { EventContext } from './schema';
import { ComparisonFlow } from './comparisonFlow';
import './comparison.css';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const colors=['#f17605','#df466f','#7446f5','#1769d2','#a53d68'];

/** TM-style core image workflow, not Google's transfer-learning implementation. */
export class ComparisonWorkspace {
  readonly store=new ImageLabStore('custom');readonly root:HTMLElement;
  private previous:EventContext|null=null;private stream:MediaStream|null=null;private cameraToken=0;private timer=0;private cameraFrame=0;
  private drawing=false;private collecting=false;private training=false;private epochs=300;private page=0;private pane=0;
  private uploading=false;private uploadToken=0;
  private source:'drawing'|'webcam'|'upload'='drawing';private classRenderKey='';private capturePanel:HTMLElement;
  private canvas:HTMLCanvasElement;private video:HTMLVideoElement;
  private flow:ComparisonFlow;
  private classPageSize():number{return innerHeight<730?2:3;}
  get isOpen():boolean{return !this.root.hidden;}
  get lessonStep():number{return [2,4,5][this.pane]!;}
  constructor(private toast:(message:string)=>void,private onNavigate:()=>void=()=>{}) {
    instrumentImageStore(this.store,'comparison');
    this.root=document.createElement('section');this.root.hidden=true;this.root.className='comparison-workspace';this.root.dataset.researchPage='teachable';this.root.setAttribute('aria-label','티처블 머신');
    this.root.innerHTML=`<header><h1>티처블 머신</h1><button data-comparison-close>← 문제 고르기</button></header>
    <nav class="comparison-tabs" aria-label="티처블 머신 화면"><button data-pane="0">자료</button><button data-pane="1">학습 과정</button><button data-pane="2">새 자료로 확인</button></nav>
    <div class="comparison-columns">
      <section class="comparison-data"><div class="comparison-heading"><h2>클래스별 자료</h2><label>시작 자료<select data-task><option value="custom">직접 모으기</option><option value="digits">숫자 0·1·2</option><option value="omr">OMR ①~⑤</option><option value="webcam">가위바위보</option></select></label></div>
      <div data-class-cards></div><div class="comparison-add"><input data-new-class placeholder="새 클래스 이름" maxlength="24" aria-label="새 클래스 이름"><button data-add-class>+ 클래스</button></div>
      <div class="comparison-pager"><button data-prev aria-label="이전 클래스">←</button><span data-page></span><button data-next aria-label="다음 클래스">→</button></div>
      <div class="comparison-capture"><div class="comparison-tools" aria-label="추가할 자료 유형"><button data-source="drawing" aria-pressed="true">그리기</button><button data-source="webcam" aria-pressed="false">웹캠</button><button data-source="upload" aria-pressed="false">업로드</button></div>
      <div class="comparison-input"><canvas data-private-drawing width="224" height="224" aria-label="티처블 머신 그림 그리기"></canvas><video hidden playsinline muted></video><p data-camera-message hidden></p></div>
      <label class="comparison-upload button secondary" hidden>이미지 파일 선택<input data-files type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label>
      <div class="comparison-tools"><button data-clear>지우기</button><button data-capture class="button primary">선택 클래스에 추가</button><button data-continuous hidden>연속 수집</button></div></div></section>
      <section class="comparison-train"><div class="comparison-train-heading"><div><h2>모델 학습</h2><span data-coverage></span></div><button data-train class="button primary">모델 학습하기</button></div><progress max="300" value="0" aria-label="학습 진행"></progress><p data-training-status>아직 학습하지 않았어요.</p><div data-live-flow></div>
      <div class="comparison-train-footer"><details><summary>모델 정보</summary><p>14×14 그림을 입력하는 작은 신경망입니다. Google Teachable Machine의 모델과는 다릅니다. 학습 설정은 자동으로 정해집니다.</p></details><button data-reset>학습 초기화</button></div></section>
      <section class="comparison-preview"><h2>미리보기</h2><p>새 그림이나 사진으로 확인해요.</p><label class="button secondary">새 이미지로 시험<input data-test-file type="file" accept="image/png,image/jpeg,image/webp" hidden></label><div data-preview-image></div><div data-probabilities></div>
      <label>이 새 자료의 실제 정답<select data-truth></select></label><button data-test>정답과 비교해 기록</button><p data-test-status></p>
      <details><summary>모델 내보내기</summary><button data-export="json">학습 모델 .json</button><button data-export="extension">TurboWarp 예측 블록 .js</button><button data-export="sb3">Scratch 예측 블록 .sb3</button><p>학습 자료 없이 모델과 클래스 이름만 내보냅니다.</p></details></section>
    </div><p data-comparison-status role="status"></p>`;
    (document.querySelector('#lesson')??document.body).append(this.root);this.canvas=this.el('canvas');this.video=this.el('video');this.capturePanel=this.el('.comparison-capture');
    this.flow=new ComparisonFlow(this.el('[data-live-flow]'),id=>{const r=this.store.snapshot.data.find(row=>row.id===id);if(r){this.store.setInput(r.pixels,r.image,r.source==='example'?'drawing':r.source);this.store.selectSample(id);recordStoreResearch(this.store,'sample_select',{sampleId:id,operation:'flow-map'});}},neuron=>{recordStoreResearch(this.store,'visualization_change',{operation:'flow-neuron',neuron});this.render();});this.clear();
    this.root.addEventListener('click',e=>this.click(e));this.root.addEventListener('change',e=>{void this.change(e);});
    this.canvas.addEventListener('pointerdown',e=>{if(this.training||this.uploading)return;this.drawing=true;this.canvas.setPointerCapture(e.pointerId);const p=this.position(e),ctx=this.canvas.getContext('2d')!;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(p[0]+.01,p[1]+.01);ctx.stroke();});
    this.canvas.addEventListener('pointermove',e=>{if(!this.drawing)return;const ctx=this.canvas.getContext('2d')!;ctx.lineTo(...this.position(e));ctx.stroke();this.capture(false);});
    const end=()=>{if(this.drawing){this.drawing=false;this.capture(false);recordResearch('input_capture',{source:'drawing'}, {condition:'comparison'});}};
    this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);
    this.store.subscribe(()=>this.render());this.setup('custom');
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.stopCamera();this.stopTraining();}});
    window.addEventListener('resize',()=>{if(this.isOpen)this.render();});
  }
  private el<T extends HTMLElement=HTMLElement>(s:string):T {return this.root.querySelector<T>(s)!;}
  open():void {if(this.isOpen)return;this.previous=currentResearchContext();researchContext({condition:'comparison',task:this.store.snapshot.task,page:'teachable',engine:'pixel-ann-196'});recordResearch('page_view',{operation:'open-teachable',traceVersion:'tm-live-flow-v2'});this.root.hidden=false;this.render();this.onNavigate();}
  close():void {if(!this.isOpen)return;this.uploadToken++;this.uploading=false;this.stopCamera();this.stopTraining();recordResearch('page_view',{operation:'close-teachable'});const old=this.previous;this.previous=null;if(old)researchContext(old);this.root.hidden=true;this.onNavigate();}
  navigate(pane:number):void {this.pane=pane;researchContext({page:'teachable'});recordResearch('page_view',{step:pane,operation:'teachable-pane'});this.render();this.onNavigate();}
  private setup(task:ImageTask):void {this.stopCamera();this.source='drawing';this.stopTraining();this.store.configure(task);this.store.setMode('pixels');this.store.setHiddenUnits(16);this.page=0;this.clear();if(this.previous)researchContext({task});this.render();}
  private position(e:PointerEvent):[number,number]{const r=this.canvas.getBoundingClientRect();return[(e.clientX-r.left)*224/r.width,(e.clientY-r.top)*224/r.height];}
  private clear():void {const ctx=this.canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,224,224);ctx.strokeStyle='#17212b';ctx.lineWidth=13;ctx.lineCap='round';ctx.lineJoin='round';if(!this.stream)this.capture(false);}
  private capture(add:boolean):void {
    if(this.stream&&this.video.readyState<2)return;
    const picture=captureImage(this.stream?this.video:this.canvas,!!this.stream);this.store.setInput(picture.pixels,picture.image,this.stream?'webcam':'drawing');
    if(add){if(this.store.snapshot.data.length>=1000){this.collecting=false;this.toast('자료는 1,000장까지 모을 수 있어요.');return;}this.store.addInput();if(!this.stream)this.clear();}
  }
  private stopCamera():void {this.cameraToken++;this.collecting=false;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;window.clearInterval(this.cameraFrame);this.video.hidden=true;this.canvas.hidden=false;this.el('[data-continuous]').hidden=true;}
  private async camera():Promise<void> {
    this.stopCamera();const token=this.cameraToken;
    try{const stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480},audio:false});if(token!==this.cameraToken||!this.isOpen){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;this.video.srcObject=stream;await this.video.play();this.render();
      this.cameraFrame=window.setInterval(()=>{if(!this.training)this.capture(this.collecting);},250);
    }catch{this.stopCamera();this.toast('웹캠을 열지 못했어요. 권한을 확인하거나 이미지 업로드를 이용해 주세요.');recordResearch('action_rejected',{operation:'camera',reason:'permission-or-device'});}
  }
  private stopTraining():void {window.clearTimeout(this.timer);if(this.training)recordStoreResearch(this.store,'training_stop',{epoch:this.store.snapshot.model.epoch,completed:false});this.training=false;}
  private train():void {
    if(this.uploading)return;
    if(this.training){this.stopTraining();this.render();return;}
    const error=this.store.coverageError();if(error){this.toast(error);recordResearch('action_rejected',{operation:'train',reason:'coverage'});return;}
    this.collecting=false;this.pane=1;this.onNavigate();this.training=true;this.store.resetModel();const goal=this.epochs,progress=this.el<HTMLProgressElement>('progress');progress.max=goal;
    recordStoreResearch(this.store,'training_start',{epochs:goal,hiddenUnits:16,rate:this.store.snapshot.rate});
    const tick=()=>{if(!this.training)return;this.store.train(Math.min(5,goal-this.store.snapshot.model.epoch));if(this.store.snapshot.model.epoch>=goal){this.training=false;recordStoreResearch(this.store,'training_stop',{epoch:goal,completed:true});this.render();}else this.timer=window.setTimeout(tick,20);};tick();
  }
  private render():void {
    const s=this.store.snapshot,size=this.classPageSize();this.page=Math.min(this.page,Math.max(0,Math.ceil(s.classes.length/size)-1));
    const key=JSON.stringify([s.classes,s.selectedClass,s.data.map(r=>r.id),this.page,size]);
    if(key!==this.classRenderKey){this.classRenderKey=key;this.capturePanel.remove();
    this.el('[data-class-cards]').innerHTML=s.classes.slice(this.page*size,this.page*size+size).map((c,j)=>{const i=this.page*size+j,samples=s.data.filter(r=>r.label===i);return`<article class="comparison-class ${s.selectedClass===i?'selected':''}" style="--class-color:${colors[i%colors.length]}"><div><button data-select-class="${i}" aria-pressed="${s.selectedClass===i}">${esc(c)} · ${samples.length}장</button><button data-rename="${i}" aria-label="${esc(c)} 이름 바꾸기">이름</button><button data-remove-class="${i}" aria-label="${esc(c)} 삭제">×</button></div><div class="comparison-samples">${samples.slice(0,4).map(r=>`<button data-sample="${r.id}" aria-label="${esc(c)} 자료 선택"><canvas width="56" height="56" data-thumb="${r.id}"></canvas></button>`).join('')}${samples.length?`<button data-gallery="${i}">모두 보기</button>`:'<span>클래스를 고르고 자료를 추가하세요.</span>'}</div></article>`;}).join('');
    this.root.querySelectorAll<HTMLCanvasElement>('[data-thumb]').forEach(canvas=>{const pixels=s.data.find(r=>r.id===Number(canvas.dataset.thumb))!.pixels,ctx=canvas.getContext('2d')!;pixels.forEach((v,k)=>{ctx.fillStyle=`rgb(${255*(1-v)},${255*(1-v)},${255*(1-v)})`;ctx.fillRect(k%14*4,Math.floor(k/14)*4,4,4);});});
    const selected=this.root.querySelector('.comparison-class.selected');(selected??this.root).append(this.capturePanel);this.capturePanel.hidden=!selected;
    }
    this.root.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.source===this.source)));
    this.el('.comparison-input').hidden=this.source==='upload';this.el('.comparison-upload').hidden=this.source!=='upload';
    this.canvas.hidden=this.source!=='drawing';this.video.hidden=this.source!=='webcam'||!this.stream;
    this.el('[data-camera-message]').hidden=this.source!=='webcam'||!!this.stream;this.el('[data-camera-message]').textContent='웹캠을 연결해 주세요.';
    this.el('[data-clear]').hidden=this.source!=='drawing';this.el('[data-capture]').hidden=this.source==='upload';this.el('[data-continuous]').hidden=this.source!=='webcam'||!this.stream;
    this.el('[data-page]').textContent=`${this.page+1} / ${Math.ceil(s.classes.length/size)}`;this.el<HTMLButtonElement>('[data-prev]').disabled=this.page===0;this.el<HTMLButtonElement>('[data-next]').disabled=(this.page+1)*size>=s.classes.length;
    this.el('[data-capture]').textContent=`${s.classes[s.selectedClass]}에 추가`;this.el('[data-continuous]').textContent=this.collecting?'수집 멈춤':'연속 수집';this.el('[data-coverage]').textContent=`자료 ${s.data.length}장 · 클래스 ${s.classes.length}개`;
    this.el('[data-train]').textContent=this.training?'학습 멈춤':'모델 학습하기';this.el<HTMLProgressElement>('progress').value=s.model.epoch;
    this.el('[data-training-status]').textContent=s.model.epoch?`${this.training?'학습 중':'현재 모델'} · 학습 자료 정답률 ${(this.store.metrics().accuracy*100).toFixed(1)}%`:'클래스마다 2장 이상 모아 주세요.';
    if(this.isOpen)this.flow.render(s,this.training);
    const truth=this.el<HTMLSelectElement>('[data-truth]'),v=truth.value;truth.innerHTML='<option value="">정답 선택</option>'+s.classes.map((c,i)=>`<option value="${i}">${esc(c)}</option>`).join('');truth.value=v;
    this.el('[data-preview-image]').innerHTML=s.inputImage?`<img alt="현재 예측할 그림" src="${s.inputImage}">`:'<canvas width="112" height="112" aria-label="현재 예측할 그림"></canvas>';
    const preview=this.root.querySelector<HTMLCanvasElement>('[data-preview-image] canvas');if(preview){const ctx=preview.getContext('2d')!;s.input.forEach((v,k)=>{const gray=Math.round(255*(1-v));ctx.fillStyle=`rgb(${gray},${gray},${gray})`;ctx.fillRect(k%14*8,Math.floor(k/14)*8,8,8);});}
    const p=s.model.epoch?this.store.predict(s.input).probabilities:[];
    this.el('[data-probabilities]').innerHTML=p.length?p.map((v,i)=>`<div class="comparison-bar"><span>${esc(s.classes[i]!)}</span><meter min="0" max="1" value="${v}" style="--class-color:${colors[i%colors.length]}"></meter><b>${(v*100).toFixed(1)}%</b></div>`).join(''):'<p>학습하면 예상 결과가 나타나요.</p>';
    this.el('[data-test-status]').textContent=s.testCount?`새 자료 ${s.testCount}개 중 ${s.testCorrect}개 일치`:'';
    this.root.dataset.pane=String(this.pane);this.root.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-current',(b as HTMLElement).dataset.pane===String(this.pane)?'step':'false'));
    this.root.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('[data-task],[data-add-class],[data-reset],[data-capture],[data-files],[data-test-file],[data-continuous],[data-select-class],[data-remove-class],[data-remove-sample],[data-rename],[data-gallery],[data-source],[data-clear]').forEach(el=>el.disabled=this.training||this.uploading);
    this.el<HTMLButtonElement>('[data-train]').disabled=this.uploading;
    this.root.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach(el=>el.disabled=this.uploading);
    this.root.querySelectorAll<HTMLButtonElement>('[data-test],[data-export]').forEach(el=>el.disabled=this.training||this.uploading||!s.model.epoch);
    this.el('[data-comparison-status]').textContent=this.uploading?'이미지를 불러오는 중입니다.':'';
  }
  private click(event:Event):void {
    const b=(event.target as Element).closest<HTMLElement>('button');if(!b)return;const d=b.dataset;
    if(b.hasAttribute('data-comparison-close'))return this.close();
    if(d.pane!==undefined){this.navigate(Number(d.pane));return;}
    if(d.selectClass!==undefined)this.store.selectClass(Number(d.selectClass));
    if(d.rename!==undefined){const i=Number(d.rename),name=prompt('클래스 이름',this.store.snapshot.classes[i]);if(name){const e=this.store.renameClass(i,name);if(e)this.toast(e);}}
    if(d.removeClass!==undefined){const e=this.store.removeClass(Number(d.removeClass));if(e)this.toast(e);}
    if(d.removeSample!==undefined)this.store.removeSample(Number(d.removeSample));
    if(d.sample!==undefined){const sample=this.store.snapshot.data.find(r=>r.id===Number(d.sample))!;this.store.setInput(sample.pixels,sample.image,sample.source==='example'?'drawing':sample.source);this.store.selectSample(sample.id);}
    if(b.hasAttribute('data-add-class')){const input=this.el<HTMLInputElement>('[data-new-class]');const e=this.store.addClass(input.value||`클래스 ${this.store.snapshot.classes.length+1}`);if(e)this.toast(e);else{input.value='';this.page=Math.floor((this.store.snapshot.classes.length-1)/this.classPageSize());}}
    if(d.gallery!==undefined)this.gallery(Number(d.gallery));
    if(d.source==='webcam'){this.source='webcam';void this.camera();}if(d.source==='drawing'){this.source='drawing';this.stopCamera();this.capture(false);}if(d.source==='upload'){this.source='upload';this.stopCamera();}
    if(b.hasAttribute('data-clear'))this.clear();if(b.hasAttribute('data-capture'))this.capture(true);
    if(b.hasAttribute('data-continuous'))this.collecting=!this.collecting;
    if(b.hasAttribute('data-prev'))this.page--;if(b.hasAttribute('data-next'))this.page++;
    if(b.hasAttribute('data-train'))this.train();if(b.hasAttribute('data-reset'))this.store.resetModel();
    if(b.hasAttribute('data-test')){const value=this.el<HTMLSelectElement>('[data-truth]').value;if(value==='')this.toast('실제 정답을 골라 주세요.');else {const error=this.store.recordTest(Number(value));if(error)this.toast(error);}}
    if(d.export&&this.store.snapshot.model.epoch){const s=this.store.snapshot;recordResearch('export_model',{format:d.export});if(d.export==='json')downloadText('neural-lab-comparison.json',JSON.stringify({version:1,kind:'image',model:s.model,classes:s.classes,input:{size:14,grayscale:true}},null,2),'application/json');if(d.export==='extension')downloadText('neural-lab-comparison.js',generateInferenceExtension(s.model,s.classes),'text/javascript');if(d.export==='sb3')downloadBlob('neural-lab-comparison.sb3',createPixelScratchProject(s.model,s.classes));}
    this.render();
  }
  private gallery(label:number):void {
    const dialog=document.createElement('dialog');dialog.className='research-dialog comparison-gallery';document.body.append(dialog);let page=0;
    const draw=()=>{const samples=this.store.snapshot.data.filter(r=>r.label===label);page=Math.max(0,Math.min(page,Math.ceil(samples.length/8)-1));
      dialog.innerHTML=`<header><h2>${esc(this.store.snapshot.classes[label]!)} · ${samples.length}장</h2><button data-close aria-label="자료 창 닫기">×</button></header><div class="comparison-gallery-grid">${samples.slice(page*8,page*8+8).map(r=>`<div><button data-choose="${r.id}" aria-label="자료 ${r.id} 선택"><canvas data-image="${r.id}" width="84" height="84"></canvas></button><button data-delete="${r.id}" aria-label="자료 ${r.id} 삭제">삭제</button></div>`).join('')}</div><footer><button data-previous ${page?'':'disabled'}>이전</button><span>${page+1} / ${Math.max(1,Math.ceil(samples.length/8))}</span><button data-following ${(page+1)*8<samples.length?'':'disabled'}>다음</button></footer>`;
      dialog.querySelectorAll<HTMLCanvasElement>('canvas').forEach(c=>{const pixels=samples.find(r=>r.id===Number(c.dataset.image))!.pixels,ctx=c.getContext('2d')!;pixels.forEach((v,k)=>{const gray=Math.round(255*(1-v));ctx.fillStyle=`rgb(${gray},${gray},${gray})`;ctx.fillRect(k%14*6,Math.floor(k/14)*6,6,6);});});
    };
    dialog.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b)return;if(b.hasAttribute('data-close'))dialog.close();if(b.hasAttribute('data-previous')){page--;draw();}if(b.hasAttribute('data-following')){page++;draw();}if(b.dataset.delete!==undefined){this.store.removeSample(Number(b.dataset.delete));draw();}if(b.dataset.choose!==undefined){const r=this.store.snapshot.data.find(r=>r.id===Number(b.dataset.choose))!;this.store.setInput(r.pixels,r.image,r.source==='example'?'drawing':r.source);this.store.selectSample(r.id);dialog.close();}});
    dialog.addEventListener('close',()=>dialog.remove());draw();dialog.showModal();
  }
  private async change(event:Event):Promise<void> {
    const el=event.target as HTMLInputElement;
    if(this.uploading||this.training)return;
    if(el.matches('[data-test-file]')&&el.files?.[0]){
      const file=el.files[0];if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){this.toast('이미지 5MB 이하를 골라 주세요.');el.value='';return;}
      this.stopCamera();const token=++this.uploadToken;this.uploading=true;this.render();const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(this.isOpen&&token===this.uploadToken){const picture=captureImage(image);this.store.setInput(picture.pixels,picture.image,'upload');recordResearch('input_capture',{source:'upload',operation:'test-input'});}}catch{this.toast('이미지를 읽지 못했습니다.');}finally{URL.revokeObjectURL(url);el.value='';if(token===this.uploadToken){this.uploading=false;this.render();}}
    }
    if(el.matches('[data-task]'))this.setup(el.value as ImageTask);
    if(el.matches('[data-files]')&&el.files){
      const files=Array.from(el.files),label=this.store.snapshot.selectedClass;this.stopCamera();
      if(files.length>100||this.store.snapshot.data.length+files.length>1000){this.toast('한 번에 100장, 전체 1,000장까지 가능합니다.');el.value='';return;}
      const token=++this.uploadToken;this.uploading=true;this.render();
      for(const file of files){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){this.toast('PNG·JPEG·WebP 이미지 5MB 이하만 가능합니다.');continue;}
        const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(!this.isOpen||token!==this.uploadToken)break;const picture=captureImage(image);this.store.selectClass(label);this.store.setInput(picture.pixels,picture.image,'upload');this.store.addInput();recordResearch('input_capture',{source:'upload',label});}catch{this.toast('읽을 수 없는 이미지입니다.');}finally{URL.revokeObjectURL(url);}}
      el.value='';if(token===this.uploadToken){this.uploading=false;this.render();}
    }
  }
}
