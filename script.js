// Configuration and Data
const CONFIG = {
    SCORE_UPDATE_INTERVAL: 15000, // Fetch live data every 15 seconds
    PAGINATION_INTERVAL: 12000,   // Switch pages every 12 seconds
    ITEMS_PER_PAGE: 6             // Safe number for 1080p displays
};

let games = [];
let currentPage = 0;
let lastUpdate = 0;

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

    // Determine if we need to force a re-render
    const gamesChanged = JSON.stringify(games) !== JSON.stringify(newGames);
    games = newGames;

    if (gamesChanged && games.length > 0) {
        // If we just loaded data for the first time, render immediately
        renderBoard();
    }
}

// Render a single game card
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
             // Fallback if boolean flag isn't set
            if (game.homeScore > game.awayScore) {
                homeWinnerClass = 'winner';
                awayWinnerClass = 'loser';
            } else if (game.awayScore > game.homeScore) {
                homeWinnerClass = 'loser';
                awayWinnerClass = 'winner';
            }
        }
    }

    // Default placeholder if logo is missing
    const defaultLogo = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23333"/></svg>';
    const homeLogoUrl = game.homeLogo || defaultLogo;
    const awayLogoUrl = game.awayLogo || defaultLogo;

    // Pulse effect for live games
    const liveIndicator = isLive ? '<span class="pulse" style="width:8px;height:8px;margin-right:6px;display:inline-block;"></span>' : '';

    // Status text class
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

// Setup Ticker Tape
function setupTicker() {
    const tickerContent = document.getElementById('ticker-content');
    if (!tickerContent) return;

    const news = [
        "<span>ESPN:</span> Fetching live scores direct from API",
        "<span>NBA ACTION:</span> Stay tuned for live updates and recent final scores",
        "<span>NOTICE:</span> Application uses real-time data integration",
        "<span>SPORTSCORE:</span> Digital signage system online"
    ];

    // Duplicate news to ensure smooth infinite scrolling
    const fullNews = [...news, ...news, ...news].join('     |     ');
    tickerContent.innerHTML = `<span class="ticker-item">${fullNews}</span>`;
}

// Main Initialization
function init() {
    setupTicker();

    // Fetch initial data immediately
    fetchLiveData();

    // Start Live Update polling loop
    setInterval(fetchLiveData, CONFIG.SCORE_UPDATE_INTERVAL);

    // Start Pagination loop
    setInterval(() => {
        if (games.length > 0) {
            const totalPages = Math.ceil(games.length / CONFIG.ITEMS_PER_PAGE);
            if (totalPages > 1) {
                currentPage = (currentPage + 1) % totalPages;
                renderBoard();
            }
        }
    }, CONFIG.PAGINATION_INTERVAL);
}

// Boot
document.addEventListener('DOMContentLoaded', init);
