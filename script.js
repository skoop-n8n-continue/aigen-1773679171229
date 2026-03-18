// Configuration and Data
const CONFIG = {
    SCORE_UPDATE_INTERVAL: 15000, // Fetch live data every 15 seconds
    PAGINATION_INTERVAL: 12000,   // Switch pages every 12 seconds
    ITEMS_PER_PAGE: 6             // Dynamically calculated based on screen size
};

let games = [];
let currentPage = 0;
let paginationTimer = null;
let updateTimer = null;

// Calculate how many items fit in the grid to avoid cut-offs
function calculateItemsPerPage() {
    const grid = document.getElementById('games-grid');
    if (!grid) return;

    // Get actual computed gap (fallback to 24px)
    const computedStyle = window.getComputedStyle(grid);
    const gap = parseFloat(computedStyle.gap) || 24;

    const gridWidth = grid.clientWidth;
    const gridHeight = grid.clientHeight;

    // Min card dimensions based on our CSS design
    const cardMinWidth = 320;
    const cardMinHeight = 200; // Increased to ensure no vertical clipping

    let cols = Math.floor((gridWidth + gap) / (cardMinWidth + gap));
    if (cols < 1) cols = 1;

    let rows = Math.floor((gridHeight + gap) / (cardMinHeight + gap));
    if (rows < 1) rows = 1;

    const newItemsPerPage = cols * rows;

    if (CONFIG.ITEMS_PER_PAGE !== newItemsPerPage) {
        CONFIG.ITEMS_PER_PAGE = newItemsPerPage;
        currentPage = 0; // Reset page to avoid out of bounds

        // If we already have games, re-render the board immediately
        if (games.length > 0) {
            renderBoard();
        }
    }
}

// Handle window resizing to recalculate capacity
window.addEventListener('resize', () => {
    // Debounce resize
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(calculateItemsPerPage, 250);
});

// Fetch Live Data from ESPN NBA Scoreboard API
async function fetchLiveData() {
    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', {
            cache: 'no-store'
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        processApiData(data);
    } catch (error) {
        console.error('Error fetching live data:', error);
        // If error, we keep the existing games array to prevent empty screen
    }
}

// Transform ESPN JSON into internal structure
function processApiData(data) {
    if (!data || !data.events) return;

    // Process games
    const newGames = data.events.map(event => {
        const homeCompetitor = event.competitions[0].competitors.find(c => c.homeAway === 'home');
        const awayCompetitor = event.competitions[0].competitors.find(c => c.homeAway === 'away');

        // Determine status formatting
        let statusDisplay = 'SCHEDULED';
        const state = event.status.type.state; // 'pre', 'in', 'post'

        if (state === 'in') {
            statusDisplay = 'LIVE';
        } else if (state === 'post') {
            statusDisplay = 'FINAL';
        } else {
            // pre-game
            statusDisplay = 'UPCOMING';
        }

        let clockDisplay = event.status.displayClock;
        if (state === 'post') {
            clockDisplay = 'FINAL';
        } else if (state === 'pre') {
            // Format start time if available in event.date or just show status description
            clockDisplay = event.status.type.shortDetail || event.status.type.description;
        } else if (state === 'in') {
             // For live games, show Period + Clock
             const periodDesc = event.status.period > 4 ? `OT${event.status.period - 4}` : `Q${event.status.period}`;
             clockDisplay = `${periodDesc} ${clockDisplay}`;
             if (event.status.type.description === 'Halftime') {
                 clockDisplay = 'HALFTIME';
             }
        }

        return {
            id: event.id,
            home: homeCompetitor.team.abbreviation,
            away: awayCompetitor.team.abbreviation,
            homeLogo: homeCompetitor.team.logo,
            awayLogo: awayCompetitor.team.logo,
            homeScore: parseInt(homeCompetitor.score) || 0,
            awayScore: parseInt(awayCompetitor.score) || 0,
            status: statusDisplay,
            clock: clockDisplay,
            homeWinner: homeCompetitor.winner,
            awayWinner: awayCompetitor.winner
        };
    });

    const isFirstLoad = games.length === 0;
    games = newGames;

    if (isFirstLoad) {
        renderBoard();
    } else {
        updateDOMInPlace();
    }
}

