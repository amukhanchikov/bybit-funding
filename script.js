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
    if (isSearching && limit !== 'history') {
        const input = document.getElementById('search-input');
        if (input) input.value = '';
        isSearching = false;
    }

    if (dataLimit === limit && !isSearching) return;
    dataLimit = limit;
    localStorage.setItem('funding_data_limit', limit);

    // Update active tab state
    ['all', 50, 25, 10, 5, 'history'].forEach(val => {
        const el = document.getElementById(`tab-${val}`);
        if (el) el.className = val === limit ? 'limit-tab active' : 'limit-tab';
    });

    // View Toggling
    const marketStats = document.getElementById('market-stats-view');
    const marketTable = document.getElementById('table-view');
    const searchWrapper = document.getElementById('search-container-wrapper');
    const snapshotSection = document.getElementById('snapshot-section');
    const title = document.getElementById('page-title');
    const snapshotBtn = document.getElementById('btn-save-snapshot');

    if (limit === 'history') {
        if (marketStats) marketStats.style.display = 'none';
        if (marketTable) marketTable.style.display = 'none';
        if (searchWrapper) searchWrapper.style.visibility = 'hidden'; // Hide but keep layout or use display:none
        if (snapshotSection) snapshotSection.style.display = 'block';
        if (snapshotBtn) snapshotBtn.style.display = 'none';
        if (title) title.innerText = 'Market History';
    } else {
        if (marketStats) marketStats.style.display = 'block';
        if (marketTable) marketTable.style.display = 'block';
        if (searchWrapper) searchWrapper.style.visibility = 'visible';
        // Check if search wrapper should be displayed based on css (flex) - default is fine
        if (snapshotSection) snapshotSection.style.display = 'none';
        if (snapshotBtn) snapshotBtn.style.display = 'block';

        // Update Title
        if (title) {
            if (limit === 'all') title.innerText = 'All Market Funding Rates';
            else title.innerText = `Top ${limit} Funding Rates`;
        }
        updateTopList();
    }
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

// History Sorting State
let historySortColumn = 'time';
let historySortDirection = 'desc';

window.sortHistory = function (column) {
    if (historySortColumn === column) {
        historySortDirection = historySortDirection === 'desc' ? 'asc' : 'desc';
    } else {
        historySortColumn = column;
        historySortDirection = 'desc';
    }
    renderSnapshots();
};

// Snapshot Logic
window.saveSnapshot = function () {
    const avg = document.getElementById('avg-funding')?.innerText || '...';
    const median = document.getElementById('median-funding')?.innerText || '...';
    const postCount = document.getElementById('pos-count')?.innerText || '0';
    const negCount = document.getElementById('neg-count')?.innerText || '0';

    // Simple prompt for label
    const label = prompt("Enter a label for this snapshot (optional):", "");
    if (label === null) return; // Cancelled

    const snapshot = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        label: label || 'Snapshot',
        limit: dataLimit, // Save current limit (e.g., 25, 50, 'all')
        avg,
        median,
        sentiment: `${postCount} / ${negCount}`
    };

    const snapshots = JSON.parse(localStorage.getItem('market_snapshots') || '[]');
    snapshots.unshift(snapshot); // Add to beginning
    localStorage.setItem('market_snapshots', JSON.stringify(snapshots));
    renderSnapshots();
};

window.deleteSnapshot = function (id) {
    if (!confirm('Delete this snapshot?')) return;
    let snapshots = JSON.parse(localStorage.getItem('market_snapshots') || '[]');
    snapshots = snapshots.filter(s => s.id !== id);
    localStorage.setItem('market_snapshots', JSON.stringify(snapshots));
    renderSnapshots();
};

