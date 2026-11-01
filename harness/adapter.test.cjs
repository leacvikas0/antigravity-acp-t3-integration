const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAdapter,createModeGate,stripT3PromptBlock}=require('./adapter.cjs');
const levels=['low','medium','high'];
function setup(sessionId='s',level='high'){
 return {jsonrpc:'2.0',id:1,result:{sessionId,models:{currentModelId:`gemini-4-argon-${level}`,availableModels:levels.map(l=>({modelId:`gemini-4-argon-${l}`,name:`Gemini 4 Argon (${l})`}))},configOptions:[{id:'model',name:'Model',category:'model',type:'select',currentValue:`gemini-4-argon-${level}`,options:levels.map(l=>({value:`gemini-4-argon-${l}`,name:l}))},{id:'mode',name:'Mode',category:'mode',type:'select',currentValue:'default',options:[{value:'default',name:'Default'}]}],_meta:{untouched:true}}};
}
function initialized(a,s='s',level='high'){
 a.fromClient({jsonrpc:'2.0',id:1,method:'session/new',params:{cwd:'C:/work',mcpServers:[]}});
 return a.fromAgent(setup(s,level));
}
test('one model and native thought_level descriptor; original payload is unchanged',()=>{
 const a=createAdapter(),raw=setup(),before=structuredClone(raw);
 a.fromClient({id:1,method:'session/new',params:{}});const r=a.fromAgent(raw).result;
 assert.deepEqual(raw,before);assert.equal(r.models.availableModels.length,1);assert.equal(r.models.currentModelId,'gemini-4-argon');
 assert.equal(r.configOptions[0].options[0].value,'gemini-4-argon');
 assert.deepEqual(r.configOptions[1],{id:'thinking_level',name:'Reasoning',category:'thought_level',type:'select',currentValue:'high',options:[{value:'low',name:'Low'},{value:'medium',name:'Medium'},{value:'high',name:'High'}]});
 assert.deepEqual(r.configOptions[2],raw.result.configOptions[1]);assert.deepEqual(r._meta,{untouched:true});
});
test('Parallel policy disables only native search_web across session lifecycle and preserves client metadata',()=>{
 const a=createAdapter({disableWebSearch:true,mcpServers:[{name:'parallel-search',type:'http',url:'https://search.parallel.ai/mcp',headers:[]}]});
 for(const method of ['session/new','session/load','session/resume','session/fork']){
  const input={id:20,method,params:{cwd:'C:/work',sessionId:'s',_meta:{keep:true,antigravity:{disabledTools:['generate_image'],systemPrompt:{append:'Existing client instruction'}}}}};
  const before=structuredClone(input),result=a.fromClient(input).forward;
  assert.deepEqual(input,before);
  assert.deepEqual(result.params._meta.antigravity.disabledTools,['generate_image','search_web']);
  assert.deepEqual(result.params._meta.antigravity.systemPrompt,{append:'Existing client instruction'});
  assert.equal(result.params._meta.keep,true);assert.equal(result.params.mcpServers[0].name,'parallel-search');
 }
});
test('Parallel policy does not inject a system prompt or disable native fetch/browser/file tools',()=>{
 const a=createAdapter({disableWebSearch:true});
 const output=a.fromClient({id:1,method:'session/new',params:{cwd:'C:/work'}}).forward;
 assert.deepEqual(output.params._meta,{antigravity:{disabledTools:['search_web']}});
 const prompt={id:2,method:'session/prompt',params:{sessionId:'s',prompt:[{type:'text',text:'Search the web'}]}};
 assert.deepEqual(a.fromClient(prompt).forward,prompt);
});
test('Parallel instruction uses official systemPrompt append and preserves existing client instructions',()=>{
 const line='Use the Parallel Search MCP for web searches and fetching web pages.';
 const a=createAdapter({disableWebSearch:true,systemPromptAppend:line});
 for(const method of ['session/new','session/load','session/resume','session/fork']){
  const q={id:3,method,params:{sessionId:'s',_meta:{keep:true,antigravity:{systemPrompt:{append:'Existing client instruction'}}}}};
  const before=structuredClone(q),result=a.fromClient(q).forward;
  assert.deepEqual(q,before);assert.equal(result.params._meta.antigravity.systemPrompt.append,'Existing client instruction\n'+line);
  assert.equal(result.params._meta.keep,true);assert.deepEqual(result.params._meta.antigravity.disabledTools,['search_web']);
  assert.deepEqual(a.fromClient(result).forward,result);
 }
 const prompt={id:9,method:'session/prompt',params:{sessionId:'s',prompt:[{type:'text',text:'Hello'}]}};
 assert.deepEqual(a.fromClient(prompt).forward,prompt);
});

