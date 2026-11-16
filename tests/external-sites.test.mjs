import test from 'node:test';
import assert from 'node:assert/strict';
import {externalSites,externalSiteUrl} from '../src/externalSites.ts';
import {safeExternalUrl} from '../core/protocol.mjs';
test('sites cadastrados abrem busca observada, com título codificado e sem alegar oferta',()=>{
 const title='Ação & aventura? #1';for(const site of externalSites){const url=new URL(externalSiteUrl(site.id,title));assert.equal(url.searchParams.get(site.parameter),title);assert.equal(safeExternalUrl(url.href),url.href);assert.equal(externalSiteUrl(site.id,''),site.home);}
 assert.equal(new URL(externalSiteUrl('redecanais','Matrix')).pathname,'/search.php');assert.equal(new URL(externalSiteUrl('gofilmes','Matrix')).searchParams.get('s'),'Matrix');assert.throws(()=>externalSiteUrl('evil'),/não cadastrado/);
});
test('destinos externos adicionais rejeitam protocolos, credenciais e domínios parecidos',()=>{
 for(const url of ['http://redecanais.by/','https://redecanais.by.evil.test/','https://user:pass@www.gofilmes.click/','https://www.gofilmes.click:8443/'])assert.throws(()=>safeExternalUrl(url));
});
