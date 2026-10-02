import type { Plugin } from 'vite';
import { researchConfig } from './config';
import { createResearchHandler } from './handler';
import { MemorySink, SheetsGateway } from './sink';
export function researchApi(env: Record<string,string|undefined>): Plugin {
  return { name:'local-research-api', configureServer(server) {
    const config=researchConfig(env), handler=createResearchHandler(config,config.mode==='google'?new SheetsGateway(config):new MemorySink());
    server.middlewares.use((req,res,next)=> { if(req.url?.startsWith('/api/research/'))void handler(req,res);else next(); });
  } };
}
