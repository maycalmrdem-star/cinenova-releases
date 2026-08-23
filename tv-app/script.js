/* ============================================================
   CineNova — Main Script
   TMDB API + Smart Caching + Lazy Loading + History
   ============================================================ */

// ── CONFIG ──────────────────────────────────────────────────
const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'; // Free public demo key
const TMDB = 'https://api.themoviedb.org/3';
const IMG_W = 'https://image.tmdb.org/t/p/w300';   // w300 for cards (fast)
const IMG_BIG = 'https://image.tmdb.org/t/p/w1280';  // w1280 for backdrop
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

const APP_LANG = 'en-US';

// Video servers with pop-ups blocked by sandbox
const SERVERS = {
    movie: [
        id => `https://www.vidking.net/embed/movie/${id}`
    ],
    tv: [
        (id, s, e) => `https://www.vidking.net/embed/tv/${id}/${s}/${e}`
    ]
};

const SERVER_NAMES = [
    'VidKing'
];

// ── SMART SERVER MEMORY ─────────────────────────────────────
function getLastServer(id) {
    try { return parseInt(localStorage.getItem('cn_srv_' + id)) || 0; } catch { return 0; }
}
function setLastServer(id, idx) {
    try { localStorage.setItem('cn_srv_' + id, idx); } catch { }
}

// ── STATE ───────────────────────────────────────────────────
let activeItem = null; // currently opened modal item
let activeServer = 0;    // 0-indexed server
let heroItems = [];
let heroIndex = 0;
let heroTimer = null;

// ── LOCAL STORAGE HISTORY ───────────────────────────────────
function getHistory() {
    try { return JSON.parse(localStorage.getItem('cn_history') || '[]'); } catch { return []; }
}
function addToHistory(item) {
    let hist = getHistory().filter(h => h.id !== item.id || h.media_type !== item.media_type);
    hist.unshift(item);
    if (hist.length > 40) hist = hist.slice(0, 40);
    localStorage.setItem('cn_history', JSON.stringify(hist));
}
function removeFromHistory(item) {
    const hist = getHistory().filter(h => h.id !== item.id || h.media_type !== item.media_type);
    localStorage.setItem('cn_history', JSON.stringify(hist));
    renderHistoryRow();
}
window.clearHistory = function () {
    localStorage.removeItem('cn_history');
    renderHistoryRow();
};

// ── SMART CACHE ──────────────────────────────────────────────
function cacheSet(key, data) {
    try { localStorage.setItem('cn_cache_' + key, JSON.stringify({ ts: Date.now(), data })); } catch { }
}
function cacheGet(key) {
    try {
        const raw = localStorage.getItem('cn_cache_' + key);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem('cn_cache_' + key); return null; }
        return data;
    } catch { return null; }
}

let MOVIE_DATA = [];

async function loadData() {
    if (MOVIE_DATA.length === 0) {
        try {
            const res = await fetch('data.json?v=' + Date.now());
            MOVIE_DATA = await res.json();
        } catch (e) {
            console.error("Error loading data.json", e);
        }
    }
    return MOVIE_DATA;
}

async function tmdb(endpoint, params = {}) {
    // Determine if it's a detail fetch or list fetch
    const isDetailFetch = endpoint.match(/\/tv\/\d+$/) || endpoint.includes('/season/') || endpoint.endsWith('/credits') || endpoint.endsWith('/similar') || endpoint.endsWith('/images') || endpoint.endsWith('/videos') || endpoint === '/movie/popular';

    if (isDetailFetch) {
        // Fetch from real TMDB
        const cacheKey = 'detail_' + endpoint + JSON.stringify(params) + APP_LANG;
        const cached = cacheGet(cacheKey);
        if (cached) return cached;

        try {
            const url = new URL(TMDB + endpoint);
            url.searchParams.set('api_key', TMDB_KEY);
            url.searchParams.set('language', APP_LANG);
            for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

            const res = await fetch(url.toString());
            const json = await res.json();
            if (json) cacheSet(cacheKey, json);
            return json;
        } catch (e) {
            console.error("TMDB Fetch Error", e);
            return { results: [], cast: [], episodes: [], seasons: [] };
        }
    }

    // Otherwise use local data.json for list categories
    const data = await loadData();
    let results = [...data];

    if (endpoint.includes('/discover/') || endpoint === '/movie/now_playing' || endpoint === '/movie/top_rated' || endpoint === '/tv/popular') {
        const isTV = endpoint.includes('/tv');
        results = results.filter(i => (i.media_type || (isTV ? 'tv' : 'movie')) === (isTV ? 'tv' : 'movie'));

        if (params.with_genres) {
            const genres = String(params.with_genres).split(',');
            results = results.filter(i => i.genre_ids && i.genre_ids.some(g => genres.includes(String(g))));
        }
        if (params.with_original_language) {
            const langs = params.with_original_language.split('|');
            results = results.filter(i => langs.includes(i.original_language));
        }
        if (params.sort_by === 'vote_average.desc' || endpoint === '/movie/top_rated') {
            results.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } else {
            results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }
    } else if (endpoint.startsWith('/search/multi')) {
        const q = (params.query || '').toLowerCase();
        results = results.filter(i => {
            const title = (i.title || i.name || '').toLowerCase();
            return title.includes(q);
        });
    }

    const page = params.page || 1;
    const limit = params.page ? 80 : 80;
    const start = (page - 1) * limit;
    const end = start + limit;

    return { results: results.slice(start, end) };
}

