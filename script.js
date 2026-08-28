// ===========================================
// BREAD & SONION CINEMA - COMPLETE ENGINE
// ===========================================

// ===== CONFIGURATION =====
const CONFIG = {
    TMDB_API_KEY: '041bc4d8a9581efb70ce1f1d6816d519',
    TMDB_BASE_URL: 'https://corsproxy.io/?https://api.themoviedb.org/3',
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p/w500',
    TMDB_BACKDROP_BASE: 'https://image.tmdb.org/t/p/original',
    CORS_PROXIES: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/'
    ],
    STREAM_SERVERS: [
        { name: 'VidCloud', base: 'https://vidcloud.stream/embed' },
        { name: '2Embed', base: 'https://2embed.cc/embed' },
        { name: 'GDrive', base: 'https://gdriveplayer.io/embed2.php' },
        { name: 'StreamWish', base: 'https://streamwish.com/e' },
    ]
};

// ===== STATE =====
let currentMovies = [];
let selectedMovieId = null;
let currentStreamUrl = '';

// ===== DOM REFS =====
const $ = (id) => document.getElementById(id);
const movieGrid = $('movieGrid');
const loadingSpinner = $('loadingSpinner');
const errorMessage = $('errorMessage');
const errorText = $('errorText');
const searchInput = $('searchInput');
const searchBtn = $('searchBtn');
const homeBtn = $('homeBtn');
const detailModal = $('detailModal');
const detailContent = $('detailContent');
const playerModal = $('playerModal');
const videoPlayer = $('videoPlayer');

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadTrending();
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    homeBtn.addEventListener('click', () => {
        searchInput.value = '';
        loadTrending();
    });
});

// ===== API CALLS =====
async function fetchFromTMDB(endpoint, params = {}) {
    const url = new URL(`${CONFIG.TMDB_BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', CONFIG.TMDB_API_KEY);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`);
    return response.json();
}

async function loadTrending() {
    showLoading(true);
    hideError();
    try {
        const data = await fetchFromTMDB('/trending/movie/week', { page: 1 });
        currentMovies = data.results.map(m => ({
            id: m.id,
            title: m.title,
            overview: m.overview || 'No description available.',
            posterPath: m.poster_path,
            backdropPath: m.backdrop_path,
            rating: m.vote_average || 0,
            releaseDate: m.release_date || 'N/A',
            year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
        }));
        renderMovies(currentMovies);
    } catch (err) {
        showError('Failed to load trending movies. Please check your API key and internet connection.');
        console.error(err);
    }
    showLoading(false);
}

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    showLoading(true);
    hideError();
    try {
        const data = await fetchFromTMDB('/search/movie', { query, page: 1 });
        currentMovies = data.results.map(m => ({
            id: m.id,
            title: m.title,
            overview: m.overview || 'No description available.',
            posterPath: m.poster_path,
            backdropPath: m.backdrop_path,
            rating: m.vote_average || 0,
            releaseDate: m.release_date || 'N/A',
            year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
        }));
        renderMovies(currentMovies);
        if (currentMovies.length === 0) {
            showError('No movies found. Try a different search term.');
        }
    } catch (err) {
        showError('Search failed. Please try again.');
        console.error(err);
    }
    showLoading(false);
}

