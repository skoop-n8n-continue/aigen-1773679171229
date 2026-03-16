// Configuration and Data
const CONFIG = {
    SCORE_UPDATE_INTERVAL: 4000, // Update scores every 4 seconds
    PAGINATION_INTERVAL: 12000,  // Switch pages every 12 seconds
    ITEMS_PER_PAGE: 6            // Safe number for 1080p displays
};

// Team database with realistic colors (Primary and Secondary)
const TEAMS = {
    'ATL': { name: 'Atlanta', color1: '#e03a3e', color2: '#26282a' },
    'BOS': { name: 'Boston', color1: '#007a33', color2: '#ba9653' },
    'BKN': { name: 'Brooklyn', color1: '#000000', color2: '#ffffff' },
    'CHI': { name: 'Chicago', color1: '#ce1141', color2: '#000000' },
    'DAL': { name: 'Dallas', color1: '#00538c', color2: '#b8c4ca' },
    'DEN': { name: 'Denver', color1: '#0e2240', color2: '#fec524' },
    'GSW': { name: 'Golden State', color1: '#1d428a', color2: '#ffc72c' },
    'LAL': { name: 'Los Angeles', color1: '#552583', color2: '#fdb927' },
    'MIA': { name: 'Miami', color1: '#98002e', color2: '#f9a01b' },
    'MIL': { name: 'Milwaukee', color1: '#00471b', color2: '#eee1c6' },
    'NYK': { name: 'New York', color1: '#006bb6', color2: '#f58426' },
    'PHI': { name: 'Philadelphia', color1: '#006bb6', color2: '#ed174c' },
    'PHX': { name: 'Phoenix', color1: '#1d1160', color2: '#e56020' },
    'TOR': { name: 'Toronto', color1: '#ce1141', color2: '#000000' }
};

// Generate Mock Games
let games = [
    { id: 1, home: 'LAL', away: 'BOS', homeScore: 104, awayScore: 102, status: 'LIVE', clock: 'Q4 04:12' },
    { id: 2, home: 'GSW', away: 'PHX', homeScore: 88, awayScore: 92, status: 'LIVE', clock: 'Q3 01:45' },
    { id: 3, home: 'MIA', away: 'NYK', homeScore: 45, awayScore: 41, status: 'LIVE', clock: 'Q2 08:30' },
    { id: 4, home: 'MIL', away: 'CHI', homeScore: 112, awayScore: 98, status: 'FINAL', clock: 'FINAL' },
    { id: 5, home: 'DAL', away: 'DEN', homeScore: 105, awayScore: 108, status: 'FINAL', clock: 'FINAL' },
    { id: 6, home: 'PHI', away: 'BKN', homeScore: 115, awayScore: 109, status: 'FINAL', clock: 'FINAL' },
    { id: 7, home: 'TOR', away: 'ATL', homeScore: 99, awayScore: 105, status: 'FINAL', clock: 'FINAL' }
];

let currentPage = 0;

// Helper: Generate SVG Logo dynamically
function generateLogoSVG(teamAbbr) {
    const team = TEAMS[teamAbbr];
    if (!team) return '';

    // Fallback text color if both are too dark, but generally color2 works as an accent
    let textColor = team.color2;
    if (team.color2 === '#000000' && team.color1 === '#ce1141') textColor = '#ffffff';

    return `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" fill="${team.color1}" stroke="${team.color2}" stroke-width="5"/>
            <text x="50" y="65" font-family="Oswald, sans-serif" font-weight="bold" font-size="42" fill="${textColor}" text-anchor="middle">${teamAbbr}</text>
        </svg>
    `;
}

// Render a single game card
function createGameCard(game) {
    const isFinal = game.status === 'FINAL';
    const isLive = game.status === 'LIVE';

    let homeWinnerClass = '';
    let awayWinnerClass = '';

    if (isFinal) {
        if (game.homeScore > game.awayScore) {
            homeWinnerClass = 'winner';
            awayWinnerClass = 'loser';
        } else {
            homeWinnerClass = 'loser';
            awayWinnerClass = 'winner';
        }
    }

    const homeLogo = generateLogoSVG(game.home);
    const awayLogo = generateLogoSVG(game.away);

    return `
        <div class="game-card ${isFinal ? 'final' : ''} ${isLive ? 'live' : ''}" id="game-${game.id}">
            <div class="game-header">
                <span class="status ${isLive ? 'live' : 'final'}">${isLive ? '<span class="pulse" style="width:8px;height:8px;margin-right:6px;display:inline-block;"></span>' : ''}${game.clock}</span>
                <span>REGULAR SEASON</span>
            </div>

            <div class="team-row ${awayWinnerClass}">
                <div class="team-info">
                    <div class="team-logo">${awayLogo}</div>
                    <div class="team-name">${game.away}</div>
                </div>
                <div class="team-score" id="score-away-${game.id}">${game.awayScore}</div>
            </div>

            <div class="team-row ${homeWinnerClass}">
                <div class="team-info">
                    <div class="team-logo">${homeLogo}</div>
                    <div class="team-name">${game.home}</div>
                </div>
                <div class="team-score" id="score-home-${game.id}">${game.homeScore}</div>
            </div>
        </div>
    `;
}

