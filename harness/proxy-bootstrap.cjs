const {spawn}=require('node:child_process');
const path=require('node:path');

// The native watcher discovers T3 by its configured executable and owns the
// singleton mutex. Duplicate launches exit safely; no WMI/shell is required.
async function ensureWatcher(executable,configPath,spawnProcess=spawn){
 const child=spawnProcess(executable,['--config',configPath,'--watch-owner'],{
  cwd:path.dirname(configPath),detached:true,windowsHide:true,stdio:'ignore'
 });
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve)});
 child.unref();
}
module.exports={ensureWatcher};
