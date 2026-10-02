/** Test-only learner actions: follow the same feature confirmations and sliders as the UI. */
export function exploreAllParameters(root:Element):void {
  const click=(s:string)=>root.querySelector<HTMLButtonElement>(s)!.click();
  const skip=root.querySelector<HTMLButtonElement>('[data-projection-skip]');if(skip&&!skip.hidden)skip.click();
  for(const axis of [0,1]){
    const select=root.querySelector<HTMLSelectElement>(`[data-feature="${axis}"]`);
    if(select&&!select.value){const other=root.querySelector<HTMLSelectElement>(`[data-feature="${1-axis}"]`);const options=[...select.options].filter(o=>o.value&&o.value!==other?.value);select.value=options.find(o=>o.value===String(axis))?.value??options[0]?.value??'';select.dispatchEvent(new Event('change',{bubbles:true}));root.querySelector<HTMLButtonElement>('[data-projection-skip]')?.click();if(!select.value){const current=root.querySelector<HTMLSelectElement>(`[data-feature="${axis}"]`)!;current.value=[...current.options].filter(o=>o.value&&o.value!==other?.value)[1]?.value??'';current.dispatchEvent(new Event('change',{bubbles:true}));root.querySelector<HTMLButtonElement>('[data-projection-skip]')?.click();}}
  }
  for(const chapter of [1,2]){
    click(`[data-explore-chapter="${chapter}"]`);
    for(const parameter of ['xWeight','yWeight','bias']){
      root.querySelector<HTMLButtonElement>(`[data-parameter-choice="${parameter}"]`)!.click();

      const input=root.querySelector<HTMLInputElement>(`[data-knob="${parameter}"]`)!;
      const base=Number(input.value);
      input.value=String(base===.5?.75:.5);input.dispatchEvent(new Event('input',{bubbles:true}));
      if(chapter===2&&root.querySelector<HTMLElement>(`[data-parameter-choice="${parameter}"]`)!.dataset.completed!=='true'){
        input.value=String(Math.min(Number(input.max),base+.1));input.dispatchEvent(new Event('input',{bubbles:true}));
        if(root.querySelector<HTMLElement>(`[data-parameter-choice="${parameter}"]`)!.dataset.completed!=='true'){input.value=String(Math.max(Number(input.min),base-.1));input.dispatchEvent(new Event('input',{bubbles:true}));}
      }
    }
  }
}