// ── RENDER CARD ──────────────────────────────────────────────
function makeCard(item) {
    const title = item.title || item.name || 'Unknown';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const posterUrl = item.poster_path
        ? IMG_W + item.poster_path
        : `https://placehold.co/300x450/111/555?text=${encodeURIComponent(title)}`;

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        <img src="${posterUrl}" alt="${title}" loading="lazy"
             onerror="this.src='https://placehold.co/300x450/111/555?text=${encodeURIComponent(title)}'">
        <div class="movie-card-overlay">
            <div class="card-title">${title}</div>
            <div class="card-year">${year}</div>
        </div>
        <button class="card-play" aria-label="Play"><i class="fa-solid fa-play"></i></button>
    `;
    // TV: One-click = instant play! Skip the modal entirely.
    card.addEventListener('click', () => {
        activeItem = item;
        playItem(item, -1, 1, 1);
    });
    return card;
}

// ── RENDER ROW ───────────────────────────────────────────────
async function renderRow(sliderId, endpoint, params = {}) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    slider.innerHTML = '<div class="skeleton-card"></div>'.repeat(6);

    const json = await tmdb(endpoint, params);
    if (!json || !json.results || !json.results.length) {
        slider.innerHTML = '<p style="color:var(--text3);padding:12px">No results found</p>';
        return;
    }

    slider.innerHTML = '';
    const isTV = endpoint.includes('/tv');
    json.results.slice(0, 80).forEach(item => {
        if (!item.poster_path) return;
        if (!item.media_type) item.media_type = isTV ? 'tv' : 'movie';
        slider.appendChild(makeCard(item));
    });
}

// ── HISTORY ROW ──────────────────────────────────────────────
function renderHistoryRow() {
    const section = document.getElementById('history-section');
    const slider = document.getElementById('history-slider');
    if (!section || !slider) return;

    const hist = getHistory();
    if (hist.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    slider.innerHTML = '';
    hist.forEach(item => slider.appendChild(makeCard(item)));
}

// ── HERO ─────────────────────────────────────────────────────
function renderHero(item) {
    if (!item) return;
    const title = item.title || item.name || '';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
    const genre = item.media_type === 'tv' ? 'Series' : 'Movie';
    const backdrop = item.backdrop_path ? IMG_BIG + item.backdrop_path : '';
    const desc = (item.overview || '').slice(0, 220) + ((item.overview || '').length > 220 ? '...' : '');

    const hero = document.getElementById('hero');
    if (backdrop) hero.style.backgroundImage = `url('${backdrop}')`;

    document.getElementById('hero-content').innerHTML = `
        <div class="hero-badge"><i class="fa-solid fa-fire"></i> Trending</div>
        <h1 class="hero-title">${title}</h1>
        <div class="hero-meta">
            ${rating ? `<span class="hero-rating">⭐ ${rating}</span>` : ''}
            ${year ? `<span class="hero-year">${year}</span>` : ''}
            <span class="hero-genre">${genre}</span>
        </div>
        <p class="hero-desc">${desc}</p>
        <div class="hero-btns">
            <button class="btn-primary" onclick="openModal(heroItems[heroIndex])">
                <i class="fa-solid fa-play"></i> Watch Now
            </button>
            <button class="btn-secondary" onclick="openModal(heroItems[heroIndex])">
                <i class="fa-solid fa-circle-info"></i> Details
            </button>
        </div>
    `;

    // indicators
    const dots = document.getElementById('hero-indicators');
    if (dots) {
        dots.innerHTML = '';
        heroItems.forEach((_, i) => {
            const d = document.createElement('div');
            d.className = 'hero-dot' + (i === heroIndex ? ' active' : '');
            d.onclick = () => { heroIndex = i; renderHero(heroItems[i]); resetHeroTimer(); };
            dots.appendChild(d);
        });
    }
}

function resetHeroTimer() {
    if (heroTimer) clearInterval(heroTimer);
    heroTimer = setInterval(() => {
        heroIndex = (heroIndex + 1) % heroItems.length;
        renderHero(heroItems[heroIndex]);
    }, 30000);
}

async function loadHero() {
    const json = await tmdb('/trending/all/week');
    heroItems = (json?.results || []).filter(i => i.backdrop_path).slice(0, 8);
    if (heroItems.length) { renderHero(heroItems[0]); resetHeroTimer(); }
}

let backdropInterval = null;

// ── MODAL ────────────────────────────────────────────────────
async function openModal(item) {
    activeItem = item;
    activeServer = 0;
    clearInterval(backdropInterval);

    const title = item.title || item.name || '';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const isTV = item.media_type === 'tv';
    const type = isTV ? 'Series' : 'Movie';

    const imdb = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const rt = item.vote_average ? Math.round(item.vote_average * 10) + '%' : 'N/A';
    const mc = item.vote_average ? Math.round(item.vote_average * 10) : 'N/A';

    const backdropEl = document.getElementById('modal-backdrop');
    backdropEl.style.transition = 'opacity 0.8s ease-in-out';
    backdropEl.style.opacity = 1;
    backdropEl.src = item.backdrop_path ? IMG_BIG + item.backdrop_path : (item.poster_path ? IMG_BIG + item.poster_path : '');

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-meta').innerHTML = `
        <span class="rating-badge imdb">IMDb ${imdb}</span>
        <span class="rating-badge rt">🍅 ${rt}</span>
        <span class="rating-badge mc">mc ${mc}</span>
        ${year ? `<span>${year}</span>` : ''}
        <span>${type}</span>
        ${item.original_language ? `<span>🌐 ${item.original_language.toUpperCase()}</span>` : ''}
    `;
    document.getElementById('modal-desc').textContent = item.overview || 'No description available.';

    // Start Backdrop Slideshow
    const endpoint = isTV ? `/tv/${item.id}/images` : `/movie/${item.id}/images`;
    tmdb(endpoint).then(imgData => {
        if (imgData?.backdrops?.length > 1) {
            const backdrops = imgData.backdrops.slice(0, 5).map(b => IMG_BIG + b.file_path);
            let bgIdx = 0;
            backdropInterval = setInterval(() => {
                backdropEl.style.opacity = 0;
                setTimeout(() => {
                    bgIdx = (bgIdx + 1) % backdrops.length;
                    backdropEl.src = backdrops[bgIdx];
                    backdropEl.style.opacity = 1;
                }, 800);
            }, 6000);
        }
    });

    // Server buttons reset
    document.querySelectorAll('.server-btn').forEach((btn, i) => btn.classList.toggle('active', i === 0));

    // Watch list button
    const inList = getHistory().some(h => h.id === item.id && h.media_type === item.media_type);
    const listBtn = document.getElementById('modal-list-btn');
    listBtn.className = 'btn-list' + (inList ? ' in-list' : '');
    listBtn.innerHTML = inList ? '<i class="fa-solid fa-check"></i> In List' : '<i class="fa-solid fa-plus"></i> My List';

    // Play button (default S1E1 for TV)
    document.getElementById('modal-play-btn').onclick = () => playItem(item, 0, 1, 1);

    document.getElementById('detail-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Clear dynamic sections
    document.getElementById('modal-cast-section').innerHTML = '<div class="cast-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    document.getElementById('modal-episodes-section').innerHTML = '';

    const similarSect = document.getElementById('modal-similar-section');
    if (similarSect) similarSect.innerHTML = '';

    // Fetch Cast
    const creditsEndpoint = isTV ? `/tv/${item.id}/credits` : `/movie/${item.id}/credits`;
    const credits = await tmdb(creditsEndpoint);
    renderCast(credits?.cast || []);

    // Fetch Similar / Parts
    const similarEndpoint = isTV ? `/tv/${item.id}/similar` : `/movie/${item.id}/similar`;
    const similarData = await tmdb(similarEndpoint);
    if (similarData?.results && similarSect) {
        renderSimilar(similarData.results.filter(r => r.poster_path).slice(0, 10));
    }

    // Fetch Seasons (TV only)
    if (isTV) {
        const details = await tmdb(`/tv/${item.id}`);
        renderSeasons(item, details);
    } else {
        document.getElementById('modal-episodes-section').innerHTML = '';
    }
}

window.toggleHistory = function () {
    if (!activeItem) return;
    const inList = getHistory().some(h => h.id === activeItem.id && h.media_type === activeItem.media_type);
    if (inList) { removeFromHistory(activeItem); }
    else { addToHistory(activeItem); }
    openModal(activeItem); // re-render button state
};

function closeModal() {
    document.getElementById('detail-modal').classList.remove('active');
    document.body.style.overflow = '';
    clearInterval(backdropInterval);
}

window.switchServer = function (num) {
    activeServer = num - 1;
    document.querySelectorAll('.server-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === activeServer);
    });
};

function renderSimilar(items) {
    const sect = document.getElementById('modal-similar-section');
    if (!sect || !items.length) return;

    const grid = document.createElement('div');
    grid.className = 'cast-scroll';
    items.forEach(i => {
        const photo = `https://image.tmdb.org/t/p/w185${i.poster_path}`;
        const title = i.title || i.name || '';
        const card = document.createElement('div');
        card.className = 'cast-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <img src="${photo}" alt="${title}" loading="lazy"
                 onerror="this.src='https://placehold.co/185x278/1a1a24/555?text=?'">
            <div class="cast-name">${title}</div>
        `;
        card.onclick = () => {
            if (!i.media_type) i.media_type = activeItem.media_type;
            document.querySelector('.modal-card').scrollTop = 0;
            openModal(i);
        };
        grid.appendChild(card);
    });

    sect.innerHTML = '<h3 class="modal-section-title"><i class="fa-solid fa-link"></i> Similar Parts & Works</h3>';
    sect.appendChild(grid);
}

// ── PLAYER ───────────────────────────────────────────────────
let currentPlaySeason = 1;
let currentPlayEpisode = 1;

function playItem(item, serverIdx = -1, season = 1, episode = 1) {
    if (!item) return;
    // Smart server: use last working server if no explicit choice
    if (serverIdx === -1) serverIdx = getLastServer(item.id);
    activeServer = serverIdx;
    currentPlaySeason = season;
    currentPlayEpisode = episode;
    closeModal();

    const isTV = item.media_type === 'tv';
    const list = isTV ? SERVERS.tv : SERVERS.movie;
    const fn = list[activeServer] || list[0];
    const url = isTV ? fn(item.id, season, episode) : fn(item.id);

    addToHistory(item);
    renderHistoryRow();

    const epLabel = isTV ? ` — Season ${season} Episode ${episode}` : '';
    document.getElementById('player-title').textContent = (item.title || item.name || '') + epLabel;

    // Update player server buttons state
    updatePlayerServerBtns();
    document.getElementById('player-servers-list').classList.remove('active');

    document.getElementById('player-frame').src = url;
    document.getElementById('player-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show/hide episode navigation
    document.getElementById('ep-nav').style.display = isTV ? 'flex' : 'none';

    // Force landscape on mobile
    tryLockLandscape();

    // Interactive Prediction logic
    checkAndShowPrediction(item);
}

function updatePlayerServerBtns() {
    const list = document.getElementById('player-servers-list');
    if (!list) return;
    list.innerHTML = SERVER_NAMES.map((name, i) =>
        `<button class="ps-btn ${i === activeServer ? 'active' : ''}" onclick="switchPlayerServer(${i + 1})">🌐 ${name}</button>`
    ).join('');
}

// Screen Orientation Lock logic
async function tryLockLandscape() {
    try {
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
    } catch (e) { console.log('Fullscreen lock unavailable', e); }
}

async function tryUnlockOrientation() {
    try {
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    } catch (e) { }
}

// Save working server when user manually selects one
function saveWorkingServer() {
    if (activeItem) setLastServer(activeItem.id, activeServer);
}

let predictionTimeout = null;

function checkAndShowPrediction(item) {
    const wrap = document.getElementById('prediction-wrap');
    if (!wrap) return;
    wrap.classList.remove('active');
    clearTimeout(predictionTimeout);

    // Genres: 28 Action, 27 Horror
    const isActionOrHorror = item.genre_ids && (item.genre_ids.includes(28) || item.genre_ids.includes(27));
    if (isActionOrHorror) {
        const optionsContainer = document.getElementById('prediction-options');
        const guesses = item.genre_ids.includes(27)
            ? ["A scary monster will appear!", "A character will die suddenly", "Unexpected dangerous trap"]
            : ["Hero wins the battle", "A huge explosion will occur", "A new enemy appears"];

        optionsContainer.innerHTML = '';
        guesses.forEach(g => {
            const b = document.createElement('button');
            b.className = 'pred-btn';
            b.textContent = g;
            b.onclick = () => {
                document.querySelectorAll('.pred-btn').forEach(btn => btn.classList.remove('selected'));
                b.classList.add('selected');
                b.innerHTML = `<i class="fa-solid fa-check"></i> Predicted!`;
                setTimeout(() => wrap.classList.remove('active'), 1500);
            };
            optionsContainer.appendChild(b);
        });

        predictionTimeout = setTimeout(() => {
            if (document.getElementById('player-overlay').classList.contains('active')) {
                wrap.classList.add('active');
            }
        }, 8000); // Overlay appears after 8 seconds
    }
}

window.togglePlayerServers = function () {
    document.getElementById('player-servers-list').classList.toggle('active');
};

window.switchPlayerServer = function (num) {
    if (!activeItem) return;
    activeServer = num - 1;
    saveWorkingServer();

    updatePlayerServerBtns();
    const listEl = document.getElementById('player-servers-list');
    if (listEl) listEl.classList.remove('active');

    const isTV = activeItem.media_type === 'tv';
    const list = isTV ? SERVERS.tv : SERVERS.movie;
    const fn = list[activeServer] || list[0];
    const url = isTV ? fn(activeItem.id, currentPlaySeason, currentPlayEpisode) : fn(activeItem.id);

    document.getElementById('player-frame').src = url;
};

// Close server list when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.player-servers-wrap')) {
        const list = document.getElementById('player-servers-list');
        if (list) list.classList.remove('active');
    }
});

// ── CAST RENDERER ─────────────────────────────────────────────
function renderCast(castList) {
    const section = document.getElementById('modal-cast-section');
    if (!section) return;
    if (!castList.length) { section.innerHTML = ''; return; }

    const top = castList.slice(0, 12);
    section.innerHTML = `
        <h3 class="modal-section-title"><i class="fa-solid fa-users"></i> Cast</h3>
        <div class="cast-scroll">
            ${top.map(actor => {
        const photo = actor.profile_path
            ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
            : `https://placehold.co/185x278/1a1a24/555?text=${encodeURIComponent(actor.name.split(' ')[0])}`;
        return `
                <div class="cast-card">
                    <img src="${photo}" alt="${actor.name}" loading="lazy"
                         onerror="this.src='https://placehold.co/185x278/1a1a24/555?text=?'">
                    <div class="cast-name">${actor.name}</div>
                    <div class="cast-char">${actor.character || ''}</div>
                </div>`;
    }).join('')}
        </div>
    `;
}

// ── SEASONS & EPISODES RENDERER ──────────────────────────────
let activeSeason = 1;

function renderSeasons(item, details) {
    const section = document.getElementById('modal-episodes-section');
    if (!section || !details) return;

    const seasons = (details.seasons || []).filter(s => s.season_number > 0);
    if (!seasons.length) { section.innerHTML = ''; return; }

    activeSeason = 1;

    section.innerHTML = `
        <h3 class="modal-section-title"><i class="fa-solid fa-list"></i> Seasons & Episodes</h3>
        <div class="season-tabs" id="season-tabs">
            ${seasons.map(s => `
                <button class="season-tab ${s.season_number === 1 ? 'active' : ''}"
                    onclick="loadEpisodes(${item.id}, ${s.season_number}, this)">
                    Season ${s.season_number}
                    <span class="season-ep-count">${s.episode_count} episodes</span>
                </button>
            `).join('')}
        </div>
        <div class="episodes-grid" id="episodes-grid">
            <div class="cast-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading episodes...</div>
        </div>
    `;

    // Load first season episodes automatically
    loadEpisodes(item.id, 1, document.querySelector('.season-tab'));
}

window.loadEpisodes = async function (seriesId, seasonNum, btnEl) {
    activeSeason = seasonNum;

    // Update active tab
    document.querySelectorAll('.season-tab').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const grid = document.getElementById('episodes-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="cast-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

    const data = await tmdb(`/tv/${seriesId}/season/${seasonNum}`);
    const episodes = data?.episodes || [];

    if (!episodes.length) {
        grid.innerHTML = '<p style="color:var(--text3);padding:12px">No episodes found.</p>';
        return;
    }

    grid.innerHTML = episodes.map(ep => {
        const thumb = ep.still_path
            ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
            : `https://placehold.co/300x169/1a1a24/555?text=Ep+${ep.episode_number}`;
        return `
        <div class="episode-card" onclick="playItem(activeItem, activeServer, ${seasonNum}, ${ep.episode_number})">
            <div class="ep-thumb-wrap">
                <img src="${thumb}" alt="Episode ${ep.episode_number}" loading="lazy"
                     onerror="this.src='https://placehold.co/300x169/1a1a24/555?text=Ep+${ep.episode_number}'">
                <div class="ep-play-overlay"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="ep-info">
                <span class="ep-num">Episode ${ep.episode_number}</span>
                <span class="ep-title">${ep.name || ''}</span>
                ${ep.runtime ? `<span class="ep-runtime">${ep.runtime} min</span>` : ''}
            </div>
        </div>`;
    }).join('');
};

