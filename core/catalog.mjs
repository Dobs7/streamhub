// Catálogo TMDB server-side. O token bearer (ou API key v3) nunca sai deste módulo
// exceto na requisição ao próprio TMDB, e nunca entra em chaves de cache ou mensagens de erro.
const API = 'https://api.themoviedb.org/3/';
const IMG = 'https://image.tmdb.org/t/p/w500';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';
const TIMEOUT_MS = 12_000;
export const CACHE_TTL_MS = 5 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 100;
export const MAX_PAGE = 500; // limite de paginação imposto pelo TMDB
const MIN_RATING_VOTES = 100; // evita notas 10 com poucos votos na ordenação por avaliação
const API_KEY_RE = /^[0-9a-f]{32}$/i;

const NO_TOKEN = 'Configure o acesso ao catálogo nas configurações.';
const INVALID = 'Resposta inválida do catálogo.';

const GENRES = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime', 99: 'Documentário',
  18: 'Drama', 10751: 'Família', 14: 'Fantasia', 36: 'História', 27: 'Terror', 10402: 'Música',
  9648: 'Mistério', 10749: 'Romance', 878: 'Ficção científica', 10770: 'Cinema TV', 53: 'Thriller',
  10752: 'Guerra', 37: 'Faroeste', 10759: 'Ação e Aventura', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Ficção científica e Fantasia', 10766: 'Novela', 10767: 'Talk',
  10768: 'Guerra e Política',
};

const SECTIONS = {
  'para você': { path: 'trending/all/week' },
  'explorar': { path: 'discover/movie', type: 'movie', params: { sort_by: 'popularity.desc', watch_region: 'BR' } },
  'novidades': { path: 'trending/all/day' },
  'coleções': { path: 'movie/top_rated', type: 'movie', sort: 'rating' },
  'sala de trailers': { path: 'movie/now_playing', type: 'movie' },
  'em alta': { path: 'trending/all/day' },
  filmes: { path: 'discover/movie', type: 'movie', params: { sort_by: 'popularity.desc', watch_region: 'BR' } },
  'séries': { path: 'discover/tv', type: 'tv', params: { sort_by: 'popularity.desc', watch_region: 'BR' } },
  'mais bem avaliados': { path: 'movie/top_rated', type: 'movie', sort: 'rating' },
  'séries bem avaliadas': { path: 'tv/top_rated', type: 'tv', sort: 'rating' },
  'em breve': { path: 'movie/upcoming', type: 'movie', upcoming: true },
  'lançamentos': { path: 'movie/upcoming', type: 'movie', upcoming: true },
};

const ACCESS = [['flatrate', 'subscription'], ['rent', 'rent'], ['buy', 'buy'], ['free', 'free'], ['ads', 'ads']];
const VIDEO_LANGS = ['pt', 'en'];
const PAGE_OPTIONS = new Set(['query', 'section', 'page', 'type', 'sort', 'genre', 'providerIds', 'year', 'month']);
const SORTS = new Set(['popular', 'rating', 'title', 'recent']);
const MAX_PROVIDERS = 50;

const isPosInt = (n) => Number.isInteger(n) && n > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const image = (p, base = IMG) => (typeof p === 'string' && p.startsWith('/') ? base + p : null);
const list = (v) => (Array.isArray(v) ? v : []);
const given = (v) => v !== undefined && v !== null;
const pad = (n) => String(n).padStart(2, '0');

function validType(type) {
  if (type !== 'movie' && type !== 'tv') throw new Error('Tipo inválido: use movie ou tv.');
  return type;
}
function validId(id) {
  if (!isPosInt(id)) throw new Error('Identificador inválido.');
  return id;
}
function validPage(page) {
  if (!given(page)) return 1;
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    throw new Error(`Página inválida: use um inteiro de 1 a ${MAX_PAGE}.`);
  }
  return page;
}
function validQuery(query) {
  const q = typeof query === 'string' ? query.trim().slice(0, 100) : '';
  if (!q) throw new Error('Informe um termo de busca.');
  return q;
}

