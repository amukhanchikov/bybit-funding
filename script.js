const API_URL = 'https://api.bybit.com/v5/market/tickers?category=linear';

const tickerGrid = document.getElementById('ticker-grid');
const statsContainer = document.getElementById('stats-container');
const avgFundingEl = document.getElementById('avg-funding');
const medianFundingEl = document.getElementById('median-funding');
const posCountEl = document.getElementById('pos-count');
const negCountEl = document.getElementById('neg-count');
const zeroCountEl = document.getElementById('zero-count');

let allTickersCached = []; // Store all tickers to re-slice without refetching
let currentTopList = [];
let sortColumn = 'turnover24h';
let sortDirection = 'desc';
let dataLimit = 25; // Default limit
let isSearching = false;

async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!data || !data.result || !data.result.list) {
            console.error('Invalid API response:', data);
            return;
        }

        let allTickers = data.result.list;

        // Filter valid USDT tickers
        allTickers = allTickers.filter(t => t.symbol.endsWith('USDT'));

        // sort by turnover
        allTickers.sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h));

        // Calculate Global Sentiment (using all USDT tickers)
        renderGlobalSentiment(allTickers);

        allTickersCached = allTickers;
        updateTopList();

    } catch (error) {
        console.error('Error fetching data:', error);
        const tbody = document.getElementById('ticker-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="loading">Error loading data.</td></tr>';
    }
}

function calculateAnnualRate(fundingRate, intervalHour) {
    if (!fundingRate) return 0;
    const rate = parseFloat(fundingRate);
    const hours = parseInt(intervalHour) || 8;
    return rate * (24 / hours) * 365 * 100; // Percentage
}

function formatPercentage(num) {
    return (num > 0 ? '+' : '') + num.toFixed(2) + '%';
}

function getMedian(values) {
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    const half = Math.floor(values.length / 2);
    if (values.length % 2) return values[half];
    return (values[half - 1] + values[half]) / 2.0;
}

function renderTop50Stats(tickers) {
    // Extract annualized rates
    const rates = [];
    tickers.forEach(t => {
        const apr = calculateAnnualRate(t.fundingRate, t.fundingIntervalHour);
        if (!isNaN(apr)) rates.push(apr);
    });

    if (rates.length === 0) return;

    // Average
    const sum = rates.reduce((a, b) => a + b, 0);
    const avg = sum / rates.length;

    // Median
    const median = getMedian([...rates]);

    if (avgFundingEl) {
        avgFundingEl.innerText = formatPercentage(avg);
        avgFundingEl.className = avg >= 0 ? 'positive-text' : 'negative-text';
    }
    if (medianFundingEl) {
        medianFundingEl.innerText = formatPercentage(median);
        medianFundingEl.className = median >= 0 ? 'positive-text' : 'negative-text';
    }
}

function renderGlobalSentiment(tickers) {
    let pos = 0;
    let neg = 0;
    let total = 0;

    tickers.forEach(t => {
        const rate = parseFloat(t.fundingRate);
        if (!isNaN(rate)) {
            total++;
            if (rate > 0) pos++;
            else if (rate < 0) neg++;
        }
    });

    if (total === 0) return;

    const posPct = ((pos / total) * 100).toFixed(0);
    const negPct = ((neg / total) * 100).toFixed(0);

    if (posCountEl) posCountEl.innerText = `${pos} (${posPct}%)`;
    if (negCountEl) negCountEl.innerText = `${neg} (${negPct}%)`;
}

window.handleSearch = function (query) {
    const q = query.toUpperCase().trim();
    const title = document.getElementById('page-title');

    if (!q) {
        isSearching = false;
        if (title) title.innerText = `Top ${dataLimit} Funding Rates`;
        updateTopList();
        return;
    }

    isSearching = true;
    if (title) title.innerText = `Search Results: "${q}"`;

    const filtered = allTickersCached.filter(t => t.symbol.includes(q));
    currentTopList = filtered;
    renderTop50Stats(filtered);
    applySort();
};

