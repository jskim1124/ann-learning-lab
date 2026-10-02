/* Install manually as a standalone Apps Script web app. DO NOT deploy automatically.
 * Script properties: SHEET_ID, GATEWAY_SECRET, STUDY_ID.
 * SHEET_ID example: 1EO9SCthQHKgpCgiSVm8C571-LJwDqC-GE3JzSZxCrlU
 * Execute as researcher; public endpoint accepts only signed server requests.
 */
var HEADERS = {
  Participants: ['participant_id','consent_version','joined_at','profile_json','identity_ciphertext'],
  RawEvents: ['event_id','study_id','participant_id','client_session_id','sequence','occurred_at_client','received_at_server','elapsed_ms','schema_version','app_build','condition','task','page','engine','workspace_id','dataset_version','model_version','action','scope','payload_json'],
  SurveyResponses: ['submission_id','study_id','participant_id','received_at_server','instrument_version','answers_json']
};
function reply_(ok,data) { return ContentService.createTextOutput(JSON.stringify({ok:ok,data:data})).setMimeType(ContentService.MimeType.JSON); }
function equal_(a,b) { if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;var diff=0;for(var i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0; }
function safeCell_(v) { if(typeof v==='number'||typeof v==='boolean')return v;var s=typeof v==='string'?v:JSON.stringify(v);return /^[=+@\-\t\r\n]/.test(s)?"'"+s:s; }
function sheet_(book,name) { var s=book.getSheetByName(name);if(!s){s=book.insertSheet(name);s.appendRow(HEADERS[name]);s.setFrozenRows(1);}else if(s.getLastRow()===0)s.appendRow(HEADERS[name]);else {var h=s.getRange(1,1,1,HEADERS[name].length).getValues()[0];if(JSON.stringify(h)!==JSON.stringify(HEADERS[name]))throw Error('headers');}return s; }
function rows_(sheet) { return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues():[]; }
/** Run once in the editor after setting the three script properties. No sample rows. */
function setupResearchSheets() {
  var p=PropertiesService.getScriptProperties();
  if(!p.getProperty('SHEET_ID')||!p.getProperty('STUDY_ID')||(p.getProperty('GATEWAY_SECRET')||'').length<32)throw Error('Set SHEET_ID, STUDY_ID, and a 32+ character GATEWAY_SECRET first.');
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try {var book=SpreadsheetApp.openById(p.getProperty('SHEET_ID'));Object.keys(HEADERS).forEach(function(name){sheet_(book,name);});SpreadsheetApp.flush();}
  finally {lock.releaseLock();}
}
function doPost(e) {
  var lock;
  try {
    if(!e||!e.postData||e.postData.contents.length>200000)return reply_(false,null);
    var props=PropertiesService.getScriptProperties(), secret=props.getProperty('GATEWAY_SECRET');
    if(!secret||secret.length<32)return reply_(false,null);
    var request=JSON.parse(e.postData.contents);
    if(typeof request.timestamp!=='number'||Math.abs(Date.now()-request.timestamp)>300000||typeof request.body!=='string')return reply_(false,null);
    var signature=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(request.timestamp)+'.'+request.body,secret)).replace(/=+$/,'');
    if(!equal_(signature,request.signature))return reply_(false,null);
    var body=JSON.parse(request.body);if(body.study!==props.getProperty('STUDY_ID'))return reply_(false,null);
    // Fail fast under contention, before the server's 15s timeout. The durable
    // browser outbox retries with jitter; never acknowledge a failed lock.
    lock=LockService.getScriptLock();if(!lock.tryLock(1000))return reply_(false,null);
    var book=SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
    if(body.operation==='participant'||body.operation==='join') {
      var sheet=sheet_(book,'Participants'), id=body.operation==='join'?body.participant.participantId:body.participantId;
      if(!/^p_[A-Za-z0-9_-]{43}$/.test(id))throw Error('id');
      var matching=rows_(sheet).filter(function(r){return r[0]===id;}),existing=matching[matching.length-1];
      if(body.operation==='participant')return reply_(true,existing?{participantId:id,consentVersion:existing[1],joinedAt:existing[2],profile:JSON.parse(existing[3]),identityCiphertext:''}:null);
      var p=body.participant;
      // Append a new protocol version; keep prior raw answers and stable participant ID.
      if(!existing||JSON.parse(existing[3]).version!==p.profile.version||existing[1]!==p.consentVersion){sheet.getRange(sheet.getLastRow()+1,1,1,5).setValues([[id,p.consentVersion,p.joinedAt,JSON.stringify(p.profile),p.identityCiphertext].map(safeCell_)]);SpreadsheetApp.flush();}
      return reply_(true,true);
    }
    if(body.operation!=='append'||['RawEvents','SurveyResponses'].indexOf(body.sheet)<0||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>200)throw Error('operation');
    var target=sheet_(book,body.sheet), length=HEADERS[body.sheet].length;
    // Only read durable ID columns for deduplication, not all payload/history columns.
    // Still O(total rows): this pilot sink is not a substitute for a durable DB at scale.
    var known={},keys=target.getLastRow()>1?target.getRange(2,1,target.getLastRow()-1,3).getValues():[];
    keys.forEach(function(r){known[r[2]+':'+r[0]]=true;});var append=[],accepted=[];
    body.rows.forEach(function(r){
      if(!/^[a-f0-9-]{36}$/i.test(r.id)||!/^p_[A-Za-z0-9_-]{43}$/.test(r.participantId)||!Array.isArray(r.values)||r.values.length!==length||r.values[0]!==r.id||r.values[1]!==body.study||r.values[2]!==r.participantId)throw Error('row');
      var key=r.participantId+':'+r.id;if(!known[key]){append.push(r.values.map(safeCell_));known[key]=true;}accepted.push(r.id);
    });
    if(append.length){target.getRange(target.getLastRow()+1,1,append.length,length).setValues(append);SpreadsheetApp.flush();}
    return reply_(true,accepted);
  } catch(err) { return reply_(false,null); } // Do not log request bodies or identity data.
  finally { if(lock&&lock.hasLock())lock.releaseLock(); }
}
