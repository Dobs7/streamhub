import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicCatalog} from '../core/public-catalog.mjs';
test('busca pública usa fontes distintas, sem credenciais e sem inventar ofertas',async()=>{
 const urls=[];const c=createPublicCatalog({fetchImpl:async url=>{urls.push(String(url));return {ok:true,json:async()=>String(url).includes('wikipedia')?{pages:[{id:123,title:'Matrix',description:'filme de 1999',excerpt:'Filme de ação'}]}:[{show:{id:123,name:'Matrix TV',premiered:'2000-01-01',rating:{average:8},genres:['Drama']}}]};}});
 const r=await c.catalogPage({query:'Matrix'});assert.equal(r.items.length,2);assert.equal(new Set(r.items.map(x=>x.type+':'+x.id)).size,2);assert.ok(r.items.every(x=>x.id<0&&x.providers.length===0));assert.ok(urls.every(x=>!x.includes('api_key')));
});
test('cache evita repetir consultas e falha de rede não apaga dados salvos',async()=>{
 const disk=new Map();let calls=0,offline=false,clock=0;
 const opts={now:()=>clock,readCache:async k=>disk.get(k),writeCache:async(k,v)=>disk.set(k,v),fetchImpl:async()=>{calls++;if(offline)throw Error('offline');return {ok:true,json:async()=>({pages:[{id:1,title:'Filme',description:'filme de 1999'}]})};}};
 const c=createPublicCatalog(opts);await c.catalogPage({type:'movie',query:'filme'});await c.catalogPage({type:'movie',query:'filme'});assert.equal(calls,1);
 clock=24*3600_000;offline=true;const r=await createPublicCatalog(opts).catalogPage({type:'movie',query:'filme'});assert.equal(r.items[0].title,'Filme');assert.ok(r.notes.join(' ').includes('salvos'));
});
test('cache corrompido não impede início, ano não inventa data e detalhe recupera identidade',async()=>{
 const c=createPublicCatalog({readCache:async()=>{throw Error('JSON corrompido');},fetchImpl:async url=>({ok:true,json:async()=>String(url).includes('pageids')?{query:{pages:{42:{pageid:42,title:'Teste',description:'filme de 2001',extract:'Sinopse',thumbnail:{source:'https://upload.wikimedia.org/a.jpg'}}}}}:{pages:[{id:42,title:'Teste',description:'filme de 2001'},{id:43,title:'Pessoa',description:'ator'}]}})});
 const r=await c.catalogPage({type:'movie',query:'teste'});assert.equal(r.items.length,1);assert.equal(r.items[0].year,'2001');assert.equal(r.items[0].releaseDate,'');assert.equal((await c.detail('movie',-42)).overview,'Sinopse');
});
