import './stableMap.css';

/** Canvas backing-store dimensions must never become flex/grid intrinsic sizes. */
export function stabilizeMap(canvas:HTMLCanvasElement):HTMLElement {
  if(canvas.parentElement?.classList.contains('stable-map-slot'))return canvas.parentElement;
  const slot=document.createElement('div');slot.className='stable-map-slot';
  canvas.before(slot);slot.append(canvas);return slot;
}
