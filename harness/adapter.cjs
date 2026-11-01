'use strict';
const FAMILY='gemini-4-argon';
const LEVELS=['low','medium','high'];
const variant=level=>`${FAMILY}-${level}`;
const levelOf=id=>LEVELS.find(level=>variant(level)===id);

function stripT3PromptBlock(block){
 if(block?.type!=='text'||typeof block.text!=='string')return block;
 let text=block.text;
 if(!text.includes('<t3_code_instructions>')&&!text.includes('<pull_request_linking>')&&!text.includes('<user_request>'))return block;
 text=text
  .replace(/<t3_code_instructions>[\s\S]*?<\/t3_code_instructions>\s*/g,'')
  .replace(/\s*<pull_request_linking>[\s\S]*?<\/pull_request_linking>\s*/g,'')
  .replace(/<user_request>\r?\n?([\s\S]*?)\r?\n?<\/user_request>/g,'$1');
 return text===block.text?block:{...block,text};
}

function createModeGate(nextId=()=>`argon-full-access:${require('node:crypto').randomUUID()}`){
 const starts=new Map(),held=new Map();
 return {
  track(message){if(message.id!==undefined&&['session/new','session/load','session/resume','session/fork'].includes(message.method))starts.set(message.id,message.params?.sessionId);},
  handle(message){
   if(message.method)return {forward:message};
   if(held.has(message.id)){
    const original=held.get(message.id);held.delete(message.id);
    if(message.error)return {forward:{...message,id:original.id}};
    if(message.result?.configOptions?.find(o=>o.id==='mode')?.currentValue!=='yolo')throw Error('ACP did not confirm full access mode.');
    return {forward:{...original,result:{...original.result,configOptions:message.result.configOptions,modes:{...original.result.modes,currentModeId:'yolo'}}}};
   }
   if(!starts.has(message.id))return {forward:message};
   const sid=message.result?.sessionId??starts.get(message.id);starts.delete(message.id);
   if(message.error||!sid)return {forward:message};
   if(message.result.configOptions?.find(o=>o.id==='mode')?.currentValue==='yolo')return {forward:message};
   const id=nextId();held.set(id,message);
   return {request:{jsonrpc:'2.0',id,method:'session/set_config_option',params:{sessionId:sid,configId:'mode',value:'yolo'}}};
  }
 };
}

