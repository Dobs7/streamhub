import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, CACHE_TTL_MS, CACHE_MAX_ENTRIES } from '../core/catalog.mjs';

const TOKEN = 'fixture-token-nao-real';

test('ofertas gratuitas e com anúncios permanecem distintas', async () => {
  const c = createCatalog({getToken:()=>TOKEN,fetchImpl:async()=>jsonResponse({id:603,title:'Matrix','watch/providers':{results:{BR:{free:[{provider_id:1,provider_name:'Grátis'}],ads:[{provider_id:2,provider_name:'Com anúncios'}]}}}})});
  const t=await c.detail('movie',603);
  assert.deepEqual(t.providers.map(p=>p.access),['free','ads']);
  assert.equal(t.providers[0].price,undefined);
});

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function fixtureFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const u = new URL(url);
    calls.push({ url: u, init });
    const path = u.pathname.replace(/^\/3\//, '');
    const handler = routes[path];
    if (!handler) return jsonResponse({ status_message: 'not found' }, 404);
    const out = typeof handler === 'function' ? handler(u) : handler;
    return out && typeof out.json === 'function' ? out : jsonResponse(out);
  };
  return { fetchImpl, calls };
}

const trending = {
  results: [
    { id: 10, media_type: 'movie', title: 'Filme A', original_title: 'Movie A', release_date: '2024-05-01', overview: 'Sinopse', poster_path: '/a.jpg', backdrop_path: '/a-bg.jpg', vote_average: 7.86, vote_count: 1200, genre_ids: [28, 99999] },
    { id: 20, media_type: 'tv', name: 'Série B', first_air_date: '2019-01-01', poster_path: null, vote_average: 'x', genre_ids: [18] },
    { id: 30, media_type: 'person', name: 'Pessoa' },
    { id: 10, media_type: 'movie', title: 'Filme A duplicado' },
    { id: -1, media_type: 'movie', title: 'Inválido' },
    { id: 40, media_type: 'movie' },
  ],
};

test('sem token lança erro claro em pt-BR e não chama a API', async () => {
  const { fetchImpl, calls } = fixtureFetch({});
  const c = createCatalog({ getToken: async () => '', fetchImpl });
  await assert.rejects(c.catalog(), { message: 'Configure o acesso ao catálogo nas configurações.' });
  assert.equal(calls.length, 0);
});

test('catalog normaliza Para Você sem inventar dados', async () => {
  const { fetchImpl, calls } = fixtureFetch({ 'trending/all/week': trending });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const items = await c.catalog();
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    id: 10, type: 'movie', title: 'Filme A', originalTitle: 'Movie A', year: '2024', overview: 'Sinopse',
    poster: 'https://image.tmdb.org/t/p/w500/a.jpg', backdrop: 'https://image.tmdb.org/t/p/original/a-bg.jpg',
    rating: 7.9, votes: 1200, genres: ['Ação'],
  });
  assert.deepEqual(items[1], {
    id: 20, type: 'tv', title: 'Série B', year: '2019', overview: '', poster: null, backdrop: null,
    rating: 0, genres: ['Drama'],
  });
  const { url, init } = calls[0];
  assert.equal(url.origin, 'https://api.themoviedb.org');
  assert.equal(url.searchParams.get('language'), 'pt-BR');
  assert.equal(url.searchParams.get('region'), 'BR');
  assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.ok(init.signal instanceof AbortSignal);
  assert.ok(!url.toString().includes(TOKEN));
});

test('catalog com busca usa search/multi e filtra pessoas', async () => {
  const { fetchImpl, calls } = fixtureFetch({ 'search/multi': trending });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const items = await c.catalog('  matrix  ');
  assert.equal(calls[0].url.searchParams.get('query'), 'matrix');
  assert.deepEqual(items.map((t) => `${t.type}:${t.id}`), ['movie:10', 'tv:20']);
});

