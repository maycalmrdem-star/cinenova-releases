const fs = require('fs');

let content = fs.readFileSync('script.js.backup', 'utf8');

// 1. Remove hardcoded movies array
const arrayEndIndex = content.indexOf('// DOM Elements');
if (arrayEndIndex > -1) {
    content = `let movies = [];
let historyList = JSON.parse(localStorage.getItem('cinenova_history')) || [];

` + content.substring(arrayEndIndex);
}

// 2. Replace DOMContentLoaded
const domLoadRegex = /document\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/m;
content = content.replace(domLoadRegex, `document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('data.json');
        movies = await response.json();
    } catch (error) {
        console.error('Error loading movies:', error);
    }

$1
});`);

// 3. Add History Render to initializeApp
const initAppRegex = /function initializeApp\(filterValues = null\) \{([\s\S]*?)renderHero\(currentMovies\[0\]\);/m;
content = content.replace(initAppRegex, `function initializeApp(filterValues = null) {$1renderHero(currentMovies[0]);\n\n    renderHistoryRow();\n`);

// 4. Add save to history in loadVideoContent (the core player function)
const loadVideoRegex = /function loadVideoContent\(\) \{([\s\S]*?)let embedUrl;/m;
content = content.replace(loadVideoRegex, `function loadVideoContent() {
    // Save to history
    if (activeTmdbId) {
        const movieObj = movies.find(m => m.tmdbId === activeTmdbId);
        if (movieObj) {
            historyList = historyList.filter(m => m.id !== movieObj.id);
            historyList.unshift(movieObj);
            if (historyList.length > 20) historyList.pop();
            localStorage.setItem('cinenova_history', JSON.stringify(historyList));
        }
    }
$1let embedUrl;`);

// 5. Add History Render function and update the "My List" nav button logic
content += `

// History Render Logic
function renderHistoryRow() {
    const historySlider = document.getElementById('history-slider');
    const historySection = document.getElementById('history-section');
    
    if (!historySlider) return;

    if (historyList.length === 0) {
        historySection.style.display = 'none';
    } else {
        historySection.style.display = 'block';
        historySlider.innerHTML = '';
        historyList.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'movie-card history-card';
            card.onclick = () => openModal(movie);
            card.innerHTML = \`<img src="\${movie.poster}" alt="\${movie.title}" loading="lazy">\`;
            historySlider.appendChild(card);
        });
    }
}

// Override Nav List to show history only
document.getElementById('nav-list').addEventListener('click', (e) => {
    e.preventDefault();
    navItems.forEach(n => n && n.classList.remove('active'));
    e.target.classList.add('active');
    
    heroSection.style.backgroundImage = 'none';
    heroSection.innerHTML = '<div class="hero-content"><h1 class="hero-title" style="font-size:3rem;">قائمتي (My List)</h1><p>سجل المشاهدة الخاص بك.</p></div>';
    
    const container = document.querySelector('.main-content');
    container.innerHTML = '<h2 class="section-title">Continue Watching</h2><div class="grid-container" id="my-list-grid"></div>';
    
    const grid = document.getElementById('my-list-grid');
    if (historyList.length === 0) {
        grid.innerHTML = '<p style="color:#888;">لم تقم بمشاهدة أي شيء بعد.</p>';
    } else {
        historyList.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'grid-card';
            card.onclick = () => openModal(movie);
            card.innerHTML = \`<img src="\${movie.poster}" loading="lazy">\`;
            grid.appendChild(card);
        });
    }
});
`;

fs.writeFileSync('script.js', content);
console.log('Successfully refactored script.js with data.json fetch and history logic.');
