// Descoberta somente leitura: SSDP MediaRenderer na rede local. Não controla dispositivos.
import dgram from 'node:dgram';
const socket=dgram.createSocket('udp4');
const found=new Map();
socket.on('error',e=>{console.error(e.message);socket.close();});
socket.on('message',(message,remote)=>{
 const text=message.toString();const location=text.match(/^location:\s*(.+)$/im)?.[1]?.trim();
 if(!location)return;try{const u=new URL(location);if(u.hostname!==remote.address||!['http:','https:'].includes(u.protocol))return;found.set(remote.address,u.href);}catch{}
});
socket.bind(0,()=>{const request='M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n';socket.send(request,1900,'239.255.255.250');});
setTimeout(async()=>{socket.close();const devices=await Promise.all([...found].map(async([address,url])=>{try{const xml=await(await fetch(url,{signal:AbortSignal.timeout(2500)})).text();const field=name=>xml.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`,'i'))?.[1]||'';return {address,name:field('friendlyName'),manufacturer:field('manufacturer'),model:field('modelName'),modelNumber:field('modelNumber')};}catch{return {address,status:'Descrição indisponível'};}}));console.log(JSON.stringify(devices.length?devices:{status:'Nenhum MediaRenderer respondeu à descoberta local.'},null,2));},3500);