function closePlayer() {
    document.getElementById('player-overlay').classList.remove('active');
    document.getElementById('player-frame').src = '';
    document.body.style.overflow = '';
    clearTimeout(predictionTimeout);
    tryUnlockOrientation();
    const wrap = document.getElementById('prediction-wrap');
    if (wrap) wrap.classList.remove('active');
}

window.playNextEpisode = async function () {
    if (!activeItem || activeItem.media_type !== 'tv') return;

    document.getElementById('next-ep-btn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

    // Check if next episode exists in the current season data
    const seasonData = await tmdb(`/tv/${activeItem.id}/season/${currentPlaySeason}`);
    const epsCount = seasonData?.episodes?.length || 0;

    if (currentPlayEpisode < epsCount) {
        playItem(activeItem, activeServer, currentPlaySeason, currentPlayEpisode + 1);
    } else {
        // Try next season
        const nextSeasonData = await tmdb(`/tv/${activeItem.id}/season/${currentPlaySeason + 1}`);
        if (nextSeasonData && nextSeasonData.episodes && nextSeasonData.episodes.length > 0) {
            playItem(activeItem, activeServer, currentPlaySeason + 1, 1);
        } else {
            alert('أنت في Episode الأخيرة المتوفرة.');
        }
    }
    document.getElementById('next-ep-btn').innerHTML = 'Next <i class="fa-solid fa-forward-step"></i>';
};

window.playPrevEpisode = async function () {
    if (!activeItem || activeItem.media_type !== 'tv') return;

    document.getElementById('prev-ep-btn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

    if (currentPlayEpisode > 1) {
        playItem(activeItem, activeServer, currentPlaySeason, currentPlayEpisode - 1);
    } else if (currentPlaySeason > 1) {
        // Try prev season
        const prevSeasonData = await tmdb(`/tv/${activeItem.id}/season/${currentPlaySeason - 1}`);
        if (prevSeasonData && prevSeasonData.episodes) {
            playItem(activeItem, activeServer, currentPlaySeason - 1, prevSeasonData.episodes.length);
        }
    }
    document.getElementById('prev-ep-btn').innerHTML = '<i class="fa-solid fa-backward-step"></i> Prev';
};

// ── SEARCH ───────────────────────────────────────────────────
let searchTimer = null;

function setupSearch() {
    const trigger = document.getElementById('search-trigger');
    const overlay = document.getElementById('search-overlay');
    const closeBtn = document.getElementById('close-search');
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    setupTVKeyboard(input, results);

    trigger.addEventListener('click', () => {
        overlay.classList.add('active');
        // On TV, focus the first keyboard key instead of input to keep keyboard hidden
        const kb = document.getElementById('tv-keyboard');
        if (kb && kb.children.length > 0) {
            kb.style.display = 'flex';
            setTimeout(() => setFocus && setFocus(kb.children[0]), 50);
        } else {
            input.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        input.value = '';
        results.innerHTML = '<p class="search-hint">Type to search millions of titles...</p>';
        document.getElementById('tv-keyboard').style.display = 'none';

        // Return focus to trigger
        setTimeout(() => setFocus && setFocus(trigger), 50);
    });

    input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = input.value.trim();
        if (!q) { results.innerHTML = '<p class="search-hint">Type to search millions of titles...</p>'; return; }
        results.innerHTML = '<p class="search-hint">Searching...</p>';
        searchTimer = setTimeout(() => doSearch(q, results), 400);
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) closeBtn.click(); });
}

