const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const net=require('node:net');
const home=process.env.USERPROFILE;
const root=__dirname;
const config=JSON.parse(fs.readFileSync(path.join(root,'proxy-supervisor/config.json'),'utf8'));
// Start the native singleton directly; PowerShell/WMI can hang before ACP starts.
const {ensureWatcher}=require('./proxy-bootstrap.cjs');
const {writeRuntimeFile}=require('./runtime-files.cjs');
function ready(){return new Promise(resolve=>{const req=http.get(config.base_url+'/api/status',{timeout:2000},res=>{let body='';res.on('data',d=>body+=d);res.on('end',()=>{try{const s=JSON.parse(body);resolve(res.statusCode===200&&s.running&&s.ready);}catch{resolve(false);}});});req.on('error',()=>resolve(false));req.on('timeout',()=>{req.destroy();resolve(false);});});}
(async()=>{
 await ensureWatcher(config.native_exe,path.join(root,'proxy-supervisor/config.json'));
 const deadline=Date.now()+150000;
 while(!await ready()){if(Date.now()>deadline){process.stderr.write('Local Argon proxy did not become ready within 150 seconds.\n');process.exit(1);}await new Promise(r=>setTimeout(r,1000));}
 // ACP 1.4.3 cannot tolerate an offline MCP. Keep the complete source config,
 // but omit the local Blender endpoint from this session when Blender is closed.
 const mcp=JSON.parse(fs.readFileSync(path.join(home,'.gemini/config/mcp_config.json'),'utf8'));
 for(const [name,server] of Object.entries(mcp.mcpServers)){
  if(server.disabled||name==='t3-code'){delete mcp.mcpServers[name];continue;}
  if(server.serverUrl){server.url=server.serverUrl;delete server.serverUrl;}
 }
 if(mcp.mcpServers.blender){
  const url=new URL(mcp.mcpServers.blender.url||mcp.mcpServers.blender.serverUrl);
  if(['127.0.0.1','localhost','[::1]'].includes(url.hostname)){
   const online=await new Promise(resolve=>{const socket=net.connect({host:url.hostname,port:Number(url.port)||80});const finish=v=>{socket.destroy();resolve(v);};socket.setTimeout(500,()=>finish(false));socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));});
   if(!online){delete mcp.mcpServers.blender;process.stderr.write('Blender MCP is offline; its saved configuration will load when Blender is running.\n');}
  }
 }
 const runtime=path.join(root,'t3-home');
 const instructions=path.join(home,'.gemini/GEMINI.md');
 if(fs.existsSync(instructions))await writeRuntimeFile(path.join(runtime,'GEMINI.md'),fs.readFileSync(instructions));
 const settingsData=JSON.parse(fs.readFileSync(path.join(root,'settings.json'),'utf8'));
 for(const [relative,data] of [['config/mcp_config.json',mcp],['antigravity-acp/settings.json',settingsData],['antigravity-cli/settings.json',settingsData]]){
  await writeRuntimeFile(path.join(runtime,relative),JSON.stringify(data,null,2));
 }
 const executable=path.join(root,'bin/1.4.3/agy_acp_server.exe');
 const options={cwd:root,env:{...process.env,GEMINI_HOME:runtime,ARGON_ACP_FULL_ACCESS:'1'}};
 if(process.env.ARGON_ACP_ADAPTER==='0'){
  const child=spawn(executable,process.argv.slice(2),{...options,stdio:'inherit',windowsHide:true});
  child.on('error',e=>{process.stderr.write(e.message+'\n');process.exit(1);});child.on('exit',code=>process.exit(code??1));
 }else require('./adapter.cjs').run(executable,process.argv.slice(2),options);
})().catch(error=>{process.stderr.write(`Antigravity startup failed: ${error.message}\n`);process.exitCode=1;});