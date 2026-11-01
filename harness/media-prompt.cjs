'use strict';
const fs=require('node:fs'),path=require('node:path');
// These are formats accepted by the installed official SDK's from_file().
const MIME={'.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4','.aac':'audio/aac','.ogg':'audio/ogg','.opus':'audio/opus','.flac':'audio/flac',
 '.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.avi':'video/avi','.mpeg':'video/mpeg','.mpg':'video/mpg','.3gp':'video/3gpp','.wmv':'video/wmv','.flv':'video/x-flv'};
function localFileUri(file){
 const normalized=file.replaceAll('\\','/');
 // ACP 1.4.3 uses urlparse(uri).path literally. file:///C:/... incorrectly
 // becomes /C:/... on Windows; file:C:/... retains the absolute drive path.
 return 'file:'+normalized.split('/').map((s,i)=>i===0&&/^[a-z]:$/i.test(s)?s:encodeURIComponent(s)).join('/');
}
function within(file,root){const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
function promoteMediaAttachments(message,{attachmentRoot,maxBytes=100*1024*1024}={}){
 if(message.method!=='session/prompt'||!attachmentRoot||!Array.isArray(message.params?.prompt))return message;
 const prompt=message.params.prompt,extra=[],seen=new Set(prompt.filter(p=>p.type==='resource_link').map(p=>p.uri));
 const root=path.resolve(attachmentRoot);let total=0;
 for(const block of prompt){
  if(block.type!=='text'||typeof block.text!=='string')continue;
  for(const match of block.text.matchAll(/^\[Attached file "([^"\r\n]+)" is saved at: ([^\r\n]+)\]\s*$/gm)){
   const name=match[1],file=path.resolve(match[2]),mimeType=MIME[path.extname(file).toLowerCase()];
   if(!mimeType||!within(file,root))continue;
   const uri=localFileUri(file);if(seen.has(uri))continue;
   let stat;try{stat=fs.statSync(file);if(!within(fs.realpathSync(file),fs.realpathSync(root)))throw Error('outside storage');}
   catch{throw Error(`Attached media "${name}" is not available in T3 attachment storage. Reattach the file.`);}
   if(!stat.isFile()||stat.size===0)throw Error(`Attached media "${name}" is not a non-empty regular file.`);
   total+=stat.size;if(total>maxBytes)throw Error(`Attached media exceeds the ${Math.floor(maxBytes/1048576)} MiB inline media limit. Use a shorter clip; no media was truncated.`);
   seen.add(uri);extra.push({type:'resource_link',uri,name,mimeType,description:`User-attached media: ${name}`});
  }
 }
 return extra.length?{...message,params:{...message.params,prompt:[...prompt,...extra]}}:message;
}
module.exports={promoteMediaAttachments,localFileUri};