function setupTVKeyboard(input, results) {
    const kb = document.getElementById('tv-keyboard');
    if (!kb) return;

    // QWERTY Layout
    const rows = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
    ];

    rows.forEach(row => {
        row.forEach(char => {
            const btn = document.createElement('div');
            btn.className = 'tv-key';
            btn.textContent = char;
            btn.onclick = () => {
                input.value += char;
                input.dispatchEvent(new Event('input'));
            };
            kb.appendChild(btn);
        });
    });

    // Special Keys
    const space = document.createElement('div');
    space.className = 'tv-key tv-key-wide tv-key-dark';
    space.textContent = 'SPACE';
    space.onclick = () => {
        input.value += ' ';
        input.dispatchEvent(new Event('input'));
    };

    const backspace = document.createElement('div');
    backspace.className = 'tv-key tv-key-wide tv-key-dark';
    backspace.textContent = 'BACKSPACE';
    backspace.onclick = () => {
        input.value = input.value.slice(0, -1);
        input.dispatchEvent(new Event('input'));
    };

    const clear = document.createElement('div');
    clear.className = 'tv-key tv-key-wide tv-key-dark';
    clear.textContent = 'CLEAR';
    clear.onclick = () => {
        input.value = '';
        input.dispatchEvent(new Event('input'));
    };

    kb.appendChild(space);
    kb.appendChild(backspace);
    kb.appendChild(clear);
}

