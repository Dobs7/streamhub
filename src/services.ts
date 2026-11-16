import snapshot from './services.json';
export interface Service {name:string;key:string;icon:string;externalUrl?:string}
const aliases:Record<string,string>={prv:'Prime Video',dnp:'Disney+',mxx:'Max'};
const extras:Service[]=[{name:'Telecine',key:'official-telecine',icon:'',externalUrl:'https://telecine.globo.com/'},{name:'Universal+',key:'official-universal',icon:'',externalUrl:'https://universalplus.com.br/'},{name:'Sony One',key:'official-sonyone',icon:'',externalUrl:'https://www.sonyone.com.br/'}];
export function makeServices(providers:{name:string;key:string;logo:string|null}[]):Service[]{const seen=new Set<string>();return [...providers.filter(p=>p.name&&/^[a-z0-9]{2,8}$/.test(p.key)).map(p=>({name:aliases[p.key]||p.name,key:p.key,icon:p.logo||''})),...extras].filter(p=>{if(seen.has(p.key))return false;seen.add(p.key);return true;}).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));}
export const initialServices=makeServices(snapshot);
export const normalizeSearch=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
export const serviceFallback='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="20" fill="#292638"/><path d="M22 27h36v28H22zM30 27v28M50 27v28M22 36h8M22 46h8M50 36h8M50 46h8" fill="none" stroke="#cbbde8" stroke-width="3"/></svg>');
