/** One responsive behavior for every activity: switch work panes instead of stacking long pages. */
export function workspacePanels(root: HTMLElement, panels: Element[], labels: string[], redraw: () => void = () => {}): void {
  root.classList.add("shared-workspace");
  const nav=document.createElement("nav");nav.className="workspace-pane-tabs";nav.setAttribute("aria-label","작업 화면 선택");
  const select=(index:number)=>{panels.forEach((panel,i)=>panel.classList.toggle("workspace-pane-hidden",i!==index));nav.querySelectorAll("button").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===index)));redraw();};
  labels.forEach((label,i)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",()=>select(i));nav.append(b);});
  root.prepend(nav);panels.forEach((panel,i)=>panel.classList.toggle("workspace-pane-hidden",i!==0));nav.querySelectorAll("button").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===0)));
}

export function revealModelPanel(root: HTMLElement): void {
  if (window.innerWidth <= 900) root.querySelectorAll<HTMLButtonElement>(".workspace-pane-tabs > button, .image-compact-tabs > button")[1]?.click();
}

/** Keep the same graph / model composition for numeric and image activities. */
export function featureTrainingPanels(root: HTMLElement, redraw: () => void): void {
  const controls = root.querySelector<HTMLElement>(".controls")!;
  const stage = root.querySelector<HTMLElement>(".training-stage")!;
  const connection = root.querySelector<HTMLElement>(".connection-panel")!;
  const advanced = document.createElement("details");
  advanced.className = "image-detail";
  const summary = document.createElement("summary"); summary.textContent = "학습 설정"; advanced.append(summary);
  controls.querySelectorAll("label.field").forEach((label, i) => { if (i > 0) advanced.append(label); });
  advanced.append(controls.querySelector("#featureResetModel")!);
  controls.append(advanced, ...connection.children); connection.remove();
  controls.className = "image-panel image-model-panel";
  stage.className = "image-panel image-results-panel feature-training-stage";
  const layout = document.createElement("div"); layout.className = "image-train";
  layout.append(stage, controls); root.replaceChildren(layout);
  root.className = "image-workspace tabular-training";
  workspacePanels(root, [stage, controls], ["학습 지도", "모델 살펴보기"], redraw);
}
