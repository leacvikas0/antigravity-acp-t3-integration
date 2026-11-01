// Local-only controlled usage fixture. Never calls AI Studio or the live proxy.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),candidate=path.join(root,'candidate/acp-1.4.3');
const home=path.join(root,'candidate/cached-policy-fixture-home');
fs.mkdirSync(path.join(home,'antigravity-acp'),{recursive:true});
fs.writeFileSync(path.join(home,'antigravity-acp/settings.json'),JSON.stringify({auth:{type:'gateway'}}));
const evidence=path.join(root,'verification/native-cached-context-candidate.json');
let child,buffer='',sequence=0,turn=0,requests=[];const pending=new Map(),turnResults=[];
const reported=[240000,500000,800000,910000,930000,60000];
const server=http.createServer((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{
 let input;try{input=JSON.parse(body)}catch{}
 if(req.url.includes('countTokens')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({totalTokens:reported[Math.max(0,turn-1)]}));return;}
 if(!req.url.includes('streamGenerateContent')&&!req.url.includes(':generateContent')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({models:[{name:'models/gemini-4-argon',displayName:'Gemini 4 Argon',inputTokenLimit:1048576,outputTokenLimit:131072}]}));return;}
 const inputTokens=reported[Math.max(0,turn-1)];
 requests.push({turn,inputTokens,maxOutputTokens:input?.generationConfig?.maxOutputTokens,toolCount:(input?.tools??[]).flatMap(t=>t.functionDeclarations??[]).length});
 const value={candidates:[{index:0,content:{role:'model',parts:[{text:'# Session Summary\nThis is a local configuration test. The user requested a native context-policy check; no project files changed. Continue the test.\nPOLICY-FIXTURE-OK'}]},finishReason:'STOP'}],modelVersion:'gemini-4-argon',usageMetadata:{promptTokenCount:inputTokens,cachedContentTokenCount:Math.max(0,inputTokens-1000),candidatesTokenCount:30,totalTokenCount:inputTokens+30}};
 if(req.url.includes('streamGenerateContent')){res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify(value)+'\n\n');}
 else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));}
 });});
function request(method,params){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timeout '+method));},90000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
function checkpointCount(sessionId){
 const script="import sqlite3,sys; c=sqlite3.connect('file:'+sys.argv[1].replace('\\\\','/')+'?mode=ro',uri=True); print(c.execute('select count(*) from steps where step_type=23 and status=3').fetchone()[0])";
 const r=require('node:child_process').spawnSync('python',['-c',script,path.join(home,'antigravity-acp/conversations',sessionId+'.db')],{encoding:'utf8',windowsHide:true});
 if(r.status!==0)throw Error(r.stderr);return Number(r.stdout.trim());
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 child=spawn(path.join(candidate,'agy_acp_server.exe'),[],{cwd:candidate,windowsHide:true,env:{...process.env,GEMINI_HOME:home,AGY_LLM_GATEWAY_URL:`http://127.0.0.1:${server.address().port}`,AGY_LLM_GATEWAY_API_KEY:'offline-fixture',AGY_LLM_GATEWAY_MODELS:'gemini-4-argon',AGY_ACP_DEFAULT_MODEL:'gemini-4-argon-high',ARGON_CONTEXT_POLICY_EVIDENCE:evidence},stdio:['pipe','pipe','pipe']});
 const log=fs.createWriteStream(path.join(root,'verification/native-cached-context-candidate.stderr.log'));
 child.stderr.pipe(log);child.stdout.on('data',d=>{buffer+=d;let n;while((n=buffer.indexOf('\n'))>=0){let m;try{m=JSON.parse(buffer.slice(0,n))}catch{}buffer=buffer.slice(n+1);if(m?.method==='session/update'&&JSON.stringify(m.params?.update).match(/usage|token/i))console.log('ACP_USAGE '+JSON.stringify(m.params.update));if(m?.id!==undefined&&!m.method){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}}});
 await request('initialize',{protocolVersion:1,clientCapabilities:{fs:{readTextFile:false,writeTextFile:false},terminal:false}});
 const session=await request('session/new',{cwd:home,mcpServers:[]});
 for(turn=1;turn<=reported.length;turn++){
  const before=requests.length;
  await request('session/prompt',{sessionId:session.sessionId,prompt:[{type:'text',text:'POLICY-PROBE-TURN-'+turn}]});
  const checkpoints=checkpointCount(session.sessionId);
  const result={turn,reportedInputTokens:reported[turn-1],inferenceCalls:requests.length-before,completedCheckpoints:checkpoints};turnResults.push(result);console.log(JSON.stringify(result));
 }
 const config=JSON.parse(fs.readFileSync(evidence,'utf8'));
 const report={session:session.sessionId,nativeConfig:config,turns:turnResults,requests,
  noEarlyCheckpoint:turnResults.slice(0,4).every(r=>r.completedCheckpoints===0),
  checkpointAfterHighWatermark:turnResults[4].completedCheckpoints>0,
  outputLimitVerified:requests.every(r=>r.maxOutputTokens>0&&r.maxOutputTokens<=131072)&&turnResults.every(t=>requests.find(r=>r.turn===t.turn)?.maxOutputTokens===131072),liveModelCalls:0};
 fs.writeFileSync(path.join(root,'verification/native-cached-context-probe.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(!report.noEarlyCheckpoint||!report.checkpointAfterHighWatermark||!report.outputLimitVerified)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(child){child.stdin.end();const timer=setTimeout(()=>{spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});server.closeAllConnections();server.close();},30000);timer.unref();child.once('close',()=>{clearTimeout(timer);server.closeAllConnections();server.close();});}else server.close();});

