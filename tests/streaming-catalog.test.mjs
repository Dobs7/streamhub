import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createStreamingCatalog,normalizeStreamingTitle,JW_ID_BASE} from '../core/streaming-catalog.mjs';
const fixture=JSON.parse(await readFile(new URL('./justwatch-fixture.json',import.meta.url)));
test('Rotten Tomatoes mantém escala percentual e não inventa nota ausente',()=>{const n=structuredClone(fixture.data.popularTitles.edges[0].node);n.content.scoring.tomatoMeter=83;assert.deepEqual(normalizeStreamingTitle(n).ratings.find(r=>r.source==='Rotten Tomatoes'),{source:'Rotten Tomatoes',value:83,scale:100});n.content.scoring.tomatoMeter=null;assert.ok(!normalizeStreamingTitle(n).ratings.some(r=>r.source==='Rotten Tomatoes'));n.content.scoring.tomatoMeter=101;assert.ok(!normalizeStreamingTitle(n).ratings.some(r=>r.source==='Rotten Tomatoes'));});
test('oferta 4K sem link mantém link válido de outra qualidade, independente da ordem',()=>{for(const reverse of [false,true]){const n=structuredClone(fixture.data.popularTitles.edges[0].node),o=n.offers[0];n.offers=[{...o,presentationType:'_4K',standardWebURL:null},{...o,presentationType:'HD',standardWebURL:'https://www.netflix.com/title/60020435'}];if(reverse)n.offers.reverse();const p=normalizeStreamingTitle(n).providers[0];assert.equal(p.url,'https://www.netflix.com/title/60020435');assert.equal(p.quality,'4K');}});
test('provedores incluem canais adicionais para BR e preservam suas chaves reais',async()=>{let document;const c=createStreamingCatalog({fetchImpl:async(_u,o)=>{document=JSON.parse(o.body).query;return{ok:true,json:async()=>({data:{packages:[{clearName:'Telecine Amazon Channel',shortName:'atl',icon:'/icon/318069566/s100/amazontelecine.jpg'}]}})};}});const p=await c.providers();assert.ok(document.includes('includeAddons: true'));assert.equal(p[0].key,'atl');assert.equal(p[0].name,'Telecine Amazon Channel');});
test('notas com fonte, ofertas BR e identidade sem confundir ids de outros catálogos',()=>{
 const t=normalizeStreamingTitle(fixture.data.popularTitles.edges[0].node,{checkedAt:123});
 assert.equal(t.id,JW_ID_BASE+10);assert.equal(t.title,'Matrix');assert.equal(t.year,'1999');assert.equal(t.ratings[0].source,'IMDb');assert.equal(t.ratings[0].value,8.7);assert.equal(t.ageCertification,'12');assert.equal(t.providers.length,6);
 assert.equal(t.providers.filter(p=>p.access==='subscription').length,2);assert.equal(t.providers.find(p=>p.name==='Apple TV Store'&&p.access==='rent').price,'11,90 R$');assert.ok(t.providers.every(p=>p.qualities.includes('4K')));assert.equal(t.checkedAt,123);assert.ok(t.overview.includes('programador'));assert.ok(t.backdrop.startsWith('https://images.justwatch.com/'));assert.ok(t.directors.some(p=>p.name==='Lana Wachowski'));
});
test('campos ausentes, avaliações inválidas e ofertas com destino não confiável não são inventados',()=>{
 const node=structuredClone(fixture.data.popularTitles.edges[0].node);node.content.scoring={imdbScore:0,tmdbScore:NaN};node.offers=[{...node.offers[0],standardWebURL:'https://evil.test/video'}];const t=normalizeStreamingTitle(node);assert.equal(t.ratings.length,0);assert.equal(t.rating,0);assert.equal(t.providers[0].url,null);assert.equal(t.providers[0].price,undefined);
});
test('cache guarda data original, recupera oferta offline com aviso e detalhe usa id exato',async()=>{
 let offline=false,now=0;const disk=new Map(),bodies=[];
 const c=createStreamingCatalog({now:()=>now,readCache:async k=>disk.get(k),writeCache:async(k,v)=>disk.set(k,v),fetchImpl:async(_u,o)=>{if(offline)throw Error('offline');bodies.push(JSON.parse(o.body));return {ok:true,json:async()=>fixture};}});
 const r=await c.catalogPage({query:'Matrix'});assert.equal(r.items[0].ratingSource,'IMDb');assert.equal(bodies[0].variables.filter.searchQuery,'Matrix');
 assert.ok(bodies[0].query.includes('language: "pt-BR"'));
 offline=true;now=25*3600_000;const s=await c.catalogPage({query:'Matrix'});assert.equal(s.items[0].availabilityStale,true);assert.equal(s.items[0].checkedAt,0);assert.ok(s.notes.join(' ').includes('salvos'));
});
test('filtro de streaming, ano e votos é enviado à fonte; entradas inválidas não viram consultas',async()=>{
 const bodies=[];const c=createStreamingCatalog({now:()=>Date.UTC(2026,10,9),fetchImpl:async(_u,o)=>{bodies.push(JSON.parse(o.body));return {ok:true,json:async()=>fixture};}});
 await c.catalogPage({section:'Coleções',serviceKeys:['nfx']});assert.deepEqual(bodies[0].variables.filter.packages,['nfx']);assert.equal(bodies[0].variables.filter.imdbVotes.min,1000);assert.equal(bodies[0].variables.filter.releaseYear.max,2026);
 await assert.rejects(c.catalogPage({serviceKeys:['https://evil.test']}),/Serviço inválido/);assert.equal(bodies.length,1);
});
test('detalhe consulta identificador exato e rejeita resposta de outra obra',async()=>{
 const node=fixture.data.popularTitles.edges[0].node;const requests=[];
 const c=createStreamingCatalog({fetchImpl:async(_u,o)=>{requests.push(JSON.parse(o.body));return {ok:true,json:async()=>({data:{node}})};}});
 assert.equal((await c.detail('movie',JW_ID_BASE+10)).year,'1999');assert.equal(requests[0].variables.id,'tm10');await assert.rejects(c.detail('movie',JW_ID_BASE+11),/não encontrado/);
});
test('erro remoto não se torna catálogo vazio bem sucedido',async()=>{
 const c=createStreamingCatalog({fetchImpl:async()=>({ok:true,json:async()=>({errors:[{message:'schema changed'}]})})});await assert.rejects(c.catalogPage({}),/indisponíveis/);
});
test('filmografia usa ID da pessoa e participação validados na consulta pública',async()=>{const bodies=[];const c=createStreamingCatalog({fetchImpl:async(_u,o)=>{bodies.push(JSON.parse(o.body));return {ok:true,json:async()=>fixture};}});await c.catalogPage({personId:JW_ID_BASE+2266,personRole:'DIRECTOR'});assert.equal(bodies[0].variables.filter.personId,'tp2266');assert.equal(bodies[0].variables.filter.personRole,'DIRECTOR');await assert.rejects(c.catalogPage({personId:2266}),/Pessoa inválida/);});