// Render the current page of games
function renderBoard() {
    const grid = document.getElementById('games-grid');

    // Calculate slice for current page
    const startIdx = currentPage * CONFIG.ITEMS_PER_PAGE;
    const endIdx = startIdx + CONFIG.ITEMS_PER_PAGE;
    const currentGames = games.slice(startIdx, endIdx);

    // Fade out
    grid.style.opacity = '0';

    setTimeout(() => {
        grid.innerHTML = currentGames.map(createGameCard).join('');
        // Fade in
        grid.style.opacity = '1';
    }, 500); // Matches CSS transition duration
}

// Simulate Live Score Updates
function simulateLiveUpdates() {
    let scoreChanged = false;

    games.forEach(game => {
        if (game.status === 'LIVE') {
            // Randomly decide if a score happens (30% chance per tick)
            if (Math.random() < 0.3) {
                const points = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3 points
                const isHome = Math.random() > 0.5;

                if (isHome) {
                    game.homeScore += points;
                    triggerScoreAnimation(game.id, 'home', game.homeScore);
                } else {
                    game.awayScore += points;
                    triggerScoreAnimation(game.id, 'away', game.awayScore);
                }
                scoreChanged = true;

                // Randomly decrement clock slightly
                const parts = game.clock.split(' ');
                if (parts.length === 2) {
                    let [q, time] = parts;
                    let [min, sec] = time.split(':').map(Number);
                    sec -= Math.floor(Math.random() * 15);
                    if (sec < 0) {
                        min -= 1;
                        sec += 60;
                    }
                    if (min >= 0) {
                        game.clock = `${q} ${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

                        // Update clock DOM if it's on screen
                        const card = document.getElementById(`game-${game.id}`);
                        if (card) {
                            const statusEl = card.querySelector('.status');
                            if (statusEl) {
                                statusEl.innerHTML = '<span class="pulse" style="width:8px;height:8px;margin-right:6px;display:inline-block;"></span>' + game.clock;
                            }
                        }
                    }
                }
            }
        }
    });
}

function triggerScoreAnimation(gameId, teamType, newScore) {
    const elId = `score-${teamType}-${gameId}`;
    const el = document.getElementById(elId);

    if (el) {
        el.textContent = newScore;
        el.classList.add('score-changed');

        // Remove class after animation completes
        setTimeout(() => {
            el.classList.remove('score-changed');
        }, 500);
    }
}

// Setup Ticker Tape
function setupTicker() {
    const tickerContent = document.getElementById('ticker-content');
    const news = [
        "<span>BREAKING:</span> Star point guard out 2-4 weeks with ankle sprain",
        "<span>TRADE RUMORS:</span> Multiple teams inquiring about veteran center",
        "<span>NIGHTLY RECAP:</span> LAL overcomes 15-point deficit in second half",
        "<span>LEAGUE LEADERS:</span> GSW currently holds best offensive rating",
        "<span>UPCOMING:</span> All-Star voting opens next Tuesday",
        "<span>FINAL:</span> MIL dominates CHI 112-98 behind 35-point performance"
    ];

    // Duplicate news to ensure smooth infinite scrolling
    const fullNews = [...news, ...news].join('     |     ');
    tickerContent.innerHTML = `<span class="ticker-item">${fullNews}</span>`;
}

// Main Initialization
function init() {
    setupTicker();
    renderBoard();

    // Start Live Update Simulation loop
    setInterval(simulateLiveUpdates, CONFIG.SCORE_UPDATE_INTERVAL);

    // Start Pagination loop
    setInterval(() => {
        const totalPages = Math.ceil(games.length / CONFIG.ITEMS_PER_PAGE);
        if (totalPages > 1) {
            currentPage = (currentPage + 1) % totalPages;
            renderBoard();
        }
    }, CONFIG.PAGINATION_INTERVAL);
}

// Boot
document.addEventListener('DOMContentLoaded', init);