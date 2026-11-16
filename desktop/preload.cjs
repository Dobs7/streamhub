const {contextBridge,ipcRenderer}=require('electron');
const api={};
for(const method of ['trailers','providers','catalog','catalogPage','people','studios','studio','detail','person','configure','status','openExternal','tvStart','tvStatus','tvPair','tvSend','tvStop'])api[method]=async(...args)=>{try{return await ipcRenderer.invoke('hub:'+method,...args);}catch(error){throw new Error(error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}};
contextBridge.exposeInMainWorld('streamhub',api);
