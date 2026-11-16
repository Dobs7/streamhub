import test from 'node:test';
import assert from 'node:assert/strict';
import {createTvBridge} from '../core/tv-bridge.mjs';
test('receptor só recebe após aprovação, confirma recebimento e rejeita destinos arbitrários',async t=>{
 const b=createTvBridge({host:'127.0.0.1',port:0});await b.start();t.after(()=>b.stop());const base=b.status().urls[0].replace('/tv','');
 const req=async(route,body,token)=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 const {data:r}=await req('/receiver',{});assert.match(r.code,/^\d{6}$/);assert.equal((await req('/poll',null,r.token)).data.paired,false);
 assert.throws(()=>b.send({title:'Matrix',service:'Netflix'}),/paread/);b.pair(r.code);b.send({title:'Matrix',service:'Netflix'});
 const msg=(await req('/poll',null,r.token)).data;assert.equal(msg.command.title,'Matrix');assert.equal(b.status().delivery.state,'sent');
 await req('/ack',{id:msg.command.id,state:'received'},r.token);assert.equal(b.status().delivery.state,'received');
 assert.equal((await req('/ack',{id:msg.command.id,state:'playing'},r.token)).status,400);
 assert.throws(()=>b.send({title:'Matrix',service:'Netflix',url:'http://evil.test'}),/inválid/);
 assert.equal((await req('/poll',null,'wrong')).status,401);
 b.send({title:'Anime & ação?',year:'2026',service:'Crunchyroll'});assert.equal((await req('/poll',null,r.token)).data.command.service,'Crunchyroll');
 b.disconnect();assert.equal((await req('/poll',null,r.token)).status,401);
});
test('protege código, Host e Origin; código consumido não pode ser reutilizado',async t=>{
 let clock=0;const b=createTvBridge({host:'127.0.0.1',port:0,now:()=>clock});await b.start();t.after(()=>b.stop());const base=b.status().urls[0].replace('/tv','');
 const response=await fetch(base+'/receiver',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const r=await response.json();
 assert.equal((await fetch(base+'/receiver',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.test'},body:'{}'})).status,403);
 b.pair(r.code);assert.throws(()=>b.pair(r.code),/inválido/);clock=121000;assert.equal(b.status().paired,false);assert.throws(()=>b.send({title:'Teste',service:'Netflix'}),/pareada/);
});