function createAdapter({mcpServers=[],fullAccess=false,attachmentRoot,disableWebSearch=false,stripT3=false,systemPromptAppend}={}){
 const sessions=new Map(),pending=new Map();
 const selected=sid=>sessions.get(sid)??'high';
 function project(payload,sid){
  if(!payload||typeof payload!=='object')return payload;
  const model=payload.configOptions?.find(option=>option.category==='model'||option.id==='model');
  const offered=payload.models?.availableModels?.map(m=>m.modelId)
   ??model?.options?.flatMap(option=>option.options??[option]).map(option=>option.value);
  if(offered&&(offered.length!==3||LEVELS.some(level=>!offered.includes(variant(level)))))
   throw Error('Argon upstream catalog changed; adapter requires exactly Low, Medium and High.');
  const current=levelOf(model?.currentValue)??levelOf(payload.models?.currentModelId);
  if(current&&sid)sessions.set(sid,current);
  const level=current??selected(sid);
  const result={...payload};
  if(payload.models)result.models={...payload.models,currentModelId:FAMILY,availableModels:[{modelId:FAMILY,name:'Gemini 4 Argon',description:'Gemini 4 Argon; reasoning is selected separately.'}]};
  if(model){
   result.configOptions=payload.configOptions.flatMap(option=>{
    if(option!==model)return [option];
    return [{...option,currentValue:FAMILY,options:[{value:FAMILY,name:'Gemini 4 Argon'}]},
     {id:'thinking_level',name:'Reasoning',category:'thought_level',type:'select',currentValue:level,options:LEVELS.map(value=>({value,name:value[0].toUpperCase()+value.slice(1)}))}];
   });
  }
  if(fullAccess){
   // Permissions are enforced internally; T3 already has its own access control.
   result.configOptions=result.configOptions?.filter(option=>option.id!=='mode');
   if(result.modes?.currentModeId==='yolo')result.modes={...result.modes,availableModes:[{id:'yolo',name:'Full access',description:'Auto-approve all tools'}]};
  }
  return result;
 }
 return {
  fromClient(message){
   if(attachmentRoot){
    try{message=require('./media-prompt.cjs').promoteMediaAttachments(message,{attachmentRoot});}
    catch(error){return {reply:{jsonrpc:'2.0',id:message.id,error:{code:-32602,message:error.message}}};}
   }
   if(stripT3&&message.method==='session/prompt'&&Array.isArray(message.params?.prompt)){
    const cleaned=message.params.prompt.map(stripT3PromptBlock);
    if(cleaned.some((b,i)=>b!==message.params.prompt[i]))message={...message,params:{...message.params,prompt:cleaned}};
   }
   let forward=message,desired;
   const p=message.params,sid=p?.sessionId;
   if(fullAccess&&message.method==='session/set_mode')forward={...message,params:{...p,modeId:'yolo'}};
   if(fullAccess&&message.method==='session/set_config_option'&&p?.configId==='mode')forward={...message,params:{...p,value:'yolo'}};
   if((mcpServers.length||stripT3)&&['session/new','session/load','session/resume','session/fork'].includes(message.method)){
    const configured=new Set(mcpServers.map(server=>server.name));
    const rawClient=p?.mcpServers??[];
    const clientServers=stripT3?rawClient.filter(server=>server?.name!=='t3-code'):rawClient;
    if(mcpServers.length||clientServers.length!==rawClient.length){
     const merged=new Map(clientServers.map(server=>[server.name,server]));
     for(const server of mcpServers)if(!merged.has(server.name))merged.set(server.name,server);
     const entries=[...merged.values()].map(server=>configured.has(server.name)?{...server,_meta:{...server._meta,antigravity:{...server._meta?.antigravity,forceAllToolsEager:server._meta?.antigravity?.forceAllToolsEager??true}}}:server);
     forward={...forward,params:{...forward.params,mcpServers:entries}};
    }
   }
   if((disableWebSearch||systemPromptAppend)&&['session/new','session/load','session/resume','session/fork'].includes(message.method)){
    const params=forward.params??{},meta=params._meta??{};
    const agy={...meta.agy,...meta.antigravity};
    if(disableWebSearch)agy.disabledTools=[...new Set([...(Array.isArray(agy.disabledTools)?agy.disabledTools:[]),'search_web'])];
    if(systemPromptAppend){
     const existing=typeof agy.systemPrompt?.append==='string'?agy.systemPrompt.append:'';
     const append=existing.split('\n').some(line=>line.trim()===systemPromptAppend)?existing:[existing,systemPromptAppend].filter(Boolean).join('\n');
     agy.systemPrompt={...agy.systemPrompt,append};
    }
    forward={...forward,params:{...params,_meta:{...meta,antigravity:agy}}};
   }
   if(message.method==='session/set_config_option'){
    if(p?.configId==='thinking_level'){
     if(!LEVELS.includes(p.value))return {reply:{jsonrpc:'2.0',id:message.id,error:{code:-32602,message:'Reasoning must be low, medium or high.'}}};
     desired=p.value;forward={...message,params:{...p,configId:'model',value:variant(desired)}};
    }else if(p?.configId==='model'&&p.value===FAMILY){
     forward={...message,params:{...p,value:variant(selected(sid))}};
    }else if(p?.configId==='model')desired=levelOf(p.value);
   }else if(message.method==='session/set_model'){
    if(p?.modelId===FAMILY)forward={...message,params:{...p,modelId:variant(selected(sid))}};
    else desired=levelOf(p?.modelId);
   }
   if(message.id!==undefined&&message.method)pending.set(message.id,{method:message.method,sid,desired});
   return {forward};
  },
  fromAgent(message){
   if(message.method==='session/update'&&message.params?.update?.sessionUpdate==='config_option_update'){
    return {...message,params:{...message.params,update:project(message.params.update,message.params.sessionId)}};
   }
   if(message.id===undefined||message.method)return message;
   const request=pending.get(message.id);pending.delete(message.id);
   if(!request||message.error||!message.result)return message;
   if(!['session/new','session/load','session/resume','session/fork','session/set_config_option','session/set_model','session/set_mode'].includes(request.method))return message;
   const sid=message.result.sessionId??request.sid;
   if(request.desired&&sid)sessions.set(sid,request.desired);
   return {...message,result:project(message.result,sid)};
  }
 };
}

