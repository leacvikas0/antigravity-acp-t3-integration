// Offline only: real ACP process, synthetic Gemini SSE and harmless local file reads.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),variant=process.argv[2]||'empty-parts';
const out=path.join(root,'verification/tool-finalization',variant+(process.env.TRAJECTORY_NATIVE_BINARY?'-1g':''));fs.mkdirSync(out,{recursive:true});
const home=path.join(out,'home');fs.mkdirSync(path.join(home,'antigravity-acp'),{recursive:true});
const withVideo=variant==='video'||variant==='video-large-signature'||variant==='video-two-large-signatures',largeSignature=variant.includes('large-signature');
const video='C:/Users/silen/.t3/userdata/attachments/99fcf250-4480-4ddb-8eb7-81956921584e-93e82078-9cc5-4919-81d8-0531cc155d8e-mp4.mp4';
fs.writeFileSync(path.join(home,'antigravity-acp/settings.json'),JSON.stringify({auth:{type:'gateway'}}));
for(let n=0;n<4;n++)fs.writeFileSync(path.join(home,`fixture-${n}.txt`),`READ_SENTINEL_${n}`);
let child,buffer='',seq=0,session,requests=[],updates=[];const pending=new Map();
const server=http.createServer((req,res)=>{let raw='';req.on('data',d=>raw+=d);req.on('end',()=>{
 let input;try{input=JSON.parse(raw)}catch{}
 if(req.url.includes('countTokens')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({totalTokens:1000}))}
 if(!/generatecontent/i.test(req.url)){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({models:[{name:'models/gemini-4-argon',inputTokenLimit:1048576,outputTokenLimit:131072}]}))}
 requests.push(input);fs.writeFileSync(path.join(out,`request-${requests.length}.json`),JSON.stringify(input,(k,v)=>k==='data'&&typeof v==='string'?`[redacted base64: ${v.length} chars]`:k==='thoughtSignature'&&typeof v==='string'?`[redacted signature: ${v.length} chars]`:v,2));
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 function emit(candidate,usage){res.write('data: '+JSON.stringify({candidates:[{index:0,...candidate}],modelVersion:'gemini-4-argon',responseId:'offline-'+requests.length,...(usage?{usageMetadata:usage}:{})})+'\n\n')}
 if(requests.length===1){
  emit({content:{role:'model',parts:[{text:'Inspecting four local fixture files.',thought:true,...(variant.includes('two-large')?{thoughtSignature:Buffer.alloc(20*1024*1024,66).toString('base64')}:{})}]}});
  for(let n=0;n<4;n++)emit({content:{role:'model',parts:[{functionCall:{id:'',name:'view_file',args:{AbsolutePath:path.join(home,`fixture-${n}.txt`),toolSummary:'Read fixture',toolAction:'Reading fixture'}}}]}});
  if(variant==='empty-text-tail')emit({content:{role:'model',parts:[{text:''}]}});
  if(variant==='signature-tail')emit({content:{role:'model',parts:[{text:'',thoughtSignature:Buffer.from('offline-signature').toString('base64')}]}});
  if(largeSignature)emit({content:{role:'model',parts:[{text:'',thoughtSignature:Buffer.alloc(20*1024*1024,65).toString('base64')}]}});
  const end={finishReason:'STOP'};
  if(variant!=='empty-content')end.content={role:'model',parts:[]};
  if(variant==='empty-content')end.content={};
  setTimeout(()=>{emit(end,{promptTokenCount:1000,candidatesTokenCount:80,totalTokenCount:1080});res.end()},120);
 }else{
  emit({content:{role:'model',parts:[{text:'OFFLINE_FINALIZATION_OK'}]},finishReason:'STOP'},{promptTokenCount:1500,candidatesTokenCount:10,totalTokenCount:1510});res.end();
 }
})});
function rpc(method,params){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Timeout '+method)),60000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')})}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let hook='C:/Users/silen/.gemini/antigravity-acp/bin/1.4.3/acp_patch.py';
 if(process.env.TRAJECTORY_NATIVE_BINARY){hook=path.join(home,'candidate-native-hook.py');fs.writeFileSync(hook,"import os\nfrom pathlib import Path\np='C:/Users/silen/.gemini/antigravity-acp/bin/1.4.3/acp_patch.py'\nexec(compile(open(p,encoding='utf-8').read(),p,'exec'),{'__file__':p,'__name__':'__acp_patch__'})\nimport google.antigravity.connections.local.local_connection as m\nm._get_default_binary_path=lambda env: Path(os.environ['TRAJECTORY_NATIVE_BINARY'])\n")}
 child=spawn('C:/Users/silen/.gemini/antigravity-acp/bin/1.4.3/agy_acp_server.exe',[],{cwd:home,windowsHide:true,env:{...process.env,GEMINI_HOME:home,ANTIGRAVITY_ACP_PATCH:hook,AGY_LLM_GATEWAY_URL:`http://127.0.0.1:${server.address().port}`,AGY_LLM_GATEWAY_API_KEY:'offline-fixture',AGY_LLM_GATEWAY_MODELS:'gemini-4-argon',AGY_ACP_DEFAULT_MODEL:'gemini-4-argon-high'},stdio:['pipe','pipe','pipe']});
 child.stderr.pipe(fs.createWriteStream(path.join(out,'stderr.log')));
 child.stdout.on('data',d=>{buffer+=d;let i;while((i=buffer.indexOf('\n'))>=0){let m;try{m=JSON.parse(buffer.slice(0,i))}catch{}buffer=buffer.slice(i+1);if(m?.method==='session/update')updates.push(m.params.update);if(m?.id!==undefined&&!m.method){let p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}}}});
 await rpc('initialize',{protocolVersion:1,clientCapabilities:{fs:{readTextFile:false,writeTextFile:false},terminal:false}});
 session=await rpc('session/new',{cwd:home,mcpServers:[]});
 if(session.modes?.availableModes?.some(m=>m.id==='yolo'))await rpc('session/set_mode',{sessionId:session.sessionId,modeId:'yolo'});
 const prompt=[{type:'text',text:'USER_PRESERVATION_SENTINEL: Read the four fixture files then report.'}];
 if(withVideo)prompt.push({type:'resource_link',uri:'file:'+video,name:'incident-video.mp4',mimeType:'video/mp4'});
 await rpc('session/prompt',{sessionId:session.sessionId,prompt});
 const report={variant,nativeBinary:process.env.TRAJECTORY_NATIVE_BINARY||'installed-default',sessionId:session.sessionId,requests:requests.length,secondRequestRetainsUser:JSON.stringify(requests[1]?.contents).includes('USER_PRESERVATION_SENTINEL'),secondRequestRetainsToolResults:JSON.stringify(requests[1]?.contents).includes('READ_SENTINEL_'),updates,liveModelCalls:0};
 report.mediaCounts=requests.map(r=>(r.contents||[]).flatMap(c=>c.parts||[]).filter(p=>p.inlineData?.mimeType==='video/mp4').length);
 report.signatureBytes=largeSignature?20*1024*1024:0;
 report.passed=report.requests===2&&report.secondRequestRetainsUser&&report.secondRequestRetainsToolResults&&(!withVideo||report.mediaCounts.every(n=>n===1))&&updates.some(x=>x.sessionUpdate==='agent_message_chunk'&&x.content?.text?.includes('OFFLINE_FINALIZATION_OK'));
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,updates:updates.map(x=>({type:x.sessionUpdate,text:x.content?.text,status:x.status}))}));
 if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{for(const p of pending.values())clearTimeout(p.timer);if(child){child.stdin.end();setTimeout(()=>{spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});server.closeAllConnections();server.close()},1500).unref();child.once('close',()=>{server.closeAllConnections();server.close()})}else server.close()});
