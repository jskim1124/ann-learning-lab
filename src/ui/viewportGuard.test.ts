import {it,expect} from 'vitest';
import {viewportTooSmall} from './viewportGuard';
it('DPR이 아닌 실제 공간으로 판정하며 노트북·세로 태블릿을 잘못 차단하지 않는다',()=>{
  expect(viewportTooSmall(1397,655)).toBe(false);expect(viewportTooSmall(768,1024)).toBe(false);
  expect(viewportTooSmall(620,450)).toBe(true);expect(viewportTooSmall(1200,420)).toBe(true);
  expect(viewportTooSmall(720,655)).toBe(true);expect(viewportTooSmall(768,655)).toBe(false);
});
