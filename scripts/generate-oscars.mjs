import fs from 'node:fs/promises';
const root=new URL('../output/oscar-source/',import.meta.url);await fs.mkdir(root,{recursive:true});
const decode=s=>s.replace(/<[^>]*>/g,'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#039;/g,"'").replace(/&nbsp;/g,' ').trim();
const years=Array.from({length:37},(_,i)=>1990+i),data={};let cursor=0;
await Promise.all(Array.from({length:3},async()=>{while(cursor<years.length){const year=years[cursor++],file=new URL(`${year}.html`,root);let html;try{html=await fs.readFile(file,'utf8');}catch{const r=await fetch(`https://www.oscars.org/oscars/ceremonies/${year}`,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`${year}: HTTP${r.status}`);html=await r.text();await fs.writeFile(file,html);}
 const block=html.split(/<div data-term-id=/).find(b=>/field--name-field-award-category-oscars[^>]*>Best Picture<\/div>/.test(b));if(!block)throw Error(`Categoria ausente ${year}`);
 const picks=block.split('paragraph--type--award-honoree ').slice(1).map(b=>{const name=decode(b.match(/field--name-field-award-film[^>]*>([\s\S]*?)<\/div>/)?.[1]||'');if(!name)throw Error(`Título ausente ${year}`);return {name,year:year-1,winner:/field--name-field-honoree-type winner/.test(b)};});
 if(picks.length<5||picks.length>10||picks.filter(p=>p.winner).length!==1)throw Error(`Dados inconsistentes ${year}`);data[year]=picks;console.log(year,picks.length,picks.find(p=>p.winner).name);
}}));
await fs.writeFile(new URL('../src/oscars.json',import.meta.url),JSON.stringify(Object.fromEntries(years.map(y=>[y,data[y]])),null,2)+'\n');
