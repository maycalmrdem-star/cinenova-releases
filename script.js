/* ============================================================
   CineNova v4.0 — Ultra-Premium Streaming Engine
   ✦ Inline Trailers · Push Notifications · Continue Watching
   ✦ Advanced Filters · Instant Cache Busting · New UI
   ============================================================ */

// ── CONFIG ──────────────────────────────────────────────────
const API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb'; // Working TMDB API Key
const TMDB = 'https://api.themoviedb.org/3';
const IMG_W = 'https://image.tmdb.org/t/p/w300';
const IMG_BIG = 'https://image.tmdb.org/t/p/w1280';
const CACHE_TTL = 6 * 60 * 60 * 1000;
const APP_VERSION = '5.0.0'; // Bump to force cache clear for all users
const DATA_VERSION = 'v' + new Date().getTime(); // Force absolute cache miss on every load for testing, or just use timestamp

let APP_LANG = localStorage.getItem('cn_lang') || 'en-US'; // BUG FIX: was const

// ── SECURITY: HTML-escape any text before it's interpolated into innerHTML ──
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// ── SERVERS (Updated working sources) ──────────────────────
const SERVERS = {
    movie: [
        id => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
        id => `https://vidsrc.cc/v2/embed/movie/${id}`,
        id => `https://embed.su/embed/movie/${id}`,
        id => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
        id => `https://autoembed.co/movie/tmdb/${id}`,
        id => `https://vidsrc.pro/embed/movie/${id}`,
        id => `https://moviesapi.club/movie/${id}`,
        id => `https://player.videasy.net/movie/${id}`
    ],
    tv: [
        (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
        (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
        (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
        (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
        (id, s, e) => `https://autoembed.co/tv/tmdb/${id}-${s}-${e}`,
        (id, s, e) => `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
        (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}`,
        (id, s, e) => `https://player.videasy.net/tv/${id}/${s}/${e}`
    ]
};

const PREMIUM_SERVERS = [
    { name: 'VidSrc', status: 'available', icon: 'fa-play' },
    { name: 'VidCC', status: 'available', icon: 'fa-film' },
    { name: 'EmbedSU', status: 'available', icon: 'fa-circle-play' },
    { name: 'MultiEmbed', status: 'untested', icon: 'fa-layer-group' },
    { name: 'AutoEmbed', status: 'untested', icon: 'fa-bolt' },
    { name: 'VidPro', status: 'untested', icon: 'fa-gem' },
    { name: 'MoviesAPI', status: 'untested', icon: 'fa-clapperboard' },
    { name: 'Videasy', status: 'untested', icon: 'fa-tv' }
];

const GENRE_MAP = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action', 10765: 'Sci-Fi', 10768: 'War'
};

const CONTENT_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

// ── SMART SERVER MEMORY ─────────────────────────────────────
function getLastServer(id) {
    try { return parseInt(localStorage.getItem('cn_srv_' + id)) || 0; } catch { return 0; }
}
function setLastServer(id, idx) {
    try { localStorage.setItem('cn_srv_' + id, idx); } catch { }
}

// ── STATE ───────────────────────────────────────────────────
let activeItem = null;
let activeServer = 0;
let heroItems = [];
let heroIndex = 0;
let heroTimer = null;
let backdropInterval = null;
let currentPlaySeason = 1;
let currentPlayEpisode = 1;
let searchTimer = null;
let predictionTimeout = null;
let activeSeason = 1;
let categoryPage = 1;
let categoryLoading = false;
let currentEndpoint = '';
let currentParams = {};

// ── TOAST NOTIFICATION SYSTEM ────────────────────────────────
function showToast(title, msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon ${type}"><i class="fa-solid ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-xmark' : type === 'warning' ? 'fa-exclamation' : 'fa-info'}"></i></div>
        <div class="toast-body">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-msg">${escapeHtml(msg)}</div>
        </div>
        <button class="toast-close" onclick="this.closest('.toast').remove()"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, duration);
}

// ── LOCAL STORAGE HISTORY ───────────────────────────────────
function getHistory() {
    try { return JSON.parse(localStorage.getItem('cn_history') || '[]'); } catch { return []; }
}
function addToHistory(item) {
    let hist = getHistory().filter(h => h.id !== item.id || h.media_type !== item.media_type);
    hist.unshift(item);
    if (hist.length > 50) hist = hist.slice(0, 50);
    localStorage.setItem('cn_history', JSON.stringify(hist));
    updateListBadge();
}
function removeFromHistory(item) {
    const hist = getHistory().filter(h => h.id !== item.id || h.media_type !== item.media_type);
    localStorage.setItem('cn_history', JSON.stringify(hist));
    renderHistoryRow();
    updateListBadge();
}
window.clearHistory = function () {
    localStorage.removeItem('cn_history');
    renderHistoryRow();
    updateListBadge();
    showToast('Cleared', 'Watch history has been cleared.', 'success');
};

function updateListBadge() {
    const badge = document.getElementById('list-badge');
    const count = getHistory().length;
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

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
            // Always bypass cache for data.json so new users get fresh content
            const res = await fetch('data.json?_=' + DATA_VERSION, { cache: 'no-store' });
            MOVIE_DATA = await res.json();
        } catch (e) {
            console.error('Error loading data.json', e);
        }
    }
    return MOVIE_DATA;
}

// ── PUSH NOTIFICATIONS ───────────────────────────────────────
async function requestPushPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
}

function sendLocalNotification(title, body, icon) {
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: icon || '/icon-192.png', badge: '/icon-192.png', tag: 'cinenova-notif' });
}

async function setupPushNotifications() {
    const alreadyAsked = localStorage.getItem('cn_push_asked');
    if (alreadyAsked) return;
    // Ask after 30 seconds of use
    setTimeout(async () => {
        const granted = await requestPushPermission();
        localStorage.setItem('cn_push_asked', '1');
        if (granted) {
            showToast('Notifications On', 'You will be notified about new releases!', 'success', 3000);
        }
    }, 30000);
}