// Update existing DOM elements to avoid full re-render flashes
function updateDOMInPlace() {
    const grid = document.getElementById('games-grid');
    if (!grid) return;

    const startIdx = currentPage * CONFIG.ITEMS_PER_PAGE;
    const endIdx = startIdx + CONFIG.ITEMS_PER_PAGE;
    const currentGames = games.slice(startIdx, endIdx);

    let needsFullRender = false;

    for (const game of currentGames) {
        const gameEl = document.getElementById(`game-${game.id}`);

        // If the card doesn't exist on the screen, the DOM is out of sync. Full render needed.
        if (!gameEl) {
            needsFullRender = true;
            break;
        }

        // Update clock & status
        const clockEl = gameEl.querySelector('.status');
        if (clockEl) {
            // strip out pulse element to compare just text
            let currentText = clockEl.innerText.trim();
            if (currentText !== game.clock) {

                let statusClass = 'final';
                if (game.status === 'LIVE') statusClass = 'live';
                else if (game.status === 'UPCOMING') statusClass = 'upcoming';

                clockEl.className = `status ${statusClass}`;

                if (game.status === 'LIVE') {
                    clockEl.innerHTML = '<span class="pulse" style="width:8px;height:8px;margin-right:6px;display:inline-block;"></span>' + game.clock;
                    gameEl.classList.add('live');
                    gameEl.classList.remove('final');
                } else if (game.status === 'FINAL') {
                    clockEl.innerHTML = game.clock;
                    gameEl.classList.add('final');
                    gameEl.classList.remove('live');

                    // Update winner styling if it just ended
                    updateWinnerStyling(gameEl, game);
                } else {
                    clockEl.innerHTML = game.clock;
                    gameEl.classList.remove('live', 'final');
                }
            }
        }

        // Update scores dynamically
        const homeScoreEl = document.getElementById(`score-home-${game.id}`);
        const awayScoreEl = document.getElementById(`score-away-${game.id}`);

        if (homeScoreEl && parseInt(homeScoreEl.innerText) !== game.homeScore && (game.status === 'LIVE' || game.status === 'FINAL')) {
            homeScoreEl.innerText = game.homeScore;
            homeScoreEl.classList.add('score-changed');
            setTimeout(() => homeScoreEl.classList.remove('score-changed'), 1000);
        }

        if (awayScoreEl && parseInt(awayScoreEl.innerText) !== game.awayScore && (game.status === 'LIVE' || game.status === 'FINAL')) {
            awayScoreEl.innerText = game.awayScore;
            awayScoreEl.classList.add('score-changed');
            setTimeout(() => awayScoreEl.classList.remove('score-changed'), 1000);
        }
    }

    if (needsFullRender) {
        renderBoard();
    }
}

// Update winning/losing team classes
function updateWinnerStyling(gameEl, game) {
    let homeWinnerClass = '';
    let awayWinnerClass = '';

    if (game.homeWinner) {
        homeWinnerClass = 'winner';
        awayWinnerClass = 'loser';
    } else if (game.awayWinner) {
        homeWinnerClass = 'loser';
        awayWinnerClass = 'winner';
    } else {
        if (game.homeScore > game.awayScore) {
            homeWinnerClass = 'winner';
            awayWinnerClass = 'loser';
        } else if (game.awayScore > game.homeScore) {
            homeWinnerClass = 'loser';
            awayWinnerClass = 'winner';
        }
    }

    const rows = gameEl.querySelectorAll('.team-row');
    if (rows.length === 2) {
        rows[0].className = `team-row ${awayWinnerClass}`;
        rows[1].className = `team-row ${homeWinnerClass}`;
    }
}

// Render a single game card (Full HTML generation)
function createGameCard(game) {
    const isFinal = game.status === 'FINAL';
    const isLive = game.status === 'LIVE';

    let homeWinnerClass = '';
    let awayWinnerClass = '';

    if (isFinal) {
        if (game.homeWinner) {
            homeWinnerClass = 'winner';
            awayWinnerClass = 'loser';
        } else if (game.awayWinner) {
            homeWinnerClass = 'loser';
            awayWinnerClass = 'winner';
        } else {
            if (game.homeScore > game.awayScore) {
                homeWinnerClass = 'winner';
                awayWinnerClass = 'loser';
            } else if (game.awayScore > game.homeScore) {
                homeWinnerClass = 'loser';
                awayWinnerClass = 'winner';
            }
        }
    }

    const defaultLogo = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23333"/></svg>';
    const homeLogoUrl = game.homeLogo || defaultLogo;
    const awayLogoUrl = game.awayLogo || defaultLogo;

    const liveIndicator = isLive ? '<span class="pulse" style="width:8px;height:8px;margin-right:6px;display:inline-block;"></span>' : '';

    let statusClass = 'final';
    if (isLive) statusClass = 'live';
    else if (game.status === 'UPCOMING') statusClass = 'upcoming';

    return `
        <div class="game-card ${isFinal ? 'final' : ''} ${isLive ? 'live' : ''}" id="game-${game.id}">
            <div class="game-header">
                <span class="status ${statusClass}">${liveIndicator}${game.clock}</span>
                <span>NBA</span>
            </div>

            <div class="team-row ${awayWinnerClass}">
                <div class="team-info">
                    <div class="team-logo"><img src="${awayLogoUrl}" alt="${game.away} logo" style="width:100%; height:100%; object-fit:contain; border-radius:50%; background:white; padding: 2px;"></div>
                    <div class="team-name">${game.away}</div>
                </div>
                <div class="team-score" id="score-away-${game.id}">${isLive || isFinal ? game.awayScore : '-'}</div>
            </div>

            <div class="team-row ${homeWinnerClass}">
                <div class="team-info">
                    <div class="team-logo"><img src="${homeLogoUrl}" alt="${game.home} logo" style="width:100%; height:100%; object-fit:contain; border-radius:50%; background:white; padding: 2px;"></div>
                    <div class="team-name">${game.home}</div>
                </div>
                <div class="team-score" id="score-home-${game.id}">${isLive || isFinal ? game.homeScore : '-'}</div>
            </div>
        </div>
    `;
}