function validPageOptions(options) {
  const raw = given(options) ? options : {};
  if (!isObj(raw)) throw new Error('Opções de catálogo inválidas.');
  for (const k of Object.keys(raw)) {
    if (!PAGE_OPTIONS.has(k)) throw new Error(`Opção de catálogo desconhecida: ${k}.`);
  }
  const o = { query: '', section: '', page: validPage(raw.page), providerIds: [] };
  if (given(raw.query)) {
    if (typeof raw.query !== 'string') throw new Error('Busca inválida.');
    o.query = raw.query.trim().slice(0, 100);
  }
  if (given(raw.section)) {
    if (typeof raw.section !== 'string') throw new Error('Seção inválida.');
    o.section = raw.section.trim();
  }
  if (given(raw.type)) o.type = validType(raw.type);
  if (given(raw.sort)) {
    if (!SORTS.has(raw.sort)) throw new Error('Ordenação inválida: use popular, rating, title ou recent.');
    o.sort = raw.sort;
  }
  if (given(raw.genre)) {
    if (!isPosInt(raw.genre)) throw new Error('Gênero inválido.');
    o.genre = raw.genre;
  }
  if (given(raw.providerIds)) {
    if (!Array.isArray(raw.providerIds) || raw.providerIds.length > MAX_PROVIDERS || !raw.providerIds.every(isPosInt)) {
      throw new Error('Provedores inválidos: use uma lista de inteiros positivos.');
    }
    o.providerIds = [...new Set(raw.providerIds)];
  }
  if (given(raw.year)) {
    if (!Number.isInteger(raw.year) || raw.year < 1900 || raw.year > 2100) throw new Error('Ano inválido: use 1900 a 2100.');
    o.year = raw.year;
  }
  if (given(raw.month)) {
    if (!Number.isInteger(raw.month) || raw.month < 1 || raw.month > 12) throw new Error('Mês inválido: use 1 a 12.');
    if (!o.year) throw new Error('Informe o ano junto com o mês.');
    o.month = raw.month;
  }
  return o;
}

// Data de hoje no fuso de Brasília, formato YYYY-MM-DD.
function todayBR(ms) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ms));
  } catch {
    return new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);
  }
}

