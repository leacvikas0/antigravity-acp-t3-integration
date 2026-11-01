const readline=require('node:readline');
let promptId;
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);
 if(m.method==='session/prompt'){
  promptId=m.id;
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session/update',params:{sessionId:'test',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'漢字🙂'.repeat(150000)}}}})+'\n');
 }else if(m.method==='session/cancel'){
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:promptId,result:{stopReason:'cancelled'}})+'\n');
 }else if(m.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{echo:m.params}})+'\n');
});