test('each reasoning change maps to official model config; failures do not change selection',()=>{
 const a=createAdapter();initialized(a);
 for(const level of levels){
  const q={jsonrpc:'2.0',id:9,method:'session/set_config_option',params:{sessionId:'s',configId:'thinking_level',value:level,_meta:{preserve:1}}};
  assert.deepEqual(a.fromClient(q).forward,{...q,params:{...q.params,configId:'model',value:`gemini-4-argon-${level}`}});
  a.fromAgent({id:9,error:{code:-32602,message:'rejected'}});
  assert.equal(a.fromClient({id:10,method:'session/set_config_option',params:{sessionId:'s',configId:'model',value:'gemini-4-argon'}}).forward.params.value,'gemini-4-argon-high');
 }
});
test('successful settings persist per session, including notifications and restore',()=>{
 const a=createAdapter();initialized(a,'a');initialized(a,'b','low');
 a.fromClient({id:5,method:'session/set_config_option',params:{sessionId:'a',configId:'thinking_level',value:'medium'}});
 a.fromAgent({id:5,result:{}});
 for(const [sessionId,level] of [['a','medium'],['b','low']])assert.equal(a.fromClient({id:7,method:'session/set_model',params:{sessionId,modelId:'gemini-4-argon'}}).forward.params.modelId,`gemini-4-argon-${level}`);
 const update={method:'session/update',params:{sessionId:'b',update:{sessionUpdate:'config_option_update',configOptions:setup('b','high').result.configOptions}}};
 const projected=a.fromAgent(update);assert.equal(projected.params.update.configOptions[1].currentValue,'high');
 assert.equal(a.fromClient({id:8,method:'session/set_model',params:{sessionId:'b',modelId:'gemini-4-argon'}}).forward.params.modelId,'gemini-4-argon-high');
 a.fromClient({id:20,method:'session/load',params:{sessionId:'restored'}});const restored=setup('restored','low');restored.id=20;a.fromAgent(restored);
 assert.equal(a.fromClient({id:21,method:'session/set_model',params:{sessionId:'restored',modelId:'gemini-4-argon'}}).forward.params.modelId,'gemini-4-argon-low');
});
test('reject unsupported reasoning instead of silently lowering effort',()=>{
 const a=createAdapter();initialized(a);
 const r=a.fromClient({jsonrpc:'2.0',id:'bad',method:'session/set_config_option',params:{sessionId:'s',configId:'thinking_level',value:'max'}});
 assert.equal(r.forward,undefined);assert.equal(r.reply.id,'bad');assert.equal(r.reply.error.code,-32602);
});
test('prompt, tool results, permissions, images, cancellation and errors pass through intact',()=>{
 const a=createAdapter();initialized(a);
 for(const message of [
  {id:3,method:'session/prompt',params:{sessionId:'s',prompt:[{type:'text',text:'--dYT,'.repeat(200000)},{type:'image',data:'AAA=',mimeType:'image/png'}]}},
  {method:'session/cancel',params:{sessionId:'s'}},
  {id:9,result:{outcome:{outcome:'selected',optionId:'allow-once'}}},
  {method:'extension/unknown',params:{modelId:'preserve-this',nested:{x:1}}},
 ])assert.deepEqual(a.fromClient(message).forward,message);
 for(const message of [
  {id:9,method:'session/request_permission',params:{options:[{optionId:'allow-once'}]}},
  {method:'session/update',params:{update:{sessionUpdate:'tool_call_update',rawOutput:{huge:'a'.repeat(2000000)}}}},
  {id:3,error:{code:-32000,message:'auth required',data:{retry:false}}},
 ])assert.deepEqual(a.fromAgent(message),message);
});
test('unexpected upstream roster fails explicitly instead of misrepresenting capability',()=>{
 const a=createAdapter();a.fromClient({id:1,method:'session/new',params:{}});const r=setup();r.result.models.availableModels.pop();
 assert.throws(()=>a.fromAgent(r),/Argon.*catalog/);
});
test('unrelated extension response fields are not rewritten',()=>{
 const a=createAdapter();a.fromClient({id:77,method:'extension/catalog',params:{}});
 const r={id:77,result:{models:{currentModelId:'other',availableModels:[]}}};
 assert.deepEqual(a.fromAgent(r),r);
});
test('configured MCPs use native eager tools while T3 client configuration takes priority',()=>{
 const servers=[{name:'search',type:'http',url:'https://example.test/mcp',headers:[]},{name:'image',command:'python',args:['image.py'],env:[]}];
 const a=createAdapter({mcpServers:servers});
 const message={id:1,method:'session/new',params:{cwd:'C:/work',mcpServers:[{name:'t3-code',type:'http',url:'http://localhost:1/mcp',headers:[]},{name:'search',type:'http',url:'https://client.test/mcp',headers:[]}],_meta:{custom:'preserved'}}};
 const before=structuredClone(message);const result=a.fromClient(message).forward;
 assert.deepEqual(message,before);assert.equal(result.params.mcpServers.length,3);
 assert.deepEqual(result.params.mcpServers[0],message.params.mcpServers[0]);
 assert.equal(result.params.mcpServers[1].url,'https://client.test/mcp');
 assert.equal(result.params.mcpServers[1]._meta.antigravity.forceAllToolsEager,true);
 assert.equal(result.params.mcpServers[2]._meta.antigravity.forceAllToolsEager,true);
 assert.deepEqual(result.params._meta,{custom:'preserved'});
});
test('stripT3 removes t3-code MCP server and strips injected T3 XML blocks while preserving user text and runtime_info',()=>{
 const servers=[{name:'parallel-search',type:'http',url:'https://search.parallel.ai/mcp',headers:[]}];
 const a=createAdapter({mcpServers:servers,stripT3:true});
 for(const method of ['session/new','session/load','session/resume','session/fork']){
  const msg={id:1,method,params:{cwd:'C:/work',mcpServers:[{name:'t3-code',type:'http',url:'http://127.0.0.1:3773/mcp',headers:[]}]}};
  const res=a.fromClient(msg).forward;
  assert.equal(res.params.mcpServers.length,1);
  assert.equal(res.params.mcpServers[0].name,'parallel-search');
 }
 const wrapped='<t3_code_instructions>\n## T3 Code interaction mode\nUse html_preview.\n</t3_code_instructions>\n\n<user_request>\nBuild the 3D scene\n</user_request> <runtime_info>Running in T3 Code.</runtime_info>\n\n<pull_request_linking>\nLink PRs.\n</pull_request_linking>';
 const promptMsg={id:2,method:'session/prompt',params:{sessionId:'s',prompt:[{type:'text',text:wrapped},{type:'image',data:'AAA=',mimeType:'image/png'}]}};
 const forwarded=a.fromClient(promptMsg).forward;
 assert.equal(forwarded.params.prompt[0].text,'Build the 3D scene <runtime_info>Running in T3 Code.</runtime_info>');
 assert.deepEqual(forwarded.params.prompt[1],promptMsg.params.prompt[1]);
});
test('full access hides redundant permissions while preserving reasoning and enforcement',()=>{
 const a=createAdapter({fullAccess:true});
 const result=initialized(a).result;
 assert.equal(result.configOptions.some(o=>o.id==='mode'),false);
 assert.deepEqual(result.configOptions.find(o=>o.id==='thinking_level').options.map(o=>o.name),['Low','Medium','High']);
 const update=a.fromAgent({method:'session/update',params:{sessionId:'s',update:{sessionUpdate:'config_option_update',configOptions:[{id:'mode',currentValue:'yolo'}]}}});
 assert.deepEqual(update.params.update.configOptions,[]);
});
test('full access is applied upstream before a new session is acknowledged',()=>{
 const gate=createModeGate(()=> 'internal-mode');gate.track({id:1,method:'session/new',params:{}});
 const held=gate.handle(setup());assert.equal(held.forward,undefined);assert.equal(held.request.params.value,'yolo');
 const released=gate.handle({id:'internal-mode',result:{configOptions:[{id:'mode',currentValue:'yolo'}]}}).forward;
 assert.equal(released.id,1);assert.equal(released.result.configOptions[0].currentValue,'yolo');
 const a=createAdapter({fullAccess:true});
 assert.equal(a.fromClient({id:2,method:'session/set_mode',params:{sessionId:'s',modeId:'default'}}).forward.params.modeId,'yolo');
 assert.equal(a.fromClient({id:3,method:'session/set_config_option',params:{sessionId:'s',configId:'mode',value:'auto_edit'}}).forward.params.value,'yolo');
});