async function doSearch(q, container) {
    const json = await tmdb('/search/multi', { query: q, include_adult: false });
    if (!json?.results?.length) { container.innerHTML = '<p class="search-hint">No results found</p>'; return; }

    const grid = document.createElement('div');
    grid.className = 'search-grid';

    json.results.filter(i => i.poster_path && (i.media_type === 'movie' || i.media_type === 'tv'))
        .slice(0, 80)
        .forEach(item => {
            const card = makeCard(item);
            card.addEventListener('click', () => {
                document.getElementById('search-overlay').classList.remove('active');
                openModal(item);
            }, { once: true });
            grid.appendChild(card);
        });

    container.innerHTML = '';
    container.appendChild(grid);
}

// ── SLIDER SCROLL ─────────────────────────────────────────────
window.slideRow = function (sliderId, dir) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    slider.scrollBy({ left: dir * 700, behavior: 'smooth' });
};

// ── NAVIGATION ────────────────────────────────────────────────
function setupNav() {
    initLanguageUI();
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const page = btn.dataset.page;

            // Toggle Display
            const main = document.getElementById('main-content');
            const reelsSec = document.getElementById('section-reels');
            const heroWrap = document.querySelector('.hero-wrap');
            if (page === 'reels') {
                main.style.display = 'none';
                reelsSec.style.display = 'block';
                if (heroWrap) heroWrap.style.display = 'none';
                loadReels();
            } else {
                main.style.display = '';
                reelsSec.style.display = 'none';

                if (page === 'home') {
                    if (heroWrap) heroWrap.style.display = 'block';
                    showHomePage();
                } else {
                    if (heroWrap) heroWrap.style.display = 'none';
                    if (page === 'movies') showCategoryPage('movies', 'Movies', '/discover/movie', { sort_by: 'popularity.desc' });
                    else if (page === 'series') showCategoryPage('series', 'Series', '/discover/tv', { sort_by: 'popularity.desc' });
                    else if (page === 'anime') showCategoryPage('anime', 'Anime', '/discover/tv', { with_genres: 16, with_original_language: 'ja', sort_by: 'popularity.desc' });
                    else if (page === 'asian') showCategoryPage('asian', 'Asian Cinema', '/discover/movie', { with_original_language: 'zh|ja|ko', sort_by: 'vote_average.desc', 'vote_count.gte': 500 });
                    else if (page === 'mylist') showMyList();
                }
            }
        });
    });
}