// ── CONTINUE WATCHING PROGRESS ───────────────────────────────
function saveWatchProgress(itemId, mediaType, season, episode, percent) {
    try {
        const key = `cn_progress_${mediaType}_${itemId}`;
        localStorage.setItem(key, JSON.stringify({ season, episode, percent, ts: Date.now() }));
    } catch { }
}

function getWatchProgress(itemId, mediaType) {
    try {
        const key = `cn_progress_${mediaType}_${itemId}`;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function tmdb(endpoint, params = {}) {
    const isDetailFetch = endpoint.match(/\/tv\/\d+$/) || endpoint.includes('/season/') || endpoint.endsWith('/credits') || endpoint.endsWith('/similar') || endpoint.endsWith('/images') || endpoint.endsWith('/videos') || endpoint === '/movie/popular' || endpoint.startsWith('/search/') || endpoint.startsWith('/discover/');

    if (isDetailFetch) {
        const cacheKey = 'detail_' + endpoint + JSON.stringify(params) + APP_LANG;
        const cached = cacheGet(cacheKey);
        if (cached) return cached;

        try {
            const url = new URL(TMDB + endpoint);
            url.searchParams.set('api_key', API_KEY);
            url.searchParams.set('language', APP_LANG);
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
            }
            const res = await fetch(url.toString());
            const json = await res.json();
            if (json) cacheSet(cacheKey, json);
            return json;
        } catch (e) {
            console.error("TMDB Fetch Error", e);
            return { results: [], cast: [], episodes: [], seasons: [] };
        }
    }

    const data = await loadData();
    let results = [...data];

    if (endpoint === '/movie/now_playing' || endpoint === '/movie/top_rated' || endpoint === '/tv/popular') {
        const isTV = endpoint.includes('/tv');
        results = results.filter(i => (i.media_type || (isTV ? 'tv' : 'movie')) === (isTV ? 'tv' : 'movie'));
        if (params.sort_by === 'vote_average.desc' || endpoint === '/movie/top_rated') {
            results.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } else {
            results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }
    }

    const page = params.page || 1;
    const limit = 80;
    const start = (page - 1) * limit;
    return { results: results.slice(start, start + limit) };
}

// ── RENDER CARD (Enhanced) ──────────────────────────────────
function makeCard(item) {
    const title = item.title || item.name || 'Unknown';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
    const posterUrl = item.poster_path
        ? IMG_W + item.poster_path
        : `https://placehold.co/300x450/0b0e17/555?text=${encodeURIComponent(title)}`;

    // Genre tags
    const genres = (item.genre_ids || []).slice(0, 2).map(id => GENRE_MAP[id]).filter(Boolean);

    // Quality badge
    const quality = item.vote_average >= 7.5 ? 'HD' : item.vote_average >= 6 ? 'HD' : 'CAM';

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
        ${rating ? `<div class="card-rating-badge"><i class="fa-solid fa-star" style="font-size:0.6rem"></i> ${rating}</div>` : ''}
        <div class="card-quality-badge">${quality}</div>
        <img src="${posterUrl}" alt="${escapeHtml(title)}" loading="lazy"
             onerror="this.src='https://placehold.co/300x450/0b0e17/555?text=${encodeURIComponent(title)}'">
        <div class="movie-card-overlay">
            <div class="card-title">${escapeHtml(title)}</div>
            <div class="card-year">${escapeHtml(year)}${genres.length ? ' · ' + escapeHtml(genres.join(', ')) : ''}</div>
        </div>
        <button class="card-play" aria-label="Play ${escapeHtml(title)}"><i class="fa-solid fa-play"></i></button>
    `;
    card.addEventListener('click', () => openModal(item));

    // Quick play on right click
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!item.media_type && !item.first_air_date) item.media_type = 'movie';
        if (!item.media_type && item.first_air_date) item.media_type = 'tv';
        playItem(item, -1, 1, 1);
        showToast('Quick Play', `Playing ${title}...`, 'success', 2000);
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
    if (hist.length === 0) { section.style.display = 'none'; return; }

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
        <div class="hero-badge"><i class="fa-solid fa-fire"></i> Trending Now</div>
        <h1 class="hero-title">${escapeHtml(title)}</h1>
        <div class="hero-meta">
            ${rating ? `<span class="hero-rating">⭐ ${rating}</span>` : ''}
            ${year ? `<span class="hero-year">${escapeHtml(year)}</span>` : ''}
            <span class="hero-genre">${genre}</span>
        </div>
        <p class="hero-desc">${escapeHtml(desc)}</p>
        <div class="hero-btns">
            <button class="btn-primary" onclick="openModal(heroItems[heroIndex])">
                <i class="fa-solid fa-play"></i> Watch Now
            </button>
            <button class="btn-secondary" onclick="openModal(heroItems[heroIndex])">
                <i class="fa-solid fa-circle-info"></i> Details
            </button>
        </div>
    `;

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
    }, 7000);
}

async function loadHero() {
    const json = await tmdb('/trending/all/week');
    heroItems = (json?.results || []).filter(i => i.backdrop_path).slice(0, 10);
    if (heroItems.length) { renderHero(heroItems[0]); resetHeroTimer(); }
}

