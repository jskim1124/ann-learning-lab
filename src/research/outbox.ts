import type { RawEvent, SurveySubmission } from './schema';
export interface Pending { key: string; owner: string; kind: 'event' | 'survey'; body: RawEvent | SurveySubmission; }
export interface Outbox { all(owner: string): Promise<Pending[]>; put(row: Pending): Promise<void>; remove(keys: string[]): Promise<void>; }
export class IndexedOutbox implements Outbox {
  private database?: Promise<IDBDatabase>;
  private db(): Promise<IDBDatabase> {
    return this.database ??= new Promise((resolve,reject)=> {
      const req=indexedDB.open('neural-lab-research-v1',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('pending',{keyPath:'key'});
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('저장 공간을 열 수 없습니다.'));
    });
  }
  private async transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore)=>IDBRequest<T>): Promise<T> {
    const db=await this.db();return new Promise((resolve,reject)=> { const tx=db.transaction('pending',mode);const req=run(tx.objectStore('pending')); tx.oncomplete=()=>resolve(req.result);tx.onerror=tx.onabort=()=>reject(new Error('로그를 기기에 저장하지 못했습니다.')); });
  }
  async all(owner: string): Promise<Pending[]> { const rows=await this.transaction<Pending[]>('readonly',s=>s.getAll());return rows.filter(r=>r.owner===owner); }
  async put(row: Pending): Promise<void> { await this.transaction('readwrite',s=>s.put(row)); }
  async remove(keys: string[]): Promise<void> { if(keys.length)await this.transaction('readwrite',s=>{keys.slice(0,-1).forEach(k=>s.delete(k));return s.delete(keys.at(-1)!);}); }
}
export class MemoryOutbox implements Outbox {
  rows=new Map<string,Pending>();
  async all(owner:string) { return [...this.rows.values()].filter(r=>r.owner===owner); }
  async put(row:Pending) { this.rows.set(row.key,structuredClone(row)); }
  async remove(keys:string[]) { keys.forEach(k=>this.rows.delete(k)); }
}