window.renderSnapshots = function () {
    const tbody = document.getElementById('snapshot-table-body');
    if (!tbody) return;

    let snapshots = JSON.parse(localStorage.getItem('market_snapshots') || '[]');

    if (snapshots.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No snapshots saved.</td></tr>';
        return;
    }

    // Apply Sorting
    snapshots.sort((a, b) => {
        let valA, valB;
        switch (historySortColumn) {
            case 'time':
                // Try to parse timestamp, fallback to ID
                valA = Date.parse(a.timestamp) || a.id;
                valB = Date.parse(b.timestamp) || b.id;
                break;
            case 'label':
                valA = a.label.toLowerCase();
                valB = b.label.toLowerCase();
                break;
            case 'view':
                valA = (a.limit || '').toString();
                valB = (b.limit || '').toString();
                break;
            case 'avg':
                valA = parseFloat(a.avg);
                valB = parseFloat(b.avg);
                break;
            case 'median':
                valA = parseFloat(a.median);
                valB = parseFloat(b.median);
                break;
            case 'sentiment':
                // rudimentary sentiment sort (by positive count)
                valA = parseInt(a.sentiment.split('/')[0]);
                valB = parseInt(b.sentiment.split('/')[0]);
                break;
            default:
                return 0;
        }

        if (valA < valB) return historySortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return historySortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Update Icons
    ['time', 'label', 'view', 'avg', 'median', 'sentiment'].forEach(col => {
        const icon = document.getElementById(`sort-icon-history-${col}`);
        if (icon) icon.innerText = '';
    });
    const currentIcon = document.getElementById(`sort-icon-history-${historySortColumn}`);
    if (currentIcon) currentIcon.innerText = historySortDirection === 'asc' ? ' ▲' : ' ▼';


    tbody.innerHTML = snapshots.map(s => {
        const limitDisplay = s.limit === 'all' ? 'All' : (s.limit ? `Top ${s.limit}` : '-');
        return `
        <tr>
            <td class="col-date">${s.timestamp}</td>
            <td class="col-label">${s.label}</td>
            <td class="col-view">${limitDisplay}</td>
            <td class="col-stat">${s.avg}</td>
            <td class="col-stat">${s.median}</td>
            <td class="col-stat">${s.sentiment}</td>
            <td class="col-action">
                <button class="edit-btn-table" onclick="editSnapshotLabel(${s.id})">Edit</button>
                <button class="delete-btn-table" onclick="deleteSnapshot(${s.id})">Delete</button>
            </td>
        </tr>
    `}).join('');
};

window.editSnapshotLabel = function (id) {
    const snapshots = JSON.parse(localStorage.getItem('market_snapshots') || '[]');
    const snapshotIndex = snapshots.findIndex(s => s.id === id);
    if (snapshotIndex === -1) return;

    const newLabel = prompt("Enter new label:", snapshots[snapshotIndex].label);
    if (newLabel === null) return; // Cancelled

    snapshots[snapshotIndex].label = newLabel || 'Snapshot';
    localStorage.setItem('market_snapshots', JSON.stringify(snapshots));
    renderSnapshots();
};


window.clearAllSnapshots = function () {
    if (!confirm('Are you sure you want to delete ALL snapshots? This cannot be undone.')) return;
    localStorage.setItem('market_snapshots', '[]');
    renderSnapshots();
};

window.exportSnapshots = function () {
    const snapshots = localStorage.getItem('market_snapshots') || '[]';
    const blob = new Blob([snapshots], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `market_snapshots_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.handleImport = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) {
                alert('Invalid file format: Expected an array of snapshots.');
                return;
            }

            // Merge logic: Add only if ID doesn't exist OR content changed
            const current = JSON.parse(localStorage.getItem('market_snapshots') || '[]');
            let addedCount = 0;
            const currentIds = new Set(current.map(s => s.id));

            imported.forEach(s => {
                // Check if EXACT content exists anywhere (deduplication)
                const isContentDuplicate = current.some(c =>
                    c.timestamp === s.timestamp &&
                    c.label === s.label &&
                    c.avg === s.avg
                );

                if (isContentDuplicate) {
                    return; // Skip duplicates
                }

                // If not content duplicate, check ID collision
                if (currentIds.has(s.id)) {
                    // ID collision but content is new (otherwise caught above)
                    // Generates new unique ID
                    s.id = Date.now() + Math.floor(Math.random() * 100000);
                }

                current.push(s);
                currentIds.add(s.id);
                addedCount++;
            });

            // Re-save
            localStorage.setItem('market_snapshots', JSON.stringify(current));
            renderSnapshots();
            alert(`Imported ${addedCount} snapshots successfully.`);
        } catch (err) {
            console.error(err);
            alert('Error parsing JSON file.');
        }
        // Reset input
        input.value = '';
    };
    reader.readAsText(file);
};

// Initial render
renderSnapshots();

// Restore saved limit
const savedLimit = localStorage.getItem('funding_data_limit');
if (savedLimit) {
    let limitToSet = 25;
    if (savedLimit === 'all' || savedLimit === 'history') {
        limitToSet = savedLimit;
    } else {
        limitToSet = parseInt(savedLimit, 10);
    }
    // Call setLimit to update both state and UI
    setLimit(limitToSet);
}

fetchData();
setInterval(fetchData, 30000);