// ── MODAL ────────────────────────────────────────────────────
async function openModal(item) {
    activeItem = item;
    // BUG FIX: Use smart server memory instead of always resetting to 0
    activeServer = getLastServer(item.id);
    clearInterval(backdropInterval);

    const title = item.title || item.name || '';
    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
    const isTV = item.media_type === 'tv';
    const type = isTV ? 'Series' : 'Movie';
    const imdb = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const rt = item.vote_average ? Math.round(item.vote_average * 10) + '%' : 'N/A';
    const mc = item.vote_average ? Math.round(item.vote_average * 10) : 'N/A';
    const lang = item.original_language ? item.original_language.toUpperCase() : '';

    const backdropEl = document.getElementById('modal-backdrop');
    backdropEl.style.transition = 'opacity 0.8s ease-in-out';
    backdropEl.style.opacity = 1;
    backdropEl.src = item.backdrop_path ? IMG_BIG + item.backdrop_path : (item.poster_path ? IMG_BIG + item.poster_path : '');

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-meta').innerHTML = `
        <span class="rating-badge imdb"><i class="fa-solid fa-star" style="font-size:0.65rem"></i> IMDb ${imdb}</span>
        <span class="rating-badge rt">🍅 ${rt}</span>
        <span class="rating-badge mc">MC ${mc}</span>
        ${year ? `<span>${year}</span>` : ''}
        <span>${type}</span>
        ${lang ? `<span>🌐 ${lang}</span>` : ''}
    `;
    document.getElementById('modal-desc').textContent = item.overview || 'No description available.';

    // Update server text
    const sName = PREMIUM_SERVERS[activeServer]?.name || 'Oxygen';
    const modalText = document.getElementById('modal-current-server-text');
    if (modalText) modalText.innerText = 'Current: ' + sName;

    // Backdrop Slideshow
    const imgEndpoint = isTV ? `/tv/${item.id}/images` : `/movie/${item.id}/images`;
    tmdb(imgEndpoint).then(imgData => {
        if (imgData?.backdrops?.length > 1) {
            const backdrops = imgData.backdrops.slice(0, 6).map(b => IMG_BIG + b.file_path);
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

    // Watch list button
    const inList = getHistory().some(h => h.id === item.id && h.media_type === item.media_type);
    const listBtn = document.getElementById('modal-list-btn');
    listBtn.className = 'btn-list' + (inList ? ' in-list' : '');
    listBtn.innerHTML = inList ? '<i class="fa-solid fa-check"></i> In List' : '<i class="fa-solid fa-plus"></i> My List';

    // Play button — resume from last position if available
    const progress = getWatchProgress(item.id, item.media_type || (isTV ? 'tv' : 'movie'));
    const playBtn = document.getElementById('modal-play-btn');
    if (progress && (progress.percent || 0) > 5) {
        playBtn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Resume S${progress.season}:E${progress.episode}`;
        playBtn.onclick = () => playItem(item, -1, progress.season || 1, progress.episode || 1);
    } else {
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Watch Now';
        playBtn.onclick = () => playItem(item, -1, 1, 1);
    }

    // Trailer button — inline player inside modal
    const trailerBtn = document.getElementById('modal-trailer-btn');
    if (trailerBtn) {
        trailerBtn.style.display = 'none';
        const vidEndpoint = isTV ? `/tv/${item.id}/videos` : `/movie/${item.id}/videos`;
        tmdb(vidEndpoint).then(vidData => {
            const trailer = vidData?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
            if (trailer) {
                trailerBtn.style.display = 'inline-flex';
                trailerBtn.onclick = () => openInlineTrailer(trailer.key, title);
            }
        });
    }

    // Share button
    const shareBtn = document.getElementById('modal-share-btn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            const shareData = {
                title: `${title} - CineNova`,
                text: `Watch ${title} on CineNova! 🎬`,
                url: window.location.origin
            };
            if (navigator.share) {
                navigator.share(shareData).catch(() => {});
            } else {
                navigator.clipboard.writeText(shareData.url).then(() => {
                    showToast('Link Copied', 'Share link copied to clipboard!', 'success', 2000);
                });
            }
        };
    }

    // Download button
    const downloadBtn = document.getElementById('modal-download-btn');
    if (downloadBtn) {
        downloadBtn.onclick = async () => {
            const posterUrl = item.poster_path ? IMG_BIG + item.poster_path : '';
            if (!posterUrl) {
                showToast('Error', 'No image available to download.', 'error', 2000);
                return;
            }
            try {
                showToast('جاري التحضير', 'يتم تجهيز الصورة...', 'info', 2500);

                // Load the poster image via proxy to avoid CORS
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = posterUrl;
                });

                // Create canvas
                const BANNER_H = 90;
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight + BANNER_H;
                const ctx = canvas.getContext('2d');

                // Draw poster
                ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

                // Draw branded banner
                const grad = ctx.createLinearGradient(0, img.naturalHeight, 0, canvas.height);
                grad.addColorStop(0, '#0a0f1e');
                grad.addColorStop(1, '#10172a');
                ctx.fillStyle = grad;
                ctx.fillRect(0, img.naturalHeight, canvas.width, BANNER_H);

                // Red accent line
                ctx.fillStyle = '#e50914';
                ctx.fillRect(0, img.naturalHeight, canvas.width, 4);

                // CineNova logo text
                ctx.textAlign = 'left';
                ctx.font = `bold ${Math.round(canvas.width * 0.075)}px "Arial", sans-serif`;
                ctx.fillStyle = '#ffffff';
                ctx.fillText('Cine', Math.round(canvas.width * 0.05), img.naturalHeight + BANNER_H * 0.65);
                ctx.fillStyle = '#e50914';
                const cineW = ctx.measureText('Cine').width;
                ctx.fillText('Nova', Math.round(canvas.width * 0.05) + cineW, img.naturalHeight + BANNER_H * 0.65);

                // Website URL
                ctx.textAlign = 'right';
                ctx.font = `${Math.round(canvas.width * 0.038)}px "Arial", sans-serif`;
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.fillText('cinaa.netlify.app', canvas.width - Math.round(canvas.width * 0.05), img.naturalHeight + BANNER_H * 0.65);

                // Download
                const link = document.createElement('a');
                link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_cinenova.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                showToast('تم التحميل ✅', 'تم تحميل الصورة بنجاح!', 'success', 2500);
            } catch (error) {
                console.error("Download error:", error);
                // Fallback: direct download without branding
                try {
                    const res = await fetch(posterUrl);
                    const blob = await res.blob();
                    const bUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = bUrl;
                    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_poster.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(bUrl);
                    showToast('Downloaded', 'Image downloaded!', 'success', 2000);
                } catch { showToast('Error', 'Failed to download image.', 'error', 2000); }
            }
        };
    }


    document.getElementById('detail-modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Clear dynamic sections
    document.getElementById('modal-cast-section').innerHTML = '<div class="cast-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading cast...</div>';
    document.getElementById('modal-episodes-section').innerHTML = '';
    const similarSect = document.getElementById('modal-similar-section');
    if (similarSect) similarSect.innerHTML = '';

    // Fetch Cast
    const credits = await tmdb(isTV ? `/tv/${item.id}/credits` : `/movie/${item.id}/credits`);
    renderCast(credits?.cast || []);

    // Fetch Similar
    const similarData = await tmdb(isTV ? `/tv/${item.id}/similar` : `/movie/${item.id}/similar`);
    if (similarData?.results && similarSect) {
        renderSimilar(similarData.results.filter(r => r.poster_path).slice(0, 12));
    }

    // Fetch Seasons (TV only)
    if (isTV) {
        const details = await tmdb(`/tv/${item.id}`);
        renderSeasons(item, details);
    }
}