function run(executable,args,options){
 const {spawn}=require('node:child_process');
 const readline=require('node:readline');
 const {once}=require('node:events');
 let mcpServers=[];
 if(options?.env?.GEMINI_HOME){
  const fs=require('node:fs'),path=require('node:path');
  const config=JSON.parse(fs.readFileSync(path.join(options.env.GEMINI_HOME,'config/mcp_config.json'),'utf8'));
  mcpServers=Object.entries(config.mcpServers??{}).filter(([,server])=>!server.disabled).map(([name,server])=>server.command
   ?{name,command:server.command,args:server.args??[],env:Object.entries(server.env??{}).map(([name,value])=>({name,value:String(value)}))}
   :{name,type:'http',url:server.url??server.serverUrl,headers:Object.entries(server.headers??{}).map(([name,value])=>({name,value:String(value)}))});
 }
 const fullAccess=options?.env?.ARGON_ACP_FULL_ACCESS==='1';
 const stripT3=options?.env?.ARGON_ACP_KEEP_T3_BLOAT!=='1';
 const attachmentRoot=options?.env?.ARGON_ACP_NATIVE_MEDIA==='0'?undefined:require('node:path').join(options?.env?.USERPROFILE??process.env.USERPROFILE,'.t3/userdata/attachments');
 const adapter=createAdapter({mcpServers,fullAccess,attachmentRoot,disableWebSearch:true,stripT3,systemPromptAppend:'Use the Parallel Search MCP for web searches and fetching web pages.'});
 const modeGate=fullAccess?createModeGate():null;
 const spawnOptions=options?{...options}: {};
 if(stripT3&&spawnOptions.env){
  const env={...spawnOptions.env};
  delete env.T3_ACP_MCP_ENDPOINT;
  delete env.T3_ACP_MCP_AUTHORIZATION;
  delete env.T3_ACP_MCP_ENTRYPOINT;
  delete env.T3_ACP_MCP_NODE;
  spawnOptions.env=env;
 }
 const child=spawn(executable,args,{...spawnOptions,windowsHide:true,stdio:['pipe','pipe','inherit']});
 let closing=false;
 const write=async(stream,message)=>{if(!stream.write(JSON.stringify(message)+'\n'))await once(stream,'drain');};
 const kill=()=>{if(!child.pid)return;spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});};
 const fail=error=>{if(closing)return;closing=true;process.stderr.write(`Argon ACP adapter: ${error.message}\n`);kill();process.exitCode=1;process.stdin.destroy();};
 child.once('error',fail);
 child.stdin.on('error',fail);
 const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
 const output=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const inputDone=(async()=>{
  for await(const line of input){if(!line.trim())continue;const {forward,reply}=adapter.fromClient(JSON.parse(line));if(reply)await write(process.stdout,reply);else{modeGate?.track(forward);await write(child.stdin,forward);}}
  child.stdin.end();
  const timer=setTimeout(kill,30000);timer.unref();
 })().catch(fail);
 const outputDone=(async()=>{for await(const line of output){if(!line.trim())continue;const m=JSON.parse(line);const {forward,request}=modeGate?.handle(m)??{forward:m};if(request)await write(child.stdin,request);if(forward)await write(process.stdout,adapter.fromAgent(forward));}})().catch(fail);
 child.once('close',async code=>{closing=true;input.close();process.stdin.destroy();await outputDone;process.exitCode=process.exitCode||code||0;});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{closing=true;kill();input.close();process.stdin.destroy();});
 return {child,inputDone,outputDone};
}
module.exports={createAdapter,createModeGate,stripT3PromptBlock,run};