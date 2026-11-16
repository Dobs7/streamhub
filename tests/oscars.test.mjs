import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const archive=JSON.parse(await readFile(new URL('../src/oscars.json',import.meta.url)));
test('Oscar cobre todos os anos de 1990 a 2026, com um vencedor e indicados em cada edição',()=>{assert.equal(Object.keys(archive).length,37);for(let y=1990;y<=2026;y++){const picks=archive[y];assert.ok(picks.length>=5&&picks.length<=10);assert.equal(picks.filter(p=>p.winner).length,1);assert.equal(new Set(picks.map(p=>p.name)).size,picks.length);assert.ok(picks.every(p=>p.name&&p.year===y-1&&(!p.catalogId||Number.isSafeInteger(p.catalogId)&&p.catalogId>10000000000)));}assert.equal(archive[1990].find(p=>p.winner).name,'Driving Miss Daisy');assert.equal(archive[2026].find(p=>p.winner).name,'One Battle after Another');assert.equal(Object.values(archive).flat().length,256);});