window.toggleHistory = function () {
    if (!activeItem) return;
    const inList = getHistory().some(h => h.id === activeItem.id && h.media_type === activeItem.media_type);
    if (inList) {
        removeFromHistory(activeItem);
        showToast('Removed', 'Removed from your list.', 'info', 2000);
    } else {
        addToHistory(activeItem);
        showToast('Added', 'Added to your list!', 'success', 2000);
    }
    openModal(activeItem);
};

function closeModal() {
    document.getElementById('detail-modal').classList.remove('active');
    document.body.style.overflow = '';
    clearInterval(backdropInterval);
}

// ── SERVER UI ────────────────────────────────────────────────
window.openServerSelector = function () {
    renderServerGrid();
    document.getElementById('server-modal').classList.add('active');
};

window.closeServerSelector = function () {
    document.getElementById('server-modal').classList.remove('active');
};

function renderServerGrid() {
    const grid = document.getElementById('server-grid');
    if (!grid) return;
    grid.innerHTML = PREMIUM_SERVERS.map((srv, i) => {
        let badgeIcon = 'fa-check';
        if (srv.status === 'untested') badgeIcon = 'fa-question';
        if (srv.status === 'unavailable') badgeIcon = 'fa-xmark';
        return `
            <div class="server-card ${i === activeServer ? 'active' : ''}" onclick="selectPremiumServer(${i})">
                <div class="sc-icon-wrap">
                    <i class="fa-solid ${srv.icon}"></i>
                    <div class="sc-badge ${srv.status}"><i class="fa-solid ${badgeIcon}"></i></div>
                </div>
                <div class="sc-name">${srv.name}</div>
                <div class="sc-status status-${srv.status}">${srv.status.toUpperCase()}</div>
            </div>
        `;
    }).join('');
}

window.selectPremiumServer = function (idx) {
    activeServer = idx;
    const sName = PREMIUM_SERVERS[idx].name;

    const modalText = document.getElementById('modal-current-server-text');
    if (modalText) modalText.innerText = 'Current: ' + sName;

    const playerText = document.getElementById('player-current-server-text');
    if (playerText) playerText.innerText = sName;

    closeServerSelector();
    showToast('Server Changed', `Switched to ${sName}`, 'info', 2000);

    if (!activeItem) return;
    saveWorkingServer();

    const isTV = activeItem.media_type === 'tv';
    const list = isTV ? SERVERS.tv : SERVERS.movie;
    const fn = list[activeServer] || list[0];
    const url = isTV ? fn(activeItem.id, currentPlaySeason, currentPlayEpisode) : fn(activeItem.id);
    
    const frame = document.getElementById('player-frame');
    if (frame && frame.src) frame.src = url;
};