test('seções mapeiam endpoints e inferem tipo', async () => {
  const { fetchImpl, calls } = fixtureFetch({
    'movie/top_rated': { results: [{ id: 1, title: 'Top' }] },
    'movie/upcoming': { results: [{ id: 2, title: 'Breve' }] },
    'discover/tv': { results: [{ id: 3, name: 'Série' }] },
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  assert.equal((await c.catalog('', 'Mais Bem Avaliados'))[0].type, 'movie');
  assert.equal((await c.catalog('', 'Em Breve'))[0].title, 'Breve');
  assert.equal((await c.catalog('', 'Séries'))[0].type, 'tv');
  assert.equal(calls[2].url.searchParams.get('watch_region'), 'BR');
});

test('erros de API, resposta inválida e timeout são tratados', async () => {
  const c401 = createCatalog({ getToken: () => TOKEN, fetchImpl: async () => jsonResponse({}, 401) });
  await assert.rejects(c401.catalog(), /Acesso ao catálogo recusado/);
  const c500 = createCatalog({ getToken: () => TOKEN, fetchImpl: async () => jsonResponse({}, 500) });
  await assert.rejects(c500.catalog(), /HTTP 500/);
  const bad = createCatalog({ getToken: () => TOKEN, fetchImpl: async () => jsonResponse({ results: 'x' }) });
  await assert.rejects(bad.catalog(), /Resposta inválida/);
  const timeout = createCatalog({
    getToken: () => TOKEN,
    fetchImpl: async () => { throw new DOMException('t', 'TimeoutError'); },
  });
  await assert.rejects(timeout.catalog(), /demorou demais/);
  const net = createCatalog({ getToken: () => TOKEN, fetchImpl: async () => { throw new TypeError('fail'); } });
  await assert.rejects(net.catalog(), /Não foi possível conectar/);
});

test('cache respeita TTL de 5 minutos e limite de entradas', async () => {
  assert.equal(CACHE_TTL_MS, 5 * 60 * 1000);
  assert.equal(CACHE_MAX_ENTRIES, 100);
  let now = 1_000;
  const { fetchImpl, calls } = fixtureFetch({ 'search/multi': { results: [] }, 'trending/all/week': trending });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl, now: () => now });
  await c.catalog();
  await c.catalog();
  assert.equal(calls.length, 1);
  now += CACHE_TTL_MS + 1;
  await c.catalog();
  assert.equal(calls.length, 2);
  for (let i = 0; i < CACHE_MAX_ENTRIES; i++) await c.catalog(`q${i}`);
  assert.equal(c.cacheSize(), CACHE_MAX_ENTRIES);
  const before = calls.length;
  await c.catalog(); // a entrada mais antiga foi descartada
  assert.equal(calls.length, before + 1);
});

test('detail valida tipo e id', async () => {
  const { fetchImpl, calls } = fixtureFetch({});
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  await assert.rejects(c.detail('person', 1), /Tipo inválido/);
  await assert.rejects(c.detail('movie', 0), /Identificador inválido/);
  await assert.rejects(c.detail('movie', 1.5), /Identificador inválido/);
  await assert.rejects(c.detail('movie', '12'), /Identificador inválido/);
  assert.equal(calls.length, 0);
});

const movieDetail = {
  id: 10, title: 'Filme A', original_title: 'Filme A', release_date: '2024-05-01', overview: 'Sinopse', tagline: '  ',
  poster_path: '/a.jpg', backdrop_path: null, vote_average: 8, vote_count: 10, runtime: 0,
  genres: [{ id: 28, name: 'Ação' }, { name: '' }],
  credits: {
    cast: [{ id: 5, name: 'Atriz', character: 'Heroína', profile_path: '/p.jpg' }, { id: 0, name: 'x' }],
    crew: [{ id: 6, name: 'Diretora', job: 'Director' }, { id: 7, name: 'Outro', job: 'Writer' }],
  },
  videos: {
    results: [
      { key: 'enTrailer01', name: 'Trailer', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'en' },
      { key: 'ptTrailer01', name: 'Trailer Dublado', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'pt' },
      { key: 'naoOficial1', name: 'Fan', site: 'YouTube', type: 'Trailer', official: false, iso_639_1: 'pt' },
      { key: 'vimeo123456', name: 'Vimeo', site: 'Vimeo', type: 'Trailer', official: true, iso_639_1: 'pt' },
      { key: 'esTrailer01', name: 'ES', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'es' },
      { key: 'ptFeaturet1', name: 'Bastidores', site: 'YouTube', type: 'Featurette', official: true, iso_639_1: 'pt' },
    ],
  },
  recommendations: { results: [{ id: 11, media_type: 'movie', title: 'Rec', genre_ids: [35] }, { id: 11, media_type: 'movie', title: 'Rec' }] },
  'watch/providers': {
    results: {
      US: { flatrate: [{ provider_id: 99, provider_name: 'US Only' }] },
      BR: {
        link: 'https://www.themoviedb.org/movie/10-filme-a/watch?locale=BR',
        flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png', price: '9.99' }],
        rent: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: null }],
        buy: [{ provider_id: 2, provider_name: 'Apple TV' }, { provider_id: 'x', provider_name: 'Bad' }],
      },
    },
  },
};

