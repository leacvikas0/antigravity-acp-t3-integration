const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const readline=require('node:readline');
test('real pipes preserve large Unicode/image messages and deliver cancellation during a prompt', {timeout:15000}, async()=>{
 const program=`require(${JSON.stringify(path.join(__dirname,'adapter.cjs'))}).run(process.execPath,[${JSON.stringify(path.join(__dirname,'adapter-fixture.cjs'))}],{});`;
 const worker=spawn(process.execPath,['-e',program],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let errors='';worker.stderr.on('data',d=>errors+=d);
 const lines=readline.createInterface({input:worker.stdout});
 const iter=lines[Symbol.asyncIterator]();
 const send=message=>worker.stdin.write(JSON.stringify(message)+'\n');
 try{
  const params={text:'context'.repeat(200000),image:{data:'A'.repeat(1000000),mimeType:'image/png'}};
  send({jsonrpc:'2.0',id:1,method:'extension/echo',params});
  assert.deepEqual(JSON.parse((await iter.next()).value).result.echo,params);
  send({jsonrpc:'2.0',id:2,method:'session/prompt',params:{sessionId:'test',prompt:[]}});
  assert.equal(JSON.parse((await iter.next()).value).params.update.content.text,'漢字🙂'.repeat(150000));
  send({jsonrpc:'2.0',method:'session/cancel',params:{sessionId:'test'}});
  assert.deepEqual(JSON.parse((await iter.next()).value),{jsonrpc:'2.0',id:2,result:{stopReason:'cancelled'}});
  worker.stdin.end();
  const code=await new Promise(resolve=>worker.once('close',resolve));
  assert.equal(code,0,errors);
 }finally{worker.kill();lines.close();}
});