window.setLimit = function (limit) {
    if (isSearching) {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        isSearching = false;
    }

    if (dataLimit === limit && !isSearching) return;
    dataLimit = limit;

    // Update active tab state
    ['all', 50, 25, 10, 5].forEach(val => {
        const el = document.getElementById(`tab-${val}`);
        if (el) el.className = val === limit ? 'limit-tab active' : 'limit-tab';
    });

    // Update Title
    const title = document.getElementById('page-title');
    if (title) {
        if (limit === 'all') title.innerText = 'All Market Funding Rates';
        else title.innerText = `Top ${limit} Funding Rates`;
    }

    updateTopList();
};

function updateTopList() {
    if (allTickersCached.length === 0) return;

    // Slice based on limit
    if (dataLimit === 'all') {
        currentTopList = allTickersCached;
    } else {
        currentTopList = allTickersCached.slice(0, dataLimit);
    }

    renderTop50Stats(currentTopList);
    applySort();
}


window.sortTable = function (column) {
    if (sortColumn === column) {
        // Toggle direction
        sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
        sortColumn = column;
        sortDirection = 'desc'; // Default to desc for new columns (usually what we want for volume/rates)
        // Except for symbol, maybe we want asc? But consistent behavior is better.
    }
    applySort();
};

function applySort() {
    updateSortIcons();

    currentTopList.sort((a, b) => {
        let valA, valB;

        switch (sortColumn) {
            case 'symbol':
                valA = a.symbol;
                valB = b.symbol;
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            case 'fundingRate':
                valA = parseFloat(a.fundingRate);
                valB = parseFloat(b.fundingRate);
                break;
            case 'annualized':
                valA = calculateAnnualRate(a.fundingRate, a.fundingIntervalHour);
                valB = calculateAnnualRate(b.fundingRate, b.fundingIntervalHour);
                break;
            case 'turnover24h':
                valA = parseFloat(a.turnover24h);
                valB = parseFloat(b.turnover24h);
                break;
            default:
                return 0;
        }

        if (sortDirection === 'asc') return valA - valB;
        return valB - valA;
    });

    renderTableRows(currentTopList);
}

function updateSortIcons() {
    // Reset all icons
    ['symbol', 'fundingRate', 'annualized', 'turnover24h'].forEach(col => {
        const icon = document.getElementById(`sort-icon-${col}`);
        if (icon) icon.innerText = '';
        // Also remove active class from th if we added one (optional style enhancement)
    });

    // Set current icon
    const currentIcon = document.getElementById(`sort-icon-${sortColumn}`);
    if (currentIcon) {
        currentIcon.innerText = sortDirection === 'asc' ? ' ▲' : ' ▼';
    }
}


function renderTableRows(tickers) {
    const tbody = document.getElementById('ticker-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    tickers.forEach((ticker, index) => {
        // Strip USDT/USDC for cleaner display
        const symbol = ticker.symbol.replace(/USDT$|USDC$/, '');
        const fundingRate = parseFloat(ticker.fundingRate);
        const intervalHour = ticker.fundingIntervalHour || 8;
        const apr = calculateAnnualRate(fundingRate, intervalHour);
        const volume = parseFloat(ticker.turnover24h);

        const isPositive = apr > 0;
        const isNegative = apr < 0;
        let colorClass = 'neutral';
        if (isPositive) colorClass = 'positive';
        else if (isNegative) colorClass = 'negative';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-symbol">
                <span class="rank">#${index + 1}</span>
                <span class="symbol-text">${symbol}</span>
            </td>
            <td class="col-rate ${colorClass}">
                ${(fundingRate * 100).toFixed(4)}%
                <span class="interval-badge">${intervalHour}h</span>
            </td>
            <td class="col-apr ${colorClass}">${formatPercentage(apr)}</td>
            <td class="col-volume">$${(volume / 1_000_000).toFixed(2)}M</td>
        `;
        tbody.appendChild(tr);
    });
}

// Initial Loading State
const tbody = document.getElementById('ticker-body');
if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading Top 50 data...</td></tr>';
fetchData();
setInterval(fetchData, 30000);
