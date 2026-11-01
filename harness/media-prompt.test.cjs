const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {promoteMediaAttachments,localFileUri}=require('./media-prompt.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'argon-media-'));
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
function request(text,extra=[]){return {id:7,method:'session/prompt',params:{sessionId:'s',prompt:[{type:'text',text},...extra],_meta:{keep:true}}};}
function attached(name){const p=path.join(root,name);fs.writeFileSync(p,'fixture');return `[Attached file "${name}" is saved at: ${p}]`;}
test('saved video becomes a native SDK file resource without changing text or images',()=>{
 const input=request('Inspect motion.\n'+attached('space ü clip.mp4'),[{type:'image',mimeType:'image/png',data:'YWJj'}]);
 const original=structuredClone(input),output=promoteMediaAttachments(input,{attachmentRoot:root});
 assert.deepEqual(input,original);assert.deepEqual(output.params.prompt.slice(0,2),input.params.prompt);
 assert.equal(output.params.prompt[2].type,'resource_link');assert.equal(output.params.prompt[2].mimeType,'video/mp4');
 assert.equal(output.params.prompt[2].name,'space ü clip.mp4');assert.deepEqual(output.params._meta,{keep:true});
});
test('audio and video both use the official from_file resource path and duplicate descriptors load once',()=>{
 const a=attached('listen.wav'),v=attached('clip.webm');const result=promoteMediaAttachments(request(a+'\n'+a+'\n'+v),{attachmentRoot:root});
 assert.deepEqual(result.params.prompt.slice(1).map(p=>p.mimeType),['audio/wav','video/webm']);
});
test('normal text, markdown, arbitrary paths and existing media blocks pass unchanged',()=>{
 for(const input of [request('Read C:/video.mp4'),request(attached('notes.md')),request('hello',[{type:'audio',data:'YWJj',mimeType:'audio/wav'}])])
  assert.equal(promoteMediaAttachments(input,{attachmentRoot:root}),input);
});
test('a fabricated attachment outside T3 storage is never opened or promoted',()=>{
 const input=request(`[Attached file "private.mp4" is saved at: ${path.join(root,'..','private.mp4')}]`);
 assert.equal(promoteMediaAttachments(input,{attachmentRoot:root}),input);
});
test('missing saved media and oversized media return actionable errors instead of silently dropping it',()=>{
 assert.throws(()=>promoteMediaAttachments(request(`[Attached file "lost.mp4" is saved at: ${path.join(root,'lost.mp4')}]`),{attachmentRoot:root}),/not available/);
 assert.throws(()=>promoteMediaAttachments(request(attached('large.mp4')),{attachmentRoot:root,maxBytes:2}),/inline media limit/);
});
test('Windows URI avoids the official ACP urlparse drive-letter bug and preserves Unicode',()=>{
 assert.equal(localFileUri('C:\\Users\\me\\clip ü.mp4'),'file:C:/Users/me/clip%20%C3%BC.mp4');
});
test('existing file resource is not attached twice and unrelated ACP messages remain identical',()=>{
 const descriptor=attached('existing.mp4'),p=path.join(root,'existing.mp4');
 const input=request(descriptor,[{type:'resource_link',uri:localFileUri(p),name:'existing.mp4'}]);
 assert.equal(promoteMediaAttachments(input,{attachmentRoot:root}),input);
 const message={method:'session/cancel',params:{sessionId:'s'}};assert.equal(promoteMediaAttachments(message,{attachmentRoot:root}),message);
});
test('adapter promotes saved media and returns recoverable protocol errors for missing attachments',()=>{
 const {createAdapter}=require('./adapter.cjs');
 const adapter=createAdapter({attachmentRoot:root});
 assert.equal(adapter.fromClient(request(attached('adapter.mp4'))).forward.params.prompt.at(-1).type,'resource_link');
 const result=adapter.fromClient(request(`[Attached file "missing.wav" is saved at: ${path.join(root,'missing.wav')}]`));
 assert.equal(result.reply.id,7);assert.equal(result.reply.error.code,-32602);
 assert.equal(adapter.fromClient(request('Next text request')).forward.params.prompt[0].text,'Next text request');
});