// ── SIMILAR ──────────────────────────────────────────────────
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
            <img src="${photo}" alt="${escapeHtml(title)}" loading="lazy"
                 onerror="this.src='https://placehold.co/185x278/0b0e17/555?text=?'"
                 style="border-radius:12px; width:100px; height:150px;">
            <div class="cast-name">${escapeHtml(title)}</div>
        `;
        card.onclick = () => {
            if (!i.media_type) i.media_type = activeItem?.media_type || 'movie';
            document.querySelector('.modal-card')?.scrollTo({ top: 0, behavior: 'smooth' });
            openModal(i);
        };
        grid.appendChild(card);
    });

    sect.innerHTML = '<h3 class="modal-section-title"><i class="fa-solid fa-link"></i> You May Also Like</h3>';
    sect.appendChild(grid);
}

// ── PLAYER ───────────────────────────────────────────────────
function playItem(item, serverIdx = -1, season = 1, episode = 1) {
    if (!item) return;
    // Fix media_type if missing
    if (!item.media_type) item.media_type = item.first_air_date ? 'tv' : 'movie';

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

    const epLabel = isTV ? ` — S${season}:E${episode}` : '';
    document.getElementById('player-title').textContent = (item.title || item.name || '') + epLabel;

    const sName = PREMIUM_SERVERS[activeServer]?.name || 'Oxygen';
    const playerText = document.getElementById('player-current-server-text');
    if (playerText) playerText.innerText = sName;
    const modalText = document.getElementById('modal-current-server-text');
    if (modalText) modalText.innerText = 'Current: ' + sName;

    document.getElementById('player-frame').src = url;
    document.getElementById('player-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';

    document.getElementById('ep-nav').style.display = isTV ? 'flex' : 'none';
    tryLockLandscape();
    checkAndShowPrediction(item);
}

// ── ORIENTATION LOCK ─────────────────────────────────────────
async function tryLockLandscape() {
    try { if (screen.orientation?.lock) await screen.orientation.lock('landscape'); } catch { }
}
async function tryUnlockOrientation() {
    try { if (screen.orientation?.unlock) screen.orientation.unlock(); } catch { }
}

function saveWorkingServer() {
    if (activeItem) setLastServer(activeItem.id, activeServer);
}

// ── PREDICTION OVERLAY ──────────────────────────────────────
function checkAndShowPrediction(item) {
    const wrap = document.getElementById('prediction-wrap');
    if (!wrap) return;
    wrap.classList.remove('active');
    clearTimeout(predictionTimeout);

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
        }, 10000);
    }
}

// ── CAST RENDERER ────────────────────────────────────────────
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
                    : `https://placehold.co/185x278/0b0e17/555?text=${encodeURIComponent(actor.name.split(' ')[0])}`;
                return `
                <div class="cast-card">
                    <img src="${photo}" alt="${escapeHtml(actor.name)}" loading="lazy"
                         onerror="this.src='https://placehold.co/185x278/0b0e17/555?text=?'">
                    <div class="cast-name">${escapeHtml(actor.name)}</div>
                    <div class="cast-char">${escapeHtml(actor.character || '')}</div>
                </div>`;
            }).join('')}
        </div>
    `;
}

// ── SEASONS & EPISODES ───────────────────────────────────────
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
                    <span class="season-ep-count">${s.episode_count} eps</span>
                </button>
            `).join('')}
        </div>
        <div class="episodes-grid" id="episodes-grid">
            <div class="cast-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading episodes...</div>
        </div>
    `;

    loadEpisodes(item.id, 1, document.querySelector('.season-tab'));
}

window.loadEpisodes = async function (seriesId, seasonNum, btnEl) {
    activeSeason = seasonNum;
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
            : `https://placehold.co/300x169/0b0e17/555?text=Ep+${ep.episode_number}`;
        return `
        <div class="episode-card" onclick="playItem(activeItem, activeServer, ${seasonNum}, ${ep.episode_number})">
            <div class="ep-thumb-wrap">
                <img src="${thumb}" alt="Episode ${ep.episode_number}" loading="lazy"
                     onerror="this.src='https://placehold.co/300x169/0b0e17/555?text=Ep+${ep.episode_number}'">
                <div class="ep-play-overlay"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="ep-info">
                <span class="ep-num">Episode ${ep.episode_number}</span>
                <span class="ep-title">${escapeHtml(ep.name || '')}</span>
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

// ── EPISODE NAVIGATION ──────────────────────────────────────
window.playNextEpisode = async function () {
    if (!activeItem || activeItem.media_type !== 'tv') return;
    document.getElementById('next-ep-btn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const seasonData = await tmdb(`/tv/${activeItem.id}/season/${currentPlaySeason}`);
    const epsCount = seasonData?.episodes?.length || 0;

    if (currentPlayEpisode < epsCount) {
        playItem(activeItem, activeServer, currentPlaySeason, currentPlayEpisode + 1);
        showToast('Next Episode', `Playing S${currentPlaySeason}:E${currentPlayEpisode + 1}`, 'info', 2000);
    } else {
        const nextSeasonData = await tmdb(`/tv/${activeItem.id}/season/${currentPlaySeason + 1}`);
        if (nextSeasonData?.episodes?.length > 0) {
            playItem(activeItem, activeServer, currentPlaySeason + 1, 1);
            showToast('Next Season', `Playing Season ${currentPlaySeason + 1}`, 'success', 2000);
        } else {
            showToast('End', 'You have reached the last available episode.', 'warning', 3000);
        }
    }
    document.getElementById('next-ep-btn').innerHTML = 'Next <i class="fa-solid fa-forward-step"></i>';
};

window.playPrevEpisode = async function () {
    if (!activeItem || activeItem.media_type !== 'tv') return;
    document.getElementById('prev-ep-btn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    if (currentPlayEpisode > 1) {
        playItem(activeItem, activeServer, currentPlaySeason, currentPlayEpisode - 1);
    } else if (currentPlaySeason > 1) {
        const prevSeasonData = await tmdb(`/tv/${activeItem.id}/season/${currentPlaySeason - 1}`);
        if (prevSeasonData?.episodes) {
            playItem(activeItem, activeServer, currentPlaySeason - 1, prevSeasonData.episodes.length);
        }
    }
    document.getElementById('prev-ep-btn').innerHTML = '<i class="fa-solid fa-backward-step"></i> Prev';
};

// ── SEARCH ───────────────────────────────────────────────────
function setupSearch() {
    const trigger = document.getElementById('search-trigger');
    const overlay = document.getElementById('search-overlay');
    const closeBtn = document.getElementById('close-search');
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    const runSearch = () => {
        const q = input.value.trim();
        results.innerHTML = '<p class="search-hint"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</p>';
        doSearch(q, results);
    };

    trigger.addEventListener('click', () => { overlay.classList.add('active'); setTimeout(() => input.focus(), 100); });
    closeBtn.addEventListener('click', () => { overlay.classList.remove('active'); input.value = ''; results.innerHTML = '<p class="search-hint">Type to search millions of titles...</p>'; });

    input.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = input.value.trim();
        if (!q && !document.getElementById('filter-genre').value) {
            results.innerHTML = '<p class="search-hint">Type to search millions of titles...</p>';
            return;
        }
        results.innerHTML = '<p class="search-hint"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</p>';
        searchTimer = setTimeout(runSearch, 400);
    });

    document.querySelectorAll('.filter-select').forEach(sel => {
        sel.addEventListener('change', () => {
            if (input.value.trim() || document.getElementById('filter-genre').value) runSearch();
        });
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) closeBtn.click(); });

    // Voice Search
    const voiceBtn = document.getElementById('voice-search-btn');
    if (voiceBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        voiceBtn.addEventListener('click', () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.lang = 'ar-SA';
            recognition.interimResults = false;
            voiceBtn.classList.add('listening');
            showToast('Voice Search', 'Listening... speak now', 'info', 2000);
            recognition.start();
            recognition.onresult = (e) => {
                const transcript = e.results[0][0].transcript;
                input.value = transcript;
                runSearch();
                voiceBtn.classList.remove('listening');
            };
            recognition.onerror = () => {
                voiceBtn.classList.remove('listening');
                showToast('Voice Error', 'Could not understand. Try again.', 'error', 2000);
            };
            recognition.onend = () => voiceBtn.classList.remove('listening');
        });
    } else if (voiceBtn) {
        voiceBtn.style.display = 'none';
    }
}

async function doSearch(q, container) {
    const fType = document.getElementById('filter-type')?.value || 'multi';
    const fGenre = document.getElementById('filter-genre')?.value || '';
    const fSort = document.getElementById('filter-sort')?.value || 'popularity.desc';
    const fYear = document.getElementById('filter-year')?.value || '';

    let json;

    if (q) {
        const endpoint = fType === 'multi' ? '/search/multi' : (fType === 'movie' ? '/search/movie' : '/search/tv');
        json = await tmdb(endpoint, { query: q, include_adult: false });
        if (json?.results && fGenre) {
            json.results = json.results.filter(i => i.genre_ids?.includes(parseInt(fGenre)));
        }
        if (json?.results && fYear) {
            json.results = json.results.filter(i => {
                const d = i.release_date || i.first_air_date || '';
                return d.startsWith(fYear);
            });
        }
        if (json?.results && fSort.includes('vote_average')) {
            json.results.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } else if (json?.results && fSort.includes('primary_release_date')) {
            json.results.sort((a, b) => new Date(b.release_date || b.first_air_date || 0) - new Date(a.release_date || a.first_air_date || 0));
        }
    } else {
        const endpoint = fType === 'movie' || fType === 'multi' ? '/discover/movie' : '/discover/tv';
        let params = { sort_by: fSort };
        if (fGenre) params.with_genres = fGenre;
        if (fYear) params.primary_release_year = fYear;
        json = await tmdb(endpoint, params);
        if (fType === 'multi') {
            let tvJson = await tmdb('/discover/tv', params);
            if (tvJson?.results) {
                json.results = [...(json.results || []), ...tvJson.results];
                if (fSort.includes('popularity')) json.results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            }
        }
    }

    if (!json?.results?.length) {
        container.innerHTML = '<p class="search-hint"><i class="fa-solid fa-face-sad-tear"></i> No results found. Try different filters.</p>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'search-grid';

    json.results.filter(i => i.poster_path && (i.media_type === 'movie' || i.media_type === 'tv' || fType !== 'multi'))
        .slice(0, 80)
        .forEach(item => {
            if (!item.media_type) item.media_type = fType === 'tv' ? 'tv' : 'movie'; // BUG FIX
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

// ── SLIDER SCROLL ────────────────────────────────────────────
window.slideRow = function (sliderId, dir) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;
    const amount = Math.min(slider.clientWidth * 0.8, 800);
    slider.scrollBy({ left: dir * amount, behavior: 'smooth' });
};

// ── NAVIGATION ───────────────────────────────────────────────
function setupNav() {
    initLanguageUI();
    const allNavBtns = [...document.querySelectorAll('.nav-btn'), ...document.querySelectorAll('.mobile-nav-item[data-page]')];

    allNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            if (!page) return;

            // Sync active states across desktop + mobile nav
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll(`[data-page="${page}"]`).forEach(b => b.classList.add('active'));

            const main = document.getElementById('main-content');
            const reelsSec = document.getElementById('section-reels');
            const hero = document.getElementById('hero');

            if (page === 'reels') {
                main.style.display = 'none';
                reelsSec.style.display = 'block';
                if (hero) hero.style.display = 'none';
                loadReels();
            } else {
                main.style.display = '';
                reelsSec.style.display = 'none';

                if (page === 'home') {
                    if (hero) hero.style.display = '';
                    showHomePage();
                } else {
                    if (hero) hero.style.display = 'none';
                    if (page === 'movies') showCategoryPage('movies', 'Movies', '/discover/movie', { sort_by: 'popularity.desc' });
                    else if (page === 'series') showCategoryPage('series', 'Series', '/discover/tv', { sort_by: 'popularity.desc' });
                    else if (page === 'anime') showCategoryPage('anime', 'Anime', '/discover/tv', { with_genres: 16, with_original_language: 'ja', sort_by: 'popularity.desc' });
                    else if (page === 'asian') showCategoryPage('asian', 'Asian Cinema', '/discover/movie', { with_original_language: 'zh|ja|ko', sort_by: 'vote_average.desc', 'vote_count.gte': 500 });
                    else if (page === 'mylist') showMyList();
                }
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
        ${makeSection('section-trending', 'slider-trending', 'fa-fire', 'Trending This Week')}
        ${makeSection('section-new', 'slider-new', 'fa-star', 'New Releases')}
        ${makeSection('section-top', 'slider-top', 'fa-trophy', 'Top Rated')}
        ${makeSection('section-series', 'slider-series', 'fa-tv', 'Popular Series')}
        ${makeSection('section-mentalist', 'slider-mentalist', 'fa-magnifying-glass', 'The Mentalist')}
        ${makeSection('section-anime', 'slider-anime', 'fa-dragon', 'Anime')}
        ${makeSection('section-asian', 'slider-asian', 'fa-torii-gate', 'Asian Cinema')}
        ${makeSection('section-action', 'slider-action', 'fa-bolt', 'Action & Adventure')}
        ${makeSection('section-scifi', 'slider-scifi', 'fa-rocket', 'Sci-Fi')}
        ${makeSection('section-horror', 'slider-horror', 'fa-ghost', 'Horror')}
        ${makeSection('section-comedy', 'slider-comedy', 'fa-face-laugh', 'Comedy')}
        ${makeSection('section-romance', 'slider-romance', 'fa-heart', 'Romance')}
        ${makeSection('section-documentary', 'slider-documentary', 'fa-earth-americas', 'Documentaries')}
        ${makeSection('section-mystery', 'slider-mystery', 'fa-mask', 'Mystery & Crime')}
        ${makeSection('section-family', 'slider-family', 'fa-child', 'Family & Kids')}
        ${makeSection('section-korean', 'slider-korean', 'fa-music', 'Korean Drama')}
    `;

    renderHistoryRow();

    // Lazy load sections for massive performance boost
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                const p = window._sliderParams[id];
                if (p) {
                    renderRow(p.id, p.endpoint, p.params);
                    obs.unobserve(entry.target);
                }
            }
        });
    }, { rootMargin: '300px' });

    window._sliderParams = {
        'section-trending': { id: 'slider-trending', endpoint: '/trending/all/week', params: {} },
        'section-new': { id: 'slider-new', endpoint: '/movie/now_playing', params: {} },
        'section-top': { id: 'slider-top', endpoint: '/movie/top_rated', params: {} },
        'section-series': { id: 'slider-series', endpoint: '/tv/popular', params: {} },
        'section-mentalist': { id: 'slider-mentalist', endpoint: '/search/tv', params: { query: 'The Mentalist' } },
        'section-anime': { id: 'slider-anime', endpoint: '/discover/tv', params: { with_genres: 16, with_original_language: 'ja', sort_by: 'popularity.desc' } },
        'section-asian': { id: 'slider-asian', endpoint: '/discover/movie', params: { with_original_language: 'zh|ja|ko', sort_by: 'vote_average.desc', 'vote_count.gte': 200 } },
        'section-action': { id: 'slider-action', endpoint: '/discover/movie', params: { with_genres: '28,12', sort_by: 'popularity.desc' } },
        'section-scifi': { id: 'slider-scifi', endpoint: '/discover/movie', params: { with_genres: 878, sort_by: 'popularity.desc' } },
        'section-horror': { id: 'slider-horror', endpoint: '/discover/movie', params: { with_genres: 27, sort_by: 'popularity.desc' } },
        'section-comedy': { id: 'slider-comedy', endpoint: '/discover/movie', params: { with_genres: 35, sort_by: 'popularity.desc' } },
        'section-romance': { id: 'slider-romance', endpoint: '/discover/movie', params: { with_genres: 10749, sort_by: 'popularity.desc' } },
        'section-documentary': { id: 'slider-documentary', endpoint: '/discover/movie', params: { with_genres: 99, sort_by: 'popularity.desc' } },
        'section-mystery': { id: 'slider-mystery', endpoint: '/discover/movie', params: { with_genres: '9648,80', sort_by: 'popularity.desc' } },
        'section-family': { id: 'slider-family', endpoint: '/discover/movie', params: { with_genres: 10751, sort_by: 'popularity.desc' } },
        'section-korean': { id: 'slider-korean', endpoint: '/discover/tv', params: { with_original_language: 'ko', sort_by: 'popularity.desc' } }
    };

    Object.keys(window._sliderParams).forEach(sectionId => {
        const el = document.getElementById(sectionId);
        if (el) observer.observe(el);
    });
}

