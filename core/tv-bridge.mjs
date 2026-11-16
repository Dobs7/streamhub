import http from 'node:http';
import {networkInterfaces} from 'node:os';
import {randomBytes,randomInt} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const services=new Set(['Netflix','Prime Video','Disney+','Max','Apple TV','Crunchyroll']);
const privateIp=ip=>/^\d+\.\d+\.\d+\.\d+$/.test(ip)&&ip.split('.').every(x=>Number(x)<=255)&&(ip==='127.0.0.1'||ip.startsWith('10.')||ip.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(ip));
export function createTvBridge({host='0.0.0.0',port=43821,now=Date.now}={}){
 let server=null,starting=null,clients=new Map(),paired=null,delivery=null,failures=0,blockedUntil=0;
 function status(){expire();const bound=server?.address();const p=bound&&typeof bound==='object'?bound.port:port;const ips=host==='127.0.0.1'?['127.0.0.1']:Object.values(networkInterfaces()).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal&&privateIp(x.address)).map(x=>x.address);return {running:!!bound,urls:[...new Set(ips)].map(ip=>`http://${ip}:${p}/tv`),paired:!!paired,receiver:paired?'TV conectada':null,delivery:delivery?{...delivery}:null};}
 function expire(){for(const [key,c] of clients)if(now()-c.lastSeen>120_000){clients.delete(key);if(paired===key)paired=null;}}
 function pair(code){expire();if(now()<blockedUntil)throw Error('Muitas tentativas. Aguarde um minuto.');const found=[...clients].find(([,c])=>!c.paired&&c.code===code&&c.expires>now());if(!found){if(++failures>=5){blockedUntil=now()+60_000;failures=0;}throw Error('Código inválido ou expirado. Atualize a página da TV.');}failures=0;clients=new Map([found]);paired=found[0];found[1].paired=true;found[1].code=null;delivery=null;return status();}
 function send(value){expire();if(!paired)throw Error('Nenhuma TV pareada.');if(!value||Object.keys(value).some(k=>!['title','year','service'].includes(k))||typeof value.title!=='string'||!value.title.trim()||value.title.length>200||!services.has(value.service)||String(value.year||'').length>4)throw Error('Comando inválido.');const c=clients.get(paired);c.command={id:randomBytes(12).toString('hex'),title:value.title.trim(),year:String(value.year||''),service:value.service};delivery={id:c.command.id,state:'sent',title:c.command.title,service:c.command.service};return status();}
 function disconnect(){clients.clear();paired=null;delivery=null;return status();}
 async function handler(req,res){
  const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   const ip=(req.socket.remoteAddress||'').replace(/^::ffff:/,'');if(!privateIp(ip))return json(403,{error:'Somente rede local.'});
   const hostname=String(req.headers.host||'').split(':')[0];if(!privateIp(hostname))return json(403,{error:'Host não autorizado.'});
   const origin=req.headers.origin;if(origin&&origin!=='null'&&origin!==`http://${req.headers.host}`)return json(403,{error:'Origem não autorizada.'});
   // Installed Tizen widgets have a null origin. Pairing still requires explicit approval in the PC app.
   if(origin==='null'){res.setHeader('Access-Control-Allow-Origin','null');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
   if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
   const route=new URL(req.url,'http://localhost').pathname;
   if(req.method==='GET'&&['/','/tv','/receiver.js','/receiver.css'].includes(route)){
    const name=route==='/receiver.js'?'receiver.js':route==='/receiver.css'?'receiver.css':'receiver.html';const body=await readFile(new URL('../tv/'+name,import.meta.url));res.writeHead(200,{'Content-Type':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; frame-ancestors 'none'"});return res.end(body);
   }
   let body={};if(req.method==='POST'){if(!String(req.headers['content-type']).startsWith('application/json'))return json(415,{error:'Use JSON.'});let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048){return json(413,{error:'Comando muito grande.'});}}try{body=JSON.parse(raw);}catch{return json(400,{error:'JSON inválido.'});}}
   expire();
   if(route==='/receiver'&&req.method==='POST'){if(clients.size>=6)return json(429,{error:'Limite de receptores. Aguarde dois minutos.'});const token=randomBytes(32).toString('hex'),code=String(randomInt(100000,1000000));clients.set(token,{code,expires:now()+120000,lastSeen:now(),paired:false,command:null});return json(200,{token,code,expiresIn:120});}
   const token=String(req.headers.authorization||'').replace(/^Bearer /,'');const c=clients.get(token);if(!c)return json(401,{error:'Conexão expirada. Reconecte a TV.'});c.lastSeen=now();
   if(route==='/poll'&&req.method==='GET')return json(200,{paired:c.paired,expired:!c.paired&&c.expires<now(),command:c.paired?c.command:null});
   if(route==='/ack'&&req.method==='POST'){if(!c.paired||!delivery||body.id!==delivery.id)return json(409,{error:'Envio não encontrado.'});const allowed={sent:['received','failed'],received:['opened','unsupported','failed'],opened:[],unsupported:[],failed:[]};if(!allowed[delivery.state]?.includes(body.state))return json(400,{error:'Estado inválido.'});delivery.state=body.state;return json(200,{ok:true});}
   return json(404,{error:'Rota não encontrada.'});
  }catch{return json(400,{error:'Não foi possível processar a solicitação.'});}
 }
 async function start(){if(server?.listening)return status();if(starting)return starting;starting=(async()=>{server=http.createServer(handler);server.requestTimeout=10_000;server.headersTimeout=10_000;try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});return status();}catch{server=null;throw Error('Não foi possível abrir a conexão local. A porta pode estar em uso.');}finally{starting=null;}})();return starting;}
 async function stop(){disconnect();const s=server;server=null;if(s){s.closeAllConnections();await new Promise(resolve=>s.close(resolve));}}
 return {start,stop,status,pair,send,disconnect};
}
