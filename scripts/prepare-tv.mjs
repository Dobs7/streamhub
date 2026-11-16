import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('dist-tv',{recursive:true});
await copyFile('tizen/config.xml','dist-tv/config.xml');
await copyFile('public/icon.png','dist-tv/icon.png');
for(const name of ['receiver.html','receiver.js','receiver.css'])await copyFile('tv/'+name,'dist-tv/'+(name==='receiver.html'?'index.html':name));
console.log('Build Samsung preparado em dist-tv. Assinatura e teste na TV física ainda necessários.');