// ── PAGES ──────────────────────────────────────────────────
function showHomePage() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <section class="content-section" id="history-section" style="display:none">
            <div class="section-header">
                <h2 class="section-title"><i class="fa-solid fa-clock-rotate-left"></i> Continue Watching</h2>
                <button class="clear-history-btn" onclick="clearHistory()">Clear All</button>
            </div>
            <div class="slider-wrap">
                <button class="slider-arrow arrow-left" onclick="slideRow('history-slider', -1)"><i class="fa-solid fa-chevron-left"></i></button>
                <div class="slider" id="history-slider"></div>
                <button class="slider-arrow arrow-right" onclick="slideRow('history-slider', 1)"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
        </section>

    ${makeSection('section-trending', 'slider-trending', 'fa-fire', 'Trending', '/trending/all/week')}
        ${makeSection('section-new', 'slider-new', 'fa-star', 'New This Week', '/movie/now_playing')}
        ${makeSection('section-top', 'slider-top', 'fa-trophy', 'Top Rated', '/movie/top_rated')}
        ${makeSection('section-series', 'slider-series', 'fa-tv', 'Popular Series', '/tv/popular')}
        ${makeSection('section-anime', 'slider-anime', 'fa-dragon', 'Anime', '/discover/tv', '{"with_genres": 16, "with_original_language": "ja", "sort_by": "popularity.desc"}')}
        ${makeSection('section-asian', 'slider-asian', 'fa-torii-gate', 'Asian Cinema', '/discover/movie', '{"with_original_language": "zh|ja|ko", "sort_by": "vote_average.desc", "vote_count.gte": 200}')}
        ${makeSection('section-action', 'slider-action', 'fa-bolt', 'Action & Adventure', '/discover/movie', '{"with_genres": "28,12", "sort_by": "popularity.desc"}')}
        ${makeSection('section-scifi', 'slider-scifi', 'fa-rocket', 'Sci-Fi', '/discover/movie', '{"with_genres": 878, "sort_by": "popularity.desc"}')}
        ${makeSection('section-horror', 'slider-horror', 'fa-ghost', 'Horror', '/discover/movie', '{"with_genres": 27, "sort_by": "popularity.desc"}')}
        ${makeSection('section-comedy', 'slider-comedy', 'fa-face-laugh', 'Comedy', '/discover/movie', '{"with_genres": 35, "sort_by": "popularity.desc"}')}
        ${makeSection('section-romance', 'slider-romance', 'fa-heart', 'Romance', '/discover/movie', '{"with_genres": 10749, "sort_by": "popularity.desc"}')}
        ${makeSection('section-chinese', 'slider-chinese', 'fa-flag', 'Chinese Movies', '/discover/movie', '{"with_original_language": "zh", "sort_by": "vote_average.desc", "vote_count.gte": 200}')}
        ${makeSection('section-japanese', 'slider-japanese', 'fa-torii-gate', 'Japanese Movies', '/discover/movie', '{"with_original_language": "ja", "sort_by": "vote_average.desc", "vote_count.gte": 200}')}
        ${makeSection('section-korean', 'slider-korean', 'fa-music', 'Korean Drama', '/discover/tv', '{"with_original_language": "ko", "sort_by": "popularity.desc"}')}
    `;

    renderHistoryRow();

    // TV Performance: Lazy Load Sliders
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const endpoint = el.dataset.endpoint;
                if (endpoint && !el.dataset.loaded) {
                    el.dataset.loaded = "true";
                    let params = {};
                    if (el.dataset.params) params = JSON.parse(el.dataset.params);
                    renderRow(el.dataset.slider, endpoint, params);
                    observer.unobserve(el);
                }
            }
        });
    }, { rootMargin: "0px 0px 600px 0px" });

    document.querySelectorAll('.content-section').forEach(sec => observer.observe(sec));
}

// ── REELS ────────────────────────────────────────────────────
window.reelsDataMap = {};
async function loadReels() {
    const container = document.getElementById('reels-container');
    if (container.dataset.loaded) return;

    container.innerHTML = '<div style="text-align: center; margin-top: 100px; color: var(--accent);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Finding Trailers...</div>';

    // Fetch popular movies
    const data = await tmdb('/movie/popular', { page: 1 });
    if (!data?.results?.length) return;

    let reelsHtml = '';
    const validMovies = data.results.slice(0, 15);

    for (const m of validMovies) {
        const vids = await tmdb(`/movie/${m.id}/videos`);
        const trailer = vids?.results?.find(v => v.type === 'Trailer') || vids?.results?.[0];
        if (trailer && trailer.site === 'YouTube') {
            window.reelsDataMap[m.id] = m;
            reelsHtml += `
            <div class="reel-item">
                <div class="reel-video-container">
                    <iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&loop=1&controls=0&playlist=${trailer.key}&modestbranding=1&rel=0&playsinline=1" allow="autoplay" allowfullscreen></iframe>
                </div>
                <div class="reel-overlay">
                    <h2 class="reel-title">${m.title || m.name}</h2>
                    <p class="reel-desc">${m.overview}</p>
                    <button class="reel-btn" onclick="openModal(window.reelsDataMap[${m.id}])">
                        <i class="fa-solid fa-play"></i> Let's Watch
                    </button>
                </div>
            </div>`;
        }
    }

    if (reelsHtml === '') {
        container.innerHTML = '<div style="text-align: center; margin-top: 100px; color: #fff;">No trailers found at the moment.</div>';
    } else {
        container.innerHTML = reelsHtml;
        container.dataset.loaded = 'true';
    }
}

function makeSection(sectionId, sliderId, icon, title, endpoint = "", paramsStr = "") {
    return `
    <section class="content-section" id="${sectionId}" data-slider="${sliderId}" data-endpoint="${endpoint}" data-params='${paramsStr}'>
        <div class="section-header">
            <h2 class="section-title"><i class="fa-solid ${icon}"></i> ${title}</h2>
        </div>
        <div class="slider-wrap">
            <button class="slider-arrow arrow-left" onclick="slideRow('${sliderId}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
            <div class="slider" id="${sliderId}">
                ${'<div class="skeleton-card"></div>'.repeat(6)}
            </div>
            <button class="slider-arrow arrow-right" onclick="slideRow('${sliderId}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
    </section>`;
}

// ── CATEGORY PAGE (Infinite Scroll) ──────────────────────────
let categoryPage = 1;
let categoryLoading = false;
let currentEndpoint = '';
let currentParams = {};

async function showCategoryPage(id, title, endpoint, params) {
    categoryPage = 1;
    categoryLoading = false;
    currentEndpoint = endpoint;
    currentParams = params;

    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="page-header">
            <h1>${title}</h1>
            <p>تصفح ملايين المحتويات</p>
        </div>
        <div class="content-grid" id="category-grid"></div>
        <div id="load-more-sentinel" style="height:60px;"></div>
    `;

    await loadMoreCategory();
    setupInfiniteScroll();
}