test('detail normaliza créditos, trailers, recomendações e ofertas BR', async () => {
  const { fetchImpl, calls } = fixtureFetch({ 'movie/10': movieDetail });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const t = await c.detail('movie', 10);
  const append = calls[0].url.searchParams.get('append_to_response');
  assert.deepEqual(append.split(','), ['credits', 'videos', 'recommendations', 'watch/providers']);
  assert.equal(t.title, 'Filme A');
  assert.equal(t.originalTitle, undefined);
  assert.equal(t.runtime, undefined);
  assert.equal(t.tagline, undefined);
  assert.deepEqual(t.genres, ['Ação']);
  assert.deepEqual(t.cast, [{ id: 5, name: 'Atriz', character: 'Heroína', photo: 'https://image.tmdb.org/t/p/w500/p.jpg' }]);
  assert.equal(t.director, 'Diretora');
  assert.deepEqual(t.videos, [
    { key: 'ptTrailer01', name: 'Trailer Dublado', language: 'pt' },
    { key: 'enTrailer01', name: 'Trailer', language: 'en' },
  ]);
  assert.deepEqual(t.recommendations.map((r) => r.id), [11]);
  assert.deepEqual(t.recommendations[0].genres, ['Comédia']);
  assert.deepEqual(t.providers, [
    { id: 8, name: 'Netflix', logo: 'https://image.tmdb.org/t/p/w500/n.png', access: 'subscription' },
    { id: 2, name: 'Apple TV', logo: null, access: 'rent' },
    { id: 2, name: 'Apple TV', logo: null, access: 'buy' },
  ]);
  assert.equal(t.providerUrl, 'https://www.themoviedb.org/movie/10-filme-a/watch?locale=BR');
});