// Render the current page of games
function renderBoard() {
    const grid = document.getElementById('games-grid');
    if (!grid || games.length === 0) return;

    // Calculate total pages
    const totalPages = Math.ceil(games.length / CONFIG.ITEMS_PER_PAGE);

    // Ensure current page is valid (in case games array shrank)
    if (currentPage >= totalPages) {
        currentPage = 0;
    }

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

// Setup Ticker Tape (Stock Ticker)
let stocks = [
    { symbol: 'AAPL', price: 232.14, change: 1.45, percent: 0.63 },
    { symbol: 'MSFT', price: 412.56, change: -2.31, percent: -0.56 },
    { symbol: 'GOOGL', price: 184.22, change: 0.88, percent: 0.48 },
    { symbol: 'AMZN', price: 198.75, change: 3.12, percent: 1.59 },
    { symbol: 'NVDA', price: 135.21, change: 4.15, percent: 3.17 },
    { symbol: 'TSLA', price: 258.44, change: -5.62, percent: -2.12 },
    { symbol: 'META', price: 562.18, change: 7.42, percent: 1.34 },
    { symbol: 'NFLX', price: 712.33, change: -1.25, percent: -0.18 },
    { symbol: 'BRK.B', price: 452.12, change: 0.95, percent: 0.21 },
    { symbol: 'V', price: 284.55, change: -0.42, percent: -0.15 },
    { symbol: 'BTC/USD', price: 92451.22, change: 1242.55, percent: 1.36 }
];

async function fetchStockData() {
    try {
        // Simulate real-time market movement with small fluctuations
        stocks = stocks.map(stock => {
            const volatility = 0.001; // 0.1% max move per update
            const change = (Math.random() - 0.48) * stock.price * volatility; // Slight upward bias
            const newPrice = stock.price + change;
            const newChange = stock.change + change;
            const newPercent = (newChange / (newPrice - newChange)) * 100;

            return {
                ...stock,
                price: newPrice,
                change: newChange,
                percent: newPercent
            };
        });

        updateTicker();
    } catch (error) {
        console.error('Error updating stock data:', error);
    }
}

function updateTicker() {
    const tickerContent = document.getElementById('ticker-content');
    if (!tickerContent) return;

    // Format stock items
    const stockItems = stocks.map(stock => {
        const isUp = stock.percent >= 0;
        const colorClass = isUp ? 'stock-up' : 'stock-down';
        const sign = isUp ? '+' : '';
        const arrow = isUp ? '▲' : '▼';

        return `<span class="stock-item">
            <span class="stock-symbol">${stock.symbol}</span>
            <span class="stock-price">${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span class="stock-change ${colorClass}">${arrow} ${sign}${stock.percent.toFixed(2)}%</span>
        </span>`;
    });

    // Duplicate for smooth infinite scrolling
    const fullTicker = [...stockItems, ...stockItems].join('<span class="ticker-separator">     |     </span>');
    tickerContent.innerHTML = `<span class="ticker-item">${fullTicker}     |     </span>`;
}

// Main Initialization
function init() {
    // Initial calculation of layout
    calculateItemsPerPage();

    // Initial data fetch
    fetchLiveData();
    fetchStockData();

    // Start Live Update polling loop
    updateTimer = setInterval(fetchLiveData, CONFIG.SCORE_UPDATE_INTERVAL);

    // Start Stock polling loop (every 5 seconds for a "live" feel)
    setInterval(fetchStockData, 5000);

    // Start Pagination loop
    paginationTimer = setInterval(() => {
        if (games.length > 0) {
            const totalPages = Math.ceil(games.length / CONFIG.ITEMS_PER_PAGE);
            if (totalPages > 1) {
                currentPage = (currentPage + 1) % totalPages;
                renderBoard(); // Full render is needed for pagination
            }
        }
    }, CONFIG.PAGINATION_INTERVAL);
}

// Boot
document.addEventListener('DOMContentLoaded', init);