// ── REELS ────────────────────────────────────────────────────
window.reelsDataMap = {};
async function loadReels() {
    const container = document.getElementById('reels-container');
    if (container.dataset.loaded) return;
    container.innerHTML = '<div style="text-align: center; margin-top: 100px; color: var(--accent);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Finding Trailers...</div>';

    const data = await tmdb('/movie/popular', { page: 1 });
    if (!data?.results?.length) return;

    let reelsHtml = '';
    for (const m of data.results.slice(0, 15)) {
        const vids = await tmdb(`/movie/${m.id}/videos`);
        const trailer = vids?.results?.find(v => v.type === 'Trailer') || vids?.results?.[0];
        if (trailer && trailer.site === 'YouTube') {
            window.reelsDataMap[m.id] = m;
            reelsHtml += `
            <div class="reel-item">
                <div class="reel-video-container">
                    <div id="yt-player-${m.id}" data-vid="${escapeHtml(trailer.key)}" class="yt-player-placeholder"></div>
                </div>
                <div class="reel-overlay">
                    <h2 class="reel-title">${escapeHtml(m.title || m.name)}</h2>
                    <p class="reel-desc">${escapeHtml(m.overview)}</p>
                    <button class="reel-btn" onclick="openModal(window.reelsDataMap[${m.id}])">
                        <i class="fa-solid fa-play"></i> Let's Watch
                    </button>
                </div>
            </div>`;
        }
    }

    container.innerHTML = reelsHtml || '<div style="text-align: center; margin-top: 100px; color: #fff;">No trailers found.</div>';
    if (reelsHtml) {
        container.dataset.loaded = 'true';
        setTimeout(() => {
            if (window.YT && window.YT.Player) {
                document.querySelectorAll('.yt-player-placeholder').forEach(el => {
                    new YT.Player(el.id, {
                        videoId: el.dataset.vid,
                        playerVars: { 'autoplay': 1, 'mute': 1, 'controls': 0, 'modestbranding': 1, 'rel': 0, 'playsinline': 1, 'origin': window.location.origin },
                        events: {
                            'onError': function(event) {
                                const iframe = event.target.getIframe();
                                if (iframe) {
                                    const reelItem = iframe.closest('.reel-item');
                                    if (reelItem) reelItem.remove(); // Remove restricted trailer automatically
                                }
                            },
                            'onReady': function(event) {
                                event.target.playVideo();
                            }
                        }
                    });
                });
            }
        }, 500);
    }
}