async function loadMoreCategory() {
    if (categoryLoading) return;
    categoryLoading = true;

    const grid = document.getElementById('category-grid');
    if (!grid) return;

    const json = await tmdb(currentEndpoint, { ...currentParams, page: categoryPage });
    if (json?.results?.length) {
        const isTV = currentEndpoint.includes('/tv');
        json.results.filter(i => i.poster_path).forEach(item => {
            if (!item.media_type) item.media_type = isTV ? 'tv' : 'movie';
            const card = makeCard(item);
            card.style.width = '';
            grid.appendChild(card);
        });
        categoryPage++;
    }
    categoryLoading = false;
}

function setupInfiniteScroll() {
    const sentinel = document.getElementById('load-more-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) loadMoreCategory();
    }, { threshold: 0.1 });
    observer.observe(sentinel);
}

// ── MY LIST PAGE ─────────────────────────────────────────────
function showMyList() {
    const main = document.getElementById('main-content');
    const hist = getHistory();

    if (hist.length === 0) {
        main.innerHTML = `
            <div class="page-header"><h1>My List</h1></div>
            <div class="empty-state">
                <i class="fa-solid fa-heart"></i>
                <p>قائمتك فارغة. ابدأ المشاهدة وستظهر هنا تلقائياً!</p>
            </div>`;
        return;
    }

    main.innerHTML = `
        <div class="page-header">
            <h1>My List · سجل المشاهدة</h1>
            <p>${hist.length} عنصر · خاص بك فقط (محفوظ على جهازك)</p>
        </div>
        <div class="content-grid" id="my-list-grid"></div>
    `;

    const grid = document.getElementById('my-list-grid');
    hist.forEach(item => { const card = makeCard(item); card.style.width = ''; grid.appendChild(card); });
}