function dateRange(year, month) {
  if (!month) return [`${year}-01-01`, `${year}-12-31`];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(last)}`];
}

function rawDate(raw, fallbackType) {
  const type = raw?.media_type ?? fallbackType;
  return str(type === 'tv' ? raw?.first_air_date : raw?.release_date);
}

function paging(data, requested, count) {
  const page = isPosInt(data.page) ? data.page : requested;
  const totalPages = Number.isInteger(data.total_pages) && data.total_pages >= 0
    ? Math.min(data.total_pages, MAX_PAGE)
    : page;
  const totalResults = Number.isInteger(data.total_results) && data.total_results >= 0 ? data.total_results : count;
  return { page, totalPages, totalResults };
}

function sortLocal(items, sort) {
  if (sort === 'rating') return items.sort((a, b) => b.rating - a.rating);
  if (sort === 'title') return items.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  if (sort === 'recent') return items.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  return items;
}

export function normalizeTitle(raw, fallbackType, { releaseDate = false } = {}) {
  if (!isObj(raw)) return null;
  const type = raw.media_type ?? fallbackType;
  if ((type !== 'movie' && type !== 'tv') || !isPosInt(raw.id)) return null;
  const title = str(type === 'movie' ? raw.title : raw.name) || str(raw.title) || str(raw.name);
  if (!title) return null;
  const date = str(type === 'movie' ? raw.release_date : raw.first_air_date);
  const rating = Number(raw.vote_average);
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((g) => str(g?.name)).filter(Boolean)
    : list(raw.genre_ids).map((id) => GENRES[id]).filter(Boolean);
  const t = {
    id: raw.id,
    type,
    title,
    year: /^\d{4}/.test(date) ? date.slice(0, 4) : '',
    overview: str(raw.overview),
    poster: image(raw.poster_path),
    backdrop: image(raw.backdrop_path, IMG_ORIGINAL),
    rating: Number.isFinite(rating) && typeof raw.vote_average === 'number' ? Math.round(rating * 10) / 10 : 0,
    genres: [...new Set(genres)],
  };
  const original = str(raw.original_title ?? raw.original_name);
  if (original && original !== title) t.originalTitle = original;
  if (Number.isInteger(raw.vote_count) && raw.vote_count >= 0) t.votes = raw.vote_count;
  if (releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(date)) t.releaseDate = date;
  return orderKeys(t);
}

function orderKeys(t) {
  const { id, type, title, originalTitle, ...rest } = t;
  return originalTitle ? { id, type, title, originalTitle, ...rest } : { id, type, title, ...rest };
}

function normalizeList(items, fallbackType, limit = Infinity, opts) {
  const seen = new Set();
  const out = [];
  for (const raw of list(items)) {
    const t = normalizeTitle(raw, fallbackType, opts);
    if (!t) continue;
    const key = `${t.type}:${t.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeVideos(videos) {
  const out = [];
  const seen = new Set();
  for (const lang of VIDEO_LANGS) {
    for (const v of list(videos?.results)) {
      if (!isObj(v) || v.site !== 'YouTube' || v.type !== 'Trailer' || v.official !== true) continue;
      if (v.iso_639_1 !== lang || typeof v.key !== 'string' || !/^[\w-]{6,32}$/.test(v.key)) continue;
      if (seen.has(v.key)) continue;
      seen.add(v.key);
      out.push({ key: v.key, name: str(v.name) || 'Trailer', language: lang });
    }
  }
  return out;
}

function normalizeProviders(wp) {
  const br = wp?.results?.BR;
  if (!isObj(br)) return { providers: [], providerUrl: null };
  const providers = [];
  const seen = new Set();
  for (const [field, access] of ACCESS) {
    for (const p of list(br[field])) {
      if (!isObj(p) || !isPosInt(p.provider_id) || !str(p.provider_name)) continue;
      const key = `${access}:${p.provider_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      providers.push({ id: p.provider_id, name: str(p.provider_name), logo: image(p.logo_path), access });
    }
  }
  const link = str(br.link);
  const providerUrl = /^https:\/\/www\.themoviedb\.org\//.test(link) ? link : null;
  return { providers, providerUrl };
}

function uniqueById(items, map) {
  const seen = new Set();
  const out = [];
  for (const x of list(items)) {
    if (!isObj(x) || !isPosInt(x.id) || !str(x.name) || seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(map(x));
  }
  return out;
}
const toPerson = (p) => ({ id: p.id, name: str(p.name), photo: image(p.profile_path) });
const toStudio = (c) => ({ id: c.id, name: str(c.name), logo: image(c.logo_path) });

export function createCatalog({ getToken, fetchImpl = fetch, now = Date.now } = {}) {
  if (typeof getToken !== 'function') throw new TypeError('getToken é obrigatório.');
  const cache = new Map();
  let cacheToken = null;

  async function request(path, params = {}) {
    const token = str(await getToken());
    if (!token) throw new Error(NO_TOKEN);
    if (token !== cacheToken) {
      cache.clear();
      cacheToken = token;
    }
    const url = new URL(path, API);
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('region', 'BR');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    // A chave de cache nunca contém o segredo; o cache já é limpo quando o segredo muda.
    const key = url.toString();

    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.data;
    cache.delete(key);

    // Bearer (token de leitura v4) é o preferido. API key v3 (32 hex) só é aceita via query api_key,
    // exigência do TMDB; a URL com a chave existe apenas nesta chamada e não é registrada.
    const isApiKey = API_KEY_RE.test(token);
    const target = new URL(key);
    if (isApiKey) target.searchParams.set('api_key', token);
    const headers = isApiKey
      ? { Accept: 'application/json' }
      : { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    let res;
    try {
      res = await fetchImpl(target.toString(), { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new Error('O catálogo demorou demais para responder. Tente novamente.');
      }
      throw new Error('Não foi possível conectar ao catálogo.');
    }
    if (!res || !res.ok) {
      const status = res?.status;
      if (status === 401 || status === 403) throw new Error('Acesso ao catálogo recusado. Verifique as configurações.');
      if (status === 404) throw new Error('Item não encontrado no catálogo.');
      if (status === 429) throw new Error('Muitas consultas ao catálogo. Aguarde um instante.');
      throw new Error(`Falha ao consultar o catálogo (HTTP ${status ?? '?'}).`);
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(INVALID);
    }
    if (!isObj(data)) throw new Error(INVALID);

    cache.set(key, { data, expires: now() + CACHE_TTL_MS });
    while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
    return data;
  }

  async function catalog(query = '', section = 'Para Você') {
    const q = str(query).slice(0, 100);
    let data;
    let type;
    if (q) {
      data = await request('search/multi', { query: q, include_adult: 'false' });
    } else {
      const s = SECTIONS[str(section).toLowerCase()] ?? SECTIONS['para você'];
      type = s.type;
      data = await request(s.path, s.params);
    }
    if (!Array.isArray(data.results)) throw new Error(INVALID);
    return normalizeList(data.results, type);
  }

  function toPage(data, requested, type, notes) {
    if (!Array.isArray(data.results)) throw new Error(INVALID);
    const items = normalizeList(data.results, type, Infinity, { releaseDate: true });
    return { items, ...paging(data, requested, items.length), notes };
  }

  async function searchPage(o) {
    const notes = [];
    const params = { query: o.query, include_adult: 'false', page: o.page };
    let path = 'search/multi';
    if (o.type === 'movie') {
      path = 'search/movie';
      if (o.year) params.primary_release_year = o.year;
    } else if (o.type === 'tv') {
      path = 'search/tv';
      if (o.year) params.first_air_date_year = o.year;
    }
    const data = await request(path, params);
    if (!Array.isArray(data.results)) throw new Error(INVALID);

    if (o.providerIds.length) notes.push('A busca textual do TMDB não filtra por provedor; filtro de provedores ignorado.');
    if (o.genre || o.month || (o.year && !o.type)) {
      notes.push('Filtros de gênero/data aplicados localmente só a esta página; totais refletem a busca sem esses filtros.');
    }
    const [gte, lte] = o.year ? dateRange(o.year, o.month) : [];
    const filtered = data.results.filter((raw) => {
      if (o.genre && !list(raw?.genre_ids).includes(o.genre)) return false;
      if (gte) {
        const d = rawDate(raw, o.type);
        if (!d || d < gte || d > lte) return false;
      }
      return true;
    });
    const items = normalizeList(filtered, o.type, Infinity, { releaseDate: true });
    if (o.sort && o.sort !== 'popular') {
      notes.push('A busca textual do TMDB ordena por relevância; ordenação aplicada localmente só a esta página.');
      sortLocal(items, o.sort);
    }
    return { items, ...paging(data, o.page, items.length), notes };
  }

  async function discoverPage(o, section) {
    const notes = [];
    const type = o.type ?? section?.type ?? 'movie';
    const sort = o.sort ?? section?.sort ?? 'popular';
    const upcoming = Boolean(section?.upcoming);
    const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date';
    const params = { include_adult: 'false', page: o.page };

    if (sort === 'rating') {
      params.sort_by = 'vote_average.desc';
      params['vote_count.gte'] = MIN_RATING_VOTES;
    } else if (sort === 'title') {
      params.sort_by = type === 'movie' ? 'original_title.asc' : 'original_name.asc';
      notes.push('Ordem alfabética pelo título original (o discover do TMDB não ordena pelo título traduzido).');
    } else if (sort === 'recent') {
      params.sort_by = `${dateField}.${upcoming ? 'asc' : 'desc'}`;
    } else {
      params.sort_by = 'popularity.desc';
    }
    if (o.genre) params.with_genres = o.genre;
    if (o.providerIds.length) {
      params.with_watch_providers = o.providerIds.join('|');
      params.watch_region = 'BR';
    }

    let [gte, lte] = o.year ? dateRange(o.year, o.month) : [];
    const today = todayBR(now());
    if (upcoming) gte = !gte || gte < today ? today : gte;
    else if (sort === 'recent' && !o.year) lte = today;
    if (gte) params[`${dateField}.gte`] = gte;
    if (lte) params[`${dateField}.lte`] = lte;

    const data = await request(`discover/${type}`, params);
    return toPage(data, o.page, type, notes);
  }

  async function catalogPage(options = {}) {
    const o = validPageOptions(options);
    if (o.query) return searchPage(o);
    const section = o.section ? SECTIONS[o.section.toLowerCase()] ?? SECTIONS['para você'] : null;
    const filtered = o.type || o.sort || o.genre || o.providerIds.length || o.year;
    if (section && !filtered) {
      const data = await request(section.path, { ...section.params, page: o.page });
      return toPage(data, o.page, section.type, []);
    }
    return discoverPage(o, section);
  }

  async function people(query, page = 1) {
    const q = validQuery(query);
    const p = validPage(page);
    const data = await request('search/person', { query: q, include_adult: 'false', page: p });
    if (!Array.isArray(data.results)) throw new Error(INVALID);
    const items = uniqueById(data.results, (x) => ({ ...toPerson(x), department: str(x.known_for_department) }));
    return { items, ...paging(data, p, items.length) };
  }

  async function studios(query, page = 1) {
    const q = validQuery(query);
    const p = validPage(page);
    const data = await request('search/company', { query: q, page: p });
    if (!Array.isArray(data.results)) throw new Error(INVALID);
    const items = uniqueById(data.results, toStudio);
    return { items, ...paging(data, p, items.length) };
  }

  async function studio(id, page = 1) {
    validId(id);
    const p = validPage(page);
    const [company, works] = await Promise.all([
      request(`company/${id}`),
      request('discover/movie', { with_companies: id, sort_by: 'popularity.desc', include_adult: 'false', page: p }),
    ]);
    const name = str(company.name);
    if (company.id !== id || !name) throw new Error(INVALID);
    if (!Array.isArray(works.results)) throw new Error(INVALID);
    const credits = normalizeList(works.results, 'movie', Infinity, { releaseDate: true });
    return {
      id,
      name,
      logo: image(company.logo_path),
      description: str(company.description),
      credits,
      ...paging(works, p, credits.length),
      coverage: 'movie', // só filmes: créditos de séries do estúdio não são consultados
    };
  }

  async function detail(type, id) {
    validType(type);
    validId(id);
    const raw = await request(`${type}/${id}`, {
      append_to_response: 'credits,videos,recommendations,watch/providers',
      include_video_language: VIDEO_LANGS.join(','),
    });
    if (raw.id !== id) throw new Error(INVALID);
    const t = normalizeTitle({ ...raw, media_type: type });
    if (!t) throw new Error(INVALID);

    const runtime = type === 'movie' ? raw.runtime : list(raw.episode_run_time)[0];
    if (isPosInt(runtime)) t.runtime = runtime;
    const tagline = str(raw.tagline);
    if (tagline) t.tagline = tagline;

    t.cast = list(raw.credits?.cast)
      .filter((p) => isObj(p) && isPosInt(p.id) && str(p.name))
      .slice(0, 20)
      .map((p) => {
        const person = { id: p.id, name: str(p.name), photo: image(p.profile_path) };
        const character = str(p.character);
        if (character) person.character = character;
        return person;
      });

    const directorCredits = type === 'movie'
      ? list(raw.credits?.crew).filter((c) => c?.job === 'Director')
      : list(raw.created_by);
    const directors = directorCredits.map((c) => str(c?.name));
    const director = [...new Set(directors.filter(Boolean))].join(', ');
    if (director) t.director = director;
    t.directors = uniqueById(directorCredits, toPerson);
    t.studios = uniqueById(raw.production_companies, toStudio);

    t.videos = normalizeVideos(raw.videos);
    t.recommendations = normalizeList(raw.recommendations?.results, type, 20);
    Object.assign(t, normalizeProviders(raw['watch/providers']));
    return t;
  }

  async function person(id) {
    validId(id);
    const raw = await request(`person/${id}`, { append_to_response: 'combined_credits' });
    const name = str(raw.name);
    if (raw.id !== id || !name) throw new Error(INVALID);
    const isMedia = (c) => c?.media_type === 'movie' || c?.media_type === 'tv';
    const cast = list(raw.combined_credits?.cast).filter(isMedia);
    const crew = list(raw.combined_credits?.crew).filter(isMedia);
    const credits = [...cast, ...crew];
    const popularity = new Map(credits.map((c) => [`${c.media_type}:${c.id}`, 0]));
    const roles = new Map();
    const addRole = (c, role) => {
      if (!role) return;
      const key = `${c.media_type}:${c.id}`;
      if (!roles.has(key)) roles.set(key, new Set());
      roles.get(key).add(role);
    };
    for (const c of cast) addRole(c, str(c.character) || 'Elenco');
    for (const c of crew) addRole(c, str(c.job) || str(c.department));
    for (const c of credits) {
      const key = `${c.media_type}:${c.id}`;
      const p = Number(c.popularity);
      if (Number.isFinite(p) && p > popularity.get(key)) popularity.set(key, p);
    }
    const titles = normalizeList(credits)
      .sort((a, b) => popularity.get(`${b.type}:${b.id}`) - popularity.get(`${a.type}:${a.id}`))
      .slice(0, 60);
    for (const t of titles) {
      const r = roles.get(`${t.type}:${t.id}`);
      if (r?.size) t.role = [...r].join(', ');
    }
    const out = { id, name, photo: image(raw.profile_path), credits: titles };
    const biography = str(raw.biography);
    if (biography) out.biography = biography;
    const department = str(raw.known_for_department);
    if (department) out.department = department;
    return out;
  }

  return { catalog, catalogPage, detail, person, people, studios, studio, cacheSize: () => cache.size };
}