function makeSection(sectionId, sliderId, icon, title) {
    return `
    <section class="content-section" id="${sectionId}">
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

// ── CATEGORY PAGE ────────────────────────────────────────────
async function showCategoryPage(id, title, endpoint, params) {
    categoryPage = 1; categoryLoading = false;
    currentEndpoint = endpoint; currentParams = params;

    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="page-header">
            <h1>${title}</h1>
            <p>Browse millions of titles</p>
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
                <p>Your list is empty. Start watching and items will appear here!</p>
            </div>`;
        return;
    }

    main.innerHTML = `
        <div class="page-header">
            <h1>My List</h1>
            <p>${hist.length} items · Saved on your device</p>
        </div>
        <div class="content-grid" id="my-list-grid"></div>
    `;

    const grid = document.getElementById('my-list-grid');
    hist.forEach(item => { const card = makeCard(item); card.style.width = ''; grid.appendChild(card); });
}

// ── SURPRISE ME (Random Movie) ───────────────────────────────
function setupSurpriseMe() {
    const btn = document.getElementById('surprise-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finding...';
        const randomPage = Math.floor(Math.random() * 20) + 1;
        const json = await tmdb('/discover/movie', { sort_by: 'popularity.desc', page: randomPage });
        if (json?.results?.length) {
            const randomIdx = Math.floor(Math.random() * json.results.length);
            const item = json.results[randomIdx];
            item.media_type = 'movie';
            openModal(item);
            showToast('Surprise!', `How about "${item.title}"?`, 'success', 3000);
        }
        btn.innerHTML = '<i class="fa-solid fa-shuffle"></i> Surprise Me';
    });
}