// ── EVENT LISTENERS ───────────────────────────────────────────
document.getElementById('close-modal')?.addEventListener('click', closeModal);
document.getElementById('close-player')?.addEventListener('click', closePlayer);
document.getElementById('detail-modal')?.addEventListener('click', e => { if (e.target.id === 'detail-modal') closeModal(); });

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closePlayer();
        closeModal();
        document.getElementById('search-overlay')?.classList.remove('active');
    }
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 50);
});

// ── LANGUAGE TOGGLE ──────────────────────────────────────────
function initLanguageUI() {
    const txt = document.getElementById('current-lang-text');
    if (txt) txt.textContent = APP_LANG === 'ar-SA' ? 'AR' : 'EN';
}

window.toggleLanguage = function () {
    APP_LANG = APP_LANG === 'ar-SA' ? 'en-US' : 'ar-SA';
    localStorage.setItem('cn_lang', APP_LANG);
    location.reload();
};

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    setupNav();
    setupSearch();

    const loading = document.getElementById('loading-screen');
    if (loading) {
        setTimeout(() => {
            loading.classList.add('hidden');
            setTimeout(() => loading.remove(), 500);
        }, 1200);
    }

    await loadHero();
    showHomePage();
});

// Spacebar handling for Video Player
window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
        const player = document.getElementById('player-overlay');
        const iframe = document.getElementById('player-frame');
        if (player && player.classList.contains('active') && iframe) {
            e.preventDefault();
            iframe.focus();
        }
    }
});