test('detail de série usa criadores, duração de episódio e sem ofertas BR', async () => {
  const { fetchImpl } = fixtureFetch({
    'tv/20': {
      id: 20, name: 'Série B', episode_run_time: [45], created_by: [{ name: 'Criador 1' }, { name: 'Criador 2' }],
      'watch/providers': { results: { BR: { link: 'javascript:alert(1)' } } },
    },
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const t = await c.detail('tv', 20);
  assert.equal(t.type, 'tv');
  assert.equal(t.runtime, 45);
  assert.equal(t.director, 'Criador 1, Criador 2');
  assert.deepEqual(t.providers, []);
  assert.equal(t.providerUrl, null);
  assert.deepEqual(t.videos, []);
});

test('detail rejeita resposta sem campos mínimos', async () => {
  const { fetchImpl } = fixtureFetch({ 'movie/10': { id: 999, title: 'Outro' } });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  await assert.rejects(c.detail('movie', 10), /Resposta inválida/);
});

test('person normaliza combined_credits sem duplicatas', async () => {
  const { fetchImpl, calls } = fixtureFetch({
    'person/5': {
      id: 5, name: 'Atriz', biography: 'Bio', profile_path: '/p.jpg',
      combined_credits: {
        cast: [
          { id: 10, media_type: 'movie', title: 'Filme A', popularity: 5 },
          { id: 20, media_type: 'tv', name: 'Série B', popularity: 9 },
          { id: 10, media_type: 'movie', title: 'Filme A', popularity: 5 },
        ],
        crew: [{ id: 10, media_type: 'tv', name: 'Mesmo id outro tipo', popularity: 1 }, { id: 10, media_type: 'movie', title: 'Filme A' }],
      },
    },
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const p = await c.person(5);
  assert.equal(calls[0].url.searchParams.get('append_to_response'), 'combined_credits');
  assert.equal(p.name, 'Atriz');
  assert.equal(p.biography, 'Bio');
  assert.equal(p.photo, 'https://image.tmdb.org/t/p/w500/p.jpg');
  assert.deepEqual(p.credits.map((t) => `${t.type}:${t.id}`), ['tv:20', 'movie:10', 'tv:10']);
  await assert.rejects(c.person(-3), /Identificador inválido/);
});

test('person expõe função por crédito e departamento', async () => {
  const { fetchImpl } = fixtureFetch({
    'person/7': {
      id: 7, name: 'Diretora', known_for_department: 'Directing',
      combined_credits: {
        cast: [{ id: 1, media_type: 'movie', title: 'Cameo', character: 'Ela mesma', popularity: 1 }],
        crew: [
          { id: 1, media_type: 'movie', title: 'Cameo', job: 'Director', popularity: 1 },
          { id: 2, media_type: 'movie', title: 'Outro', job: 'Writer', popularity: 2 },
          { id: 3, media_type: 'person', name: 'Ignorado', job: 'Director' },
        ],
      },
    },
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const p = await c.person(7);
  assert.equal(p.department, 'Directing');
  assert.deepEqual(p.credits.map((t) => [t.id, t.role]), [[2, 'Writer'], [1, 'Ela mesma, Director']]);
});

// --- API key v3 ---

test('API key de 32 hex vai em api_key, sem Authorization e fora da chave de cache', async () => {
  const KEY = '0123456789abcdef0123456789ABCDEF';
  const { fetchImpl, calls } = fixtureFetch({ 'trending/all/week': trending });
  const c = createCatalog({ getToken: () => KEY, fetchImpl });
  await c.catalog();
  await c.catalog();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get('api_key'), KEY);
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.equal(c.cacheSize(), 1);
  const bearer = fixtureFetch({ 'trending/all/week': trending });
  const b = createCatalog({ getToken: () => `${KEY}x`, fetchImpl: bearer.fetchImpl });
  await b.catalog();
  assert.equal(bearer.calls[0].url.searchParams.get('api_key'), null);
  assert.equal(bearer.calls[0].init.headers.Authorization, `Bearer ${KEY}x`);
});

test('erros não expõem a API key', async () => {
  const KEY = 'ffffffffffffffffffffffffffffffff';
  const c = createCatalog({ getToken: () => KEY, fetchImpl: async () => jsonResponse({}, 500) });
  await assert.rejects(c.catalog(), (err) => !err.message.includes(KEY));
});

// --- catalogPage ---

const NOW = Date.UTC(2026, 10, 2, 15, 0); // 2026-11-02 12:00 em Brasília
const pageBody = (results, extra = {}) => ({ page: 1, total_pages: 3, total_results: 55, results, ...extra });

test('catalogPage valida opções sem chamar a API', async () => {
  const { fetchImpl, calls } = fixtureFetch({});
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const bad = [
    [[], /Opções de catálogo inválidas/],
    [{ foo: 1 }, /Opção de catálogo desconhecida: foo/],
    [{ page: 0 }, /Página inválida/],
    [{ page: 501 }, /Página inválida/],
    [{ page: 1.5 }, /Página inválida/],
    [{ page: '2' }, /Página inválida/],
    [{ query: 5 }, /Busca inválida/],
    [{ section: 1 }, /Seção inválida/],
    [{ type: 'person' }, /Tipo inválido/],
    [{ sort: 'votes' }, /Ordenação inválida/],
    [{ genre: 0 }, /Gênero inválido/],
    [{ genre: '28' }, /Gênero inválido/],
    [{ providerIds: 8 }, /Provedores inválidos/],
    [{ providerIds: [8, 'x'] }, /Provedores inválidos/],
    [{ providerIds: [8, -1] }, /Provedores inválidos/],
    [{ year: 1899 }, /Ano inválido/],
    [{ year: 2101 }, /Ano inválido/],
    [{ year: 2026, month: 0 }, /Mês inválido/],
    [{ year: 2026, month: 13 }, /Mês inválido/],
    [{ month: 5 }, /Informe o ano junto com o mês/],
  ];
  for (const [opts, re] of bad) await assert.rejects(c.catalogPage(opts), re, JSON.stringify(opts));
  assert.equal(calls.length, 0);
});

test('catalogPage padrão usa discover/movie popular e retorna contrato paginado', async () => {
  const { fetchImpl, calls } = fixtureFetch({
    'discover/movie': pageBody([{ id: 1, title: 'Um', release_date: '2024-05-17' }, { id: 2, title: 'Dois', release_date: '' }], { total_pages: 900, total_results: 18000 }),
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl, now: () => NOW });
  const r = await c.catalogPage();
  assert.deepEqual(Object.keys(r).sort(), ['items', 'notes', 'page', 'totalPages', 'totalResults']);
  assert.equal(r.page, 1);
  assert.equal(r.totalPages, 500);
  assert.equal(r.totalResults, 18000);
  assert.equal(r.items[0].releaseDate, '2024-05-17');
  assert.equal(r.items[0].year, '2024');
  assert.equal('releaseDate' in r.items[1], false);
  const q = calls[0].url.searchParams;
  assert.equal(q.get('sort_by'), 'popularity.desc');
  assert.equal(q.get('page'), '1');
  assert.equal(q.get('include_adult'), 'false');
  assert.equal(q.get('with_genres'), null);
});

test('catalogPage aplica gênero, provedores, ano/mês e ordenação no discover', async () => {
  const { fetchImpl, calls } = fixtureFetch({
    'discover/movie': pageBody([{ id: 1, title: 'Um' }], { page: 2 }),
    'discover/tv': pageBody([{ id: 3, name: 'Três', first_air_date: '2024-02-10' }]),
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl, now: () => NOW });
  const r = await c.catalogPage({ page: 2, genre: 28, providerIds: [8, 119, 8], year: 2024, month: 2, sort: 'rating' });
  assert.equal(r.page, 2);
  let q = calls[0].url.searchParams;
  assert.equal(calls[0].url.pathname, '/3/discover/movie');
  assert.equal(q.get('page'), '2');
  assert.equal(q.get('with_genres'), '28');
  assert.equal(q.get('with_watch_providers'), '8|119');
  assert.equal(q.get('watch_region'), 'BR');
  assert.equal(q.get('primary_release_date.gte'), '2024-02-01');
  assert.equal(q.get('primary_release_date.lte'), '2024-02-29');
  assert.equal(q.get('sort_by'), 'vote_average.desc');
  assert.equal(q.get('vote_count.gte'), '100');

  const tv = await c.catalogPage({ type: 'tv', year: 2024, sort: 'title' });
  q = calls[1].url.searchParams;
  assert.equal(calls[1].url.pathname, '/3/discover/tv');
  assert.equal(q.get('first_air_date.gte'), '2024-01-01');
  assert.equal(q.get('first_air_date.lte'), '2024-12-31');
  assert.equal(q.get('primary_release_date.gte'), null);
  assert.equal(q.get('sort_by'), 'original_name.asc');
  assert.equal(tv.items[0].releaseDate, '2024-02-10');
  assert.equal(tv.notes.length, 1);

  await c.catalogPage({ sort: 'title' });
  assert.equal(calls[2].url.searchParams.get('sort_by'), 'original_title.asc');
  await c.catalogPage({ sort: 'recent' });
  q = calls[3].url.searchParams;
  assert.equal(q.get('sort_by'), 'primary_release_date.desc');
  assert.equal(q.get('primary_release_date.lte'), '2026-11-02');
});

test('catalogPage de seção sem filtros usa o endpoint da seção com página', async () => {
  const { fetchImpl, calls } = fixtureFetch({
    'movie/upcoming': pageBody([{ id: 2, title: 'Breve', release_date: '2026-12-25' }], { page: 3 }),
    'tv/top_rated': pageBody([{ id: 4, name: 'Top' }]),
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl, now: () => NOW });
  const r = await c.catalogPage({ section: 'Em Breve', page: 3 });
  assert.equal(calls[0].url.pathname, '/3/movie/upcoming');
  assert.equal(calls[0].url.searchParams.get('page'), '3');
  assert.equal(r.page, 3);
  assert.equal(r.items[0].releaseDate, '2026-12-25');
  const tv = await c.catalogPage({ section: 'Séries bem avaliadas' });
  assert.equal(tv.items[0].type, 'tv');
});

test('Em Breve com mês usa discover com intervalo a partir de hoje (BR)', async () => {
  const { fetchImpl, calls } = fixtureFetch({ 'discover/movie': pageBody([]) });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl, now: () => NOW });
  await c.catalogPage({ section: 'Em Breve', year: 2026, month: 12 });
  let q = calls[0].url.searchParams;
  assert.equal(q.get('primary_release_date.gte'), '2026-12-01');
  assert.equal(q.get('primary_release_date.lte'), '2026-12-31');
  await c.catalogPage({ section: 'em breve', year: 2026, month: 11, sort: 'recent' });
  q = calls[1].url.searchParams;
  assert.equal(q.get('primary_release_date.gte'), '2026-11-02');
  assert.equal(q.get('primary_release_date.lte'), '2026-11-30');
  assert.equal(q.get('sort_by'), 'primary_release_date.asc');
  await c.catalogPage({ section: 'Em Breve', genre: 27 });
  q = calls[2].url.searchParams;
  assert.equal(q.get('primary_release_date.gte'), '2026-11-02');
  assert.equal(q.get('primary_release_date.lte'), null);
});

test('catalogPage com busca: multi sem tipo, search/movie|tv com tipo e filtros locais', async () => {
  const results = [
    { id: 10, media_type: 'movie', title: 'B Filme', release_date: '2024-05-01', vote_average: 6, genre_ids: [28] },
    { id: 11, media_type: 'movie', title: 'A Filme', release_date: '2023-01-01', vote_average: 9, genre_ids: [28] },
    { id: 12, media_type: 'tv', name: 'Série', first_air_date: '2024-05-20', genre_ids: [18] },
    { id: 30, media_type: 'person', name: 'Pessoa' },
  ];
  const { fetchImpl, calls } = fixtureFetch({
    'search/multi': pageBody(results),
    'search/movie': pageBody(results.slice(0, 2).map(({ media_type, ...r }) => r)),
    'search/tv': pageBody([{ id: 12, name: 'Série' }]),
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl, now: () => NOW });

  const all = await c.catalogPage({ query: ' matrix ', section: 'Séries', page: 2 });
  assert.equal(calls[0].url.pathname, '/3/search/multi');
  assert.equal(calls[0].url.searchParams.get('query'), 'matrix');
  assert.equal(calls[0].url.searchParams.get('page'), '2');
  assert.deepEqual(all.items.map((t) => t.id), [10, 11, 12]);
  assert.deepEqual(all.notes, []);
  assert.equal(all.totalResults, 55);

  const local = await c.catalogPage({ query: 'x', genre: 28, year: 2024, month: 5, providerIds: [8] });
  assert.deepEqual(local.items.map((t) => t.id), [10]);
  assert.equal(local.notes.length, 2);

  const movies = await c.catalogPage({ query: 'x', type: 'movie', year: 2024, sort: 'title' });
  assert.equal(calls[2].url.pathname, '/3/search/movie');
  assert.equal(calls[2].url.searchParams.get('primary_release_year'), '2024');
  assert.deepEqual(movies.items.map((t) => [t.id, t.type]), [[10, 'movie']]);

  const sorted = await c.catalogPage({ query: 'y', type: 'movie', sort: 'title' });
  assert.deepEqual(sorted.items.map((t) => t.title), ['A Filme', 'B Filme']);
  assert.equal(sorted.notes.length, 1);

  await c.catalogPage({ query: 'x', type: 'tv', year: 2020 });
  assert.equal(calls.at(-1).url.pathname, '/3/search/tv');
  assert.equal(calls.at(-1).url.searchParams.get('first_air_date_year'), '2020');
});

test('catalogPage rejeita resposta sem results', async () => {
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl: async () => jsonResponse({ page: 1 }) });
  await assert.rejects(c.catalogPage(), /Resposta inválida/);
});

// --- pessoas e estúdios ---

test('people busca search/person e normaliza contrato', async () => {
  const { fetchImpl, calls } = fixtureFetch({
    'search/person': pageBody([
      { id: 5, name: 'Atriz', profile_path: '/p.jpg', known_for_department: 'Acting' },
      { id: 5, name: 'Duplicada' },
      { id: 6, name: 'Sem foto' },
      { id: 0, name: 'Inválida' },
    ], { page: 2 }),
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const r = await c.people('  atriz ', 2);
  assert.equal(calls[0].url.searchParams.get('query'), 'atriz');
  assert.equal(calls[0].url.searchParams.get('page'), '2');
  assert.deepEqual(r.items, [
    { id: 5, name: 'Atriz', photo: 'https://image.tmdb.org/t/p/w500/p.jpg', department: 'Acting' },
    { id: 6, name: 'Sem foto', photo: null, department: '' },
  ]);
  assert.equal(r.page, 2);
  assert.equal(r.totalPages, 3);
  await assert.rejects(c.people('   '), /Informe um termo de busca/);
  await assert.rejects(c.people(42), /Informe um termo de busca/);
  await assert.rejects(c.people('x', 0), /Página inválida/);
  assert.equal(calls.length, 1);
});

test('studios busca search/company e normaliza contrato', async () => {
  const { fetchImpl, calls } = fixtureFetch({
    'search/company': pageBody([{ id: 420, name: 'Marvel Studios', logo_path: '/m.png' }, { id: 3, name: 'Pixar', logo_path: null }]),
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const r = await c.studios('marvel');
  assert.equal(calls[0].url.pathname, '/3/search/company');
  assert.equal(calls[0].url.searchParams.get('page'), '1');
  assert.deepEqual(r.items, [
    { id: 420, name: 'Marvel Studios', logo: 'https://image.tmdb.org/t/p/w500/m.png' },
    { id: 3, name: 'Pixar', logo: null },
  ]);
  assert.equal(r.totalPages, 3);
  await assert.rejects(c.studios(''), /Informe um termo de busca/);
  await assert.rejects(c.studios('x', 501), /Página inválida/);
});

test('studio combina company/id e discover/movie with_companies', async () => {
  const { fetchImpl, calls } = fixtureFetch({
    'company/420': { id: 420, name: 'Marvel Studios', logo_path: '/m.png', description: '  Estúdio. ' },
    'discover/movie': pageBody([{ id: 1, title: 'Herói', release_date: '2019-04-24' }], { page: 2 }),
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const s = await c.studio(420, 2);
  const disc = calls.find((x) => x.url.pathname === '/3/discover/movie').url.searchParams;
  assert.equal(disc.get('with_companies'), '420');
  assert.equal(disc.get('page'), '2');
  assert.equal(s.id, 420);
  assert.equal(s.name, 'Marvel Studios');
  assert.equal(s.logo, 'https://image.tmdb.org/t/p/w500/m.png');
  assert.equal(s.description, 'Estúdio.');
  assert.equal(s.coverage, 'movie');
  assert.equal(s.page, 2);
  assert.equal(s.totalPages, 3);
  assert.deepEqual(s.credits.map((t) => [t.id, t.type, t.releaseDate]), [[1, 'movie', '2019-04-24']]);
  await assert.rejects(c.studio(0), /Identificador inválido/);
  await assert.rejects(c.studio(420, 0), /Página inválida/);
});

test('studio rejeita empresa inconsistente', async () => {
  const { fetchImpl } = fixtureFetch({ 'company/1': { id: 2, name: 'Outra' }, 'discover/movie': pageBody([]) });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  await assert.rejects(c.studio(1), /Resposta inválida/);
});

test('detail expõe diretores e estúdios clicáveis', async () => {
  const { fetchImpl } = fixtureFetch({
    'movie/10': {
      ...movieDetail,
      production_companies: [{ id: 420, name: 'Marvel Studios', logo_path: '/m.png' }, { id: 420, name: 'Dup' }, { id: 0, name: 'x' }],
    },
    'tv/20': { id: 20, name: 'Série', created_by: [{ id: 9, name: 'Criadora', profile_path: '/c.jpg' }, { name: 'Sem id' }] },
  });
  const c = createCatalog({ getToken: () => TOKEN, fetchImpl });
  const m = await c.detail('movie', 10);
  assert.deepEqual(m.directors, [{ id: 6, name: 'Diretora', photo: null }]);
  assert.deepEqual(m.studios, [{ id: 420, name: 'Marvel Studios', logo: 'https://image.tmdb.org/t/p/w500/m.png' }]);
  assert.equal(m.director, 'Diretora');
  const tv = await c.detail('tv', 20);
  assert.deepEqual(tv.directors, [{ id: 9, name: 'Criadora', photo: 'https://image.tmdb.org/t/p/w500/c.jpg' }]);
  assert.equal(tv.director, 'Criadora, Sem id');
  assert.deepEqual(tv.studios, []);
});