// ===== RENDER MOVIES =====
function renderMovies(movies) {
    if (!movies || movies.length === 0) {
        movieGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.3); font-size: 18px;">No movies to display.</div>`;
        return;
    }
    movieGrid.innerHTML = movies.map(m => `
        <div class="movie-card" data-id="${m.id}" onclick="openDetail(${m.id})">
            <img class="movie-card-poster" 
                 src="${m.posterPath ? CONFIG.TMDB_IMAGE_BASE + m.posterPath : 'https://via.placeholder.com/200x300/1a1a1a/666?text=No+Poster'}" 
                 alt="${m.title}" 
                 loading="lazy"
                 onerror="this.src='https://via.placeholder.com/200x300/1a1a1a/666?text=Error'">
            <div class="movie-card-info">
                <div class="movie-card-title">${m.title}</div>
                <div class="movie-card-meta">
                    <span class="movie-card-rating">⭐ ${m.rating.toFixed(1)}</span>
                    <span class="movie-card-year">${m.year}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== DETAIL MODAL =====
async function openDetail(movieId) {
    selectedMovieId = movieId;
    const movie = currentMovies.find(m => m.id === movieId);
    if (!movie) return;

    detailContent.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: rgba(255,255,255,0.3);">
            <div class="spinner" style="margin: 0 auto 16px;"></div>
            Loading details...
        </div>
    `;
    detailModal.style.display = 'flex';

    try {
        const data = await fetchFromTMDB(`/movie/${movieId}`, { append_to_response: 'videos,credits' });
        
        const backdropUrl = data.backdrop_path ? CONFIG.TMDB_BACKDROP_BASE + data.backdrop_path : '';
        const posterUrl = data.poster_path ? CONFIG.TMDB_IMAGE_BASE + data.poster_path : '';
        const genres = data.genres ? data.genres.map(g => g.name).join(' • ') : '';
        const runtime = data.runtime ? `${data.runtime} min` : '';
        const cast = data.credits?.cast?.slice(0, 8) || [];

        const streamSources = generateStreamSources(movie.title, movie.year);

        detailContent.innerHTML = `
            ${backdropUrl ? `<img class="detail-backdrop" src="${backdropUrl}" alt="${data.title}" onerror="this.style.display='none'">` : ''}
            <h1 class="detail-title">${data.title}</h1>
            <div class="detail-meta">
                <span class="detail-rating">⭐ ${data.vote_average?.toFixed(1) || 'N/A'}</span>
                <span>${data.release_date || 'N/A'}</span>
                ${runtime ? `<span>${runtime}</span>` : ''}
                ${genres ? `<span>${genres}</span>` : ''}
            </div>
            <p class="detail-overview">${data.overview || 'No overview available.'}</p>
            
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px;">
                <button class="detail-stream-btn" onclick="findAndPlayStream('${movie.title}', '${movie.year}')">
                    ▶ Watch Now (Free)
                </button>
                <span style="color: rgba(255,255,255,0.3); font-size: 13px;">or select a source below</span>
            </div>
            
            <div class="detail-stream-sources" id="streamSources">
                ${streamSources.map((s, i) => `
                    <button class="stream-source-btn" onclick="playStream('${s.url}', '${s.server} - ${s.quality}')">
                        ${s.server} (${s.quality})
                    </button>
                `).join('')}
            </div>
            
            ${cast.length ? `
                <div style="margin-top: 24px;">
                    <h3 style="font-size: 16px; margin-bottom: 12px; color: rgba(255,255,255,0.7);">Cast</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                        ${cast.map(actor => `
                            <div style="text-align: center; width: 70px;">
                                <img src="${actor.profile_path ? CONFIG.TMDB_IMAGE_BASE + actor.profile_path : 'https://via.placeholder.com/70x70/1a1a1a/666?text=?'}" 
                                     style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; background: #1a1a1a;" 
                                     onerror="this.src='https://via.placeholder.com/70x70/1a1a1a/666?text=?'">
                                <div style="font-size: 11px; margin-top: 4px; color: rgba(255,255,255,0.5); line-height: 1.2;">${actor.name}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    } catch (err) {
        detailContent.innerHTML = `
            <div style="text-align: center; padding: 40px 0; color: rgba(255,255,255,0.5);">
                <p>Failed to load details. Please try again.</p>
                <button onclick="openDetail(${movieId})" style="margin-top: 12px; background: #e50914; border: none; color: #fff; padding: 8px 24px; border-radius: 20px; cursor: pointer;">Retry</button>
            </div>
        `;
        console.error(err);
    }
}

function closeDetail() {
    detailModal.style.display = 'none';
}

// ===== STREAM SOURCE GENERATOR =====
function generateStreamSources(title, year) {
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    const sources = [];
    const qualities = ['720p', '1080p'];
    const servers = CONFIG.STREAM_SERVERS;
    
    servers.forEach((server, idx) => {
        const quality = qualities[idx % qualities.length];
        let url;
        switch (server.name) {
            case 'VidCloud':
                url = `${server.base}/${slug}-${year}?quality=${quality}`;
                break;
            case '2Embed':
                url = `${server.base}/?url=https://www.youtube.com/watch?v=placeholder&quality=${quality}`;
                break;
            case 'GDrive':
                url = `${server.base}/?id=placeholder&quality=${quality}`;
                break;
            default:
                url = `${server.base}/${slug}-${year}.m3u8?quality=${quality}`;
        }
        sources.push({
            server: server.name,
            quality: quality,
            url: url
        });
    });
    return sources;
}

// ===== PLAY STREAM =====
function playStream(url, label = 'Stream') {
    if (!url) {
        alert('No stream URL available. Please try another source.');
        return;
    }
    currentStreamUrl = url;
    videoPlayer.src = url;
    videoPlayer.load();
    playerModal.style.display = 'flex';
    videoPlayer.play().catch(() => {});
}

async function findAndPlayStream(title, year) {
    const streamContainer = document.getElementById('streamSources');
    if (streamContainer) {
        streamContainer.innerHTML = `<span style="color: rgba(255,255,255,0.3); font-size: 13px;">Searching for streams...</span>`;
    }
    try {
        const sources = generateStreamSources(title, year);
        for (const source of sources) {
            try {
                playStream(source.url, `${source.server} - ${source.quality}`);
                return;
            } catch (e) {
                // Continue to next
            }
        }
        const fallbackUrl = `${CONFIG.CORS_PROXIES[0]}https://embed.su/embed/${title.toLowerCase().replace(/\s+/g, '-')}-${year || '2024'}`;
        playStream(fallbackUrl, 'Fallback Source');
    } catch (err) {
        alert('Failed to find a stream. Please try another movie or source.');
        console.error(err);
        const updatedSources = generateStreamSources(title, year);
        if (document.getElementById('streamSources')) {
            document.getElementById('streamSources').innerHTML = updatedSources.map(s => `
                <button class="stream-source-btn" onclick="playStream('${s.url}', '${s.server} - ${s.quality}')">
                    ${s.server} (${s.quality})
                </button>
            `).join('');
        }
    }
}

function closePlayer() {
    playerModal.style.display = 'none';
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.load();
}

// ===== UTILITY FUNCTIONS =====
function showLoading(show) {
    loadingSpinner.style.display = show ? 'block' : 'none';
}

function showError(msg) {
    errorMessage.style.display = 'block';
    errorText.textContent = msg;
}

function hideError() {
    errorMessage.style.display = 'none';
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (playerModal.style.display === 'flex') closePlayer();
        else if (detailModal.style.display === 'flex') closeDetail();
    }
});

// ===== CLOSE MODALS ON BACKDROP CLICK =====
detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetail();
});
playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayer();
});

// ===== SERVICE WORKER REGISTRATION (PWA) =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('Service Worker registered.'))
        .catch(() => console.log('Service Worker registration failed.'));
}

console.log('🍿 Bread & Sonion Cinema loaded successfully.');
console.log('🧠 Engine built by the God of Coding, Bread (1945-present).');