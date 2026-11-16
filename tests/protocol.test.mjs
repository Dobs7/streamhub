import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPairing, advanceDelivery, safeExternalUrl} from '../core/protocol.mjs';
test('código expira e não pode ser reutilizado',()=>{let now=0; const p=createPairing(()=>now); const code=p.issue(); now=120001; assert.throws(()=>p.consume(code),/expirado/); const next=p.issue(); assert.equal(p.consume(next).length,64); assert.throws(()=>p.consume(next),/inválido/);});
test('limita tentativas incorretas',()=>{const p=createPairing();p.issue();for(let i=0;i<5;i++)assert.throws(()=>p.consume('000000'),/inválido|tentativas/);assert.throws(()=>p.consume('000000'),/tentativas/);});
test('recebido não significa reproduzindo',()=>{assert.equal(advanceDelivery('sent','received'),'received');assert.throws(()=>advanceDelivery('received','playing'),/confirmar/);assert.throws(()=>advanceDelivery('received','sent'),/transição/);});
test('nega links arbitrários e protocolos perigosos',()=>{assert.equal(safeExternalUrl('https://www.themoviedb.org/movie/603/watch'),'https://www.themoviedb.org/movie/603/watch'); for(const u of ['javascript:alert(1)','https://netflix.com.evil.test/','https://user:pass@www.netflix.com/','http://www.netflix.com/','https://localhost/'])assert.throws(()=>safeExternalUrl(u));});
