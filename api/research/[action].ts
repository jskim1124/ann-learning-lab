import type { IncomingMessage, ServerResponse } from 'node:http';
import { researchConfig } from '../../server/research/config.js';
import { createResearchHandler } from '../../server/research/handler.js';
import { MemorySink, SheetsGateway } from '../../server/research/sink.js';
let handler: ReturnType<typeof createResearchHandler> | undefined;
/** App deployment does not enable research collection. RESEARCH_MODE defaults to off. */
export default async function research(req: IncomingMessage,res: ServerResponse) {
  try {
    if(!handler) { const config=researchConfig(); handler=createResearchHandler(config,config.mode==='google'?new SheetsGateway(config):new MemorySink()); }
    await handler(req,res);
  } catch { res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"research-not-configured"}'); }
}
