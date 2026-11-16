export const externalSites=[
 {id:'redecanais',name:'RedeCanais',home:'https://redecanais.by/',search:'https://redecanais.by/search.php',parameter:'keywords'},
 {id:'gofilmes',name:'GoFilmes',home:'https://www.gofilmes.click/',search:'https://www.gofilmes.click/',parameter:'s'},
] as const;
export function externalSiteUrl(id:string,title=''){
 const site=externalSites.find(s=>s.id===id);if(!site)throw Error('Site não cadastrado.');
 const query=title.trim().slice(0,200);if(!query)return site.home;
 const url=new URL(site.search);url.searchParams.set(site.parameter,query);return url.href;
}
