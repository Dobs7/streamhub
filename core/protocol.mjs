import {randomInt,randomBytes} from 'node:crypto';
export function createPairing(now=Date.now){
  let entry=null;
  return {
    issue(){const code=String(randomInt(100000,1000000)); entry={code,expires:now()+120000,attempts:0};return code;},
    consume(code){if(!entry)throw Error('Código inválido.');if(now()>entry.expires){entry=null;throw Error('Código expirado.');}if(entry.attempts>=5)throw Error('Limite de tentativas. Gere outro código.');entry.attempts++;if(code!==entry.code)throw Error('Código inválido.');entry=null;return randomBytes(32).toString('hex');}
  };
}
export function advanceDelivery(current,next){
  if(next==='playing')throw Error('Não é possível confirmar reprodução de um aplicativo externo.');
  const allowed={sent:['received','failed'],received:['opened','unsupported','failed'],opened:[],unsupported:[],failed:[]};
  if(!allowed[current]?.includes(next))throw Error('transição inválida'); return next;
}
const hosts=['themoviedb.org','justwatch.com','netflix.com','primevideo.com','disneyplus.com','max.com','hbomax.com','tv.apple.com','itunes.apple.com','tvmaze.com','youtube.com','imdb.com','amazon.com.br','globoplay.globo.com','paramountplus.com','mubi.com','play.google.com','looke.com.br','netmovies.com.br','pluto.tv','plex.tv','rakuten.tv','crunchyroll.com','filmelier.com','vix.com','clarotvmais.com.br','discoveryplus.com','redecanais.by','gofilmes.click','oscars.org','omelete.com.br','telecine.globo.com','universalplus.com.br','sonyone.com.br'];
export function safeExternalUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('Destino externo não permitido.');return u.href;}