// ── SCROLL TO TOP ────────────────────────────────────────────
function setupScrollToTop() {
    const btn = document.getElementById('scroll-top-btn');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── NETWORK STATUS ───────────────────────────────────────────
function setupNetworkStatus() {
    const bar = document.getElementById('network-bar');
    if (!bar) return;
    window.addEventListener('offline', () => {
        bar.classList.add('visible');
        showToast('Offline', 'You are disconnected from the internet.', 'error');
    });
    window.addEventListener('online', () => {
        bar.classList.remove('visible');
        showToast('Online', 'Connection restored!', 'success', 2000);
    });
}

// ── KEYBOARD SHORTCUTS ───────────────────────────────────────
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        const playerActive = document.getElementById('player-overlay')?.classList.contains('active');

        if (e.key === 'Escape') {
            closePlayer(); closeModal(); closeServerSelector();
            document.getElementById('search-overlay')?.classList.remove('active');
        }

        if (playerActive) {
            if (e.key === 'ArrowRight' && activeItem?.media_type === 'tv') {
                e.preventDefault();
                window.playNextEpisode();
                showShortcutHint('Next Episode →');
            }
            if (e.key === 'ArrowLeft' && activeItem?.media_type === 'tv') {
                e.preventDefault();
                window.playPrevEpisode();
                showShortcutHint('← Previous Episode');
            }
            if (e.key === 'f' || e.key === 'F') {
                const frame = document.getElementById('player-frame');
                if (frame?.requestFullscreen) frame.requestFullscreen();
                showShortcutHint('Fullscreen');
            }
        }

        // Global shortcuts
        if (e.key === '/' && !e.ctrlKey && !playerActive) {
            e.preventDefault();
            document.getElementById('search-trigger')?.click();
        }
        if (e.code === 'Space' && playerActive) {
            e.preventDefault();
            document.getElementById('player-frame')?.focus();
        }
    });
}

function showShortcutHint(text) {
    const hint = document.getElementById('shortcut-hint');
    if (!hint) return;
    hint.textContent = text;
    hint.classList.add('visible');
    setTimeout(() => hint.classList.remove('visible'), 1200);
}

// ── NAVBAR SCROLL ────────────────────────────────────────────
function setupNavbarScroll() {
    window.addEventListener('scroll', () => {
        document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
}

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

// ── EVENT LISTENERS ──────────────────────────────────────────
document.getElementById('close-modal')?.addEventListener('click', closeModal);
document.getElementById('close-player')?.addEventListener('click', closePlayer);
document.getElementById('detail-modal')?.addEventListener('click', e => { if (e.target.id === 'detail-modal') closeModal(); });

// ── INLINE TRAILER PLAYER ────────────────────────────────────
window.openInlineTrailer = function (youtubeKey, title) {
    // Remove existing trailer modal if any
    const existing = document.getElementById('trailer-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'trailer-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease';
    modal.innerHTML = `
        <div style="position:relative;width:min(90vw,900px);aspect-ratio:16/9;border-radius:16px;overflow:hidden;box-shadow:0 0 80px rgba(229,9,20,0.4)">
            <iframe
                src="https://www.youtube.com/embed/${encodeURIComponent(youtubeKey)}?autoplay=1&rel=0&modestbranding=1"
                allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
                allowfullscreen
                style="width:100%;height:100%;border:none"
            ></iframe>
            <button onclick="document.getElementById('trailer-modal').remove()" 
                style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:50%;width:40px;height:40px;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s" 
                onmouseover="this.style.background='rgba(229,9,20,0.8)'" 
                onmouseout="this.style.background='rgba(0,0,0,0.7)'">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
};

// ── CHECK FOR APP UPDATES ─────────────────────────────────────
async function checkForAppUpdate() {
    const savedVer = localStorage.getItem('cn_app_version');
    if (savedVer && savedVer !== APP_VERSION) {
        showUpdateBanner();
    } else if (!savedVer) {
        localStorage.setItem('cn_app_version', APP_VERSION);
    }

    if (!navigator.serviceWorker) return;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
            reg.addEventListener('updatefound', () => {
                const newSW = reg.installing;
                newSW?.addEventListener('statechange', () => {
                    if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner();
                    }
                });
            });
            reg.update().catch(() => {});
        }
    } catch { }
}

function showUpdateBanner() {
    const existing = document.getElementById('update-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:linear-gradient(135deg,#1a1f35,#0d1226);border:1px solid rgba(229,9,20,0.4);backdrop-filter:blur(20px);border-radius:16px;padding:14px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 40px rgba(0,0,0,0.6),0 0 20px rgba(229,9,20,0.15);animation:fadeSlideUp 0.4s ease';
    banner.innerHTML = `
        <i class="fa-solid fa-rotate" style="color:#e50914"></i>
        <span style="color:#f1f1f5;font-size:0.9rem">يتوفر تحديث جديد للموقع!</span>
        <button onclick="localStorage.setItem('cn_app_version', APP_VERSION); window.location.reload(true);" style="background:linear-gradient(135deg,#e50914,#ff4757);color:#fff;border:none;border-radius:10px;padding:8px 16px;cursor:pointer;font-weight:600;font-size:0.85rem">تحديث الآن</button>
        <button onclick="this.closest('#update-banner').remove()" style="background:transparent;border:none;color:#a0a3b1;cursor:pointer;padding:4px"><i class="fa-solid fa-xmark"></i></button>
    `;
    document.body.appendChild(banner);
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    setupNav();
    setupSearch();
    setupSurpriseMe();
    setupScrollToTop();
    setupNetworkStatus();
    setupKeyboardShortcuts();
    setupNavbarScroll();
    updateListBadge();
    setupPushNotifications();
    checkForAppUpdate();

    // Register / update service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const loading = document.getElementById('loading-screen');
    if (loading) {
        setTimeout(() => {
            loading.classList.add('hidden');
            setTimeout(() => loading.remove(), 600);
        }, 1400);
    }

    await loadHero();
    showHomePage();

    showToast('Welcome to CineNova v4.0', 'Enjoy movies, series & anime! 🎬✨', 'success', 3500);
});
