'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');

// Multiple ACP probes and sessions share this runtime home. Avoid opening an
// unchanged destination for writing, and never expose a partly written file.
async function writeRuntimeFile(target,data){
 const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);
 let temporary;
 try{
  for(let attempt=0;attempt<10;attempt++){
   try{
    try{if((await fs.readFile(target)).equals(bytes))return false;}
    catch(error){if(error.code!=='ENOENT')throw error;}
    if(!temporary){
     await fs.mkdir(path.dirname(target),{recursive:true});
     temporary=`${target}.${process.pid}.${randomUUID()}.tmp`;
     await fs.writeFile(temporary,bytes,{flag:'wx'});
    }
    await fs.rename(temporary,target);temporary=undefined;return true;
   }catch(error){
    if(!['EBUSY','EPERM','EACCES'].includes(error.code)||attempt===9)throw error;
    await delay(Math.min(50*(attempt+1),250));
   }
  }
 }finally{if(temporary)await fs.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
module.exports={writeRuntimeFile};
