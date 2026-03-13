// Enhanced Popup script for Football League Auto Saver
// Supports tabbed interface and URL management

// =============================================================================
// TAB MANAGEMENT
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            button.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');

            // Load URLs if URLs tab is activated
            if (tabName === 'urls') {
                loadURLList();
            }

            // Refresh backend status when Backend tab is opened
            if (tabName === 'backend') {
                refreshBackendTab();
            }
        });
    });

    // Initialize Download tab (default)
    initDownloadTab();

    // Initialize URLs tab
    initURLsTab();

    // Initialize Data Enrichment tab
    initEnrichmentTab();

    // Initialize Backend tab
    initBackendTab();
});

// =============================================================================
// DOWNLOAD TAB (Original Functionality - UNCHANGED)
// =============================================================================

let startBtn, stopBtn, statusDiv, folderInput, progressInfo, successBox;
let progressInterval = null;

function initDownloadTab() {
    startBtn = document.getElementById('startBtn');
    stopBtn = document.getElementById('stopBtn');
    statusDiv = document.getElementById('status');
    folderInput = document.getElementById('folderName');
    progressInfo = document.getElementById('progressInfo');
    successBox = document.getElementById('successBox');

    // Load current status when popup opens
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
        if (response && response.enabled) {
            setActiveState();
            folderInput.value = response.folder;
            updateProgressDisplay(response.count, response.total);
        }
    });

    // Start auto-save
    startBtn.addEventListener('click', async () => {
        const folder = folderInput.value.trim() || 'football_data';

        // Get URL count from storage
        const urlCount = await URLManager.getCount();

        // Send start message
        chrome.runtime.sendMessage({
            action: 'startAutoSave',
            folder: folder
        }, (response) => {
            if (response && response.success) {
                // Set expected total based on actual URL count
                chrome.runtime.sendMessage({
                    action: 'setExpected',
                    total: urlCount
                });

                setActiveState();
                startProgressMonitoring();
            }
        });
    });

    // Stop auto-save
    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stopAutoSave' }, (response) => {
            if (response && response.success) {
                setInactiveState();
                stopProgressMonitoring();
            }
        });
    });
}

function startProgressMonitoring() {
    // Clear any existing interval
    if (progressInterval) {
        clearInterval(progressInterval);
    }

    // Check progress every second
    progressInterval = setInterval(() => {
        chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
            if (response) {
                updateProgressDisplay(response.count, response.total);

                // Show success box when complete
                if (response.count >= response.total && response.total > 0) {
                    successBox.classList.add('show');
                    setTimeout(() => {
                        successBox.classList.remove('show');
                    }, 5000);
                }
            }
        });
    }, 1000);
}

function stopProgressMonitoring() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    progressInfo.classList.remove('show');
    successBox.classList.remove('show');
}

function updateProgressDisplay(count, total) {
    if (total > 0) {
        progressInfo.textContent = `📥 Saved: ${count}/${total} files`;
        progressInfo.classList.add('show');
    }
}

function setActiveState() {
    statusDiv.textContent = '● Auto-Save: ON';
    statusDiv.className = 'status active';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    folderInput.disabled = true;
}

function setInactiveState() {
    statusDiv.textContent = '● Auto-Save: OFF';
    statusDiv.className = 'status inactive';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    folderInput.disabled = false;
    progressInfo.textContent = '📥 Saved: 0/0 files';
}

// Clean up interval when popup closes
window.addEventListener('unload', () => {
    stopProgressMonitoring();
});

// =============================================================================
// URLs TAB (New Functionality)
// =============================================================================

function initURLsTab() {
    const addUrlBtn = document.getElementById('addUrlBtn');
    const resetUrlsBtn = document.getElementById('resetUrlsBtn');
    const exportUrlsBtn = document.getElementById('exportUrlsBtn');
    const importUrlsBtn = document.getElementById('importUrlsBtn');

    // Add URL button
    addUrlBtn.addEventListener('click', () => {
        showAddURLDialog();
    });

    // Reset URLs button
    resetUrlsBtn.addEventListener('click', async () => {
        if (confirm('Reset to default 28 URLs? This will remove all custom URLs.')) {
            await URLManager.resetToDefaults();
            loadURLList();
        }
    });

    // Export URLs
    exportUrlsBtn.addEventListener('click', async () => {
        const json = await URLManager.exportURLs();
        downloadJSON(json, 'fbref_urls.json');
    });

    // Import URLs
    importUrlsBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                try {
                    await URLManager.importURLs(text);
                    loadURLList();
                    alert('URLs imported successfully!');
                } catch (error) {
                    alert('Error importing URLs: ' + error.message);
                }
            }
        };
        input.click();
    });
}

async function loadURLList() {
    const urls = await URLManager.loadURLs();
    const urlList = document.getElementById('urlList');
    const urlCount = document.getElementById('urlCount');

    // Update count
    urlCount.textContent = `📊 Total URLs: ${urls.length}`;

    // Clear current list
    urlList.innerHTML = '';

    // Add each URL
    urls.forEach((urlData, index) => {
        const item = document.createElement('div');
        item.className = 'url-item';

        const badge = urlData.type === 'fixtures' ? 'badge-fixtures' : 'badge-stats';

        item.innerHTML = `
      <div class="url-info">
        <div class="url-name">
          ${urlData.league}
          <span class="url-badge ${badge}">${urlData.type}</span>
        </div>
        <div class="url-link" title="${urlData.url}">${urlData.url}</div>
      </div>
      <div class="url-actions">
        <button class="btn-icon btn-edit" data-index="${index}" title="Edit">✏️</button>
        <button class="btn-icon btn-delete" data-index="${index}" title="Delete">🗑️</button>
      </div>
    `;

        urlList.appendChild(item);
    });

    // Add event listeners for edit/delete buttons
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            showEditURLDialog(index, urls[index]);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            if (confirm(`Delete "${urls[index].name}"?`)) {
                await URLManager.deleteURL(index);
                loadURLList();
            }
        });
    });
}

function showAddURLDialog() {
    const name = prompt('Enter URL name (e.g., "Ligue 1 Stats"):');
    if (!name) return;

    const url = prompt('Enter FBref URL:');
    if (!url) return;

    const league = prompt('Enter league name (e.g., "Ligue 1"):');
    if (!league) return;

    const type = prompt('Enter type (fixtures or stats):');
    if (!type || (type !== 'fixtures' && type !== 'stats')) {
        alert('Type must be "fixtures" or "stats"');
        return;
    }

    URLManager.addURL({ name, url, league, type })
        .then(() => {
            loadURLList();
        })
        .catch(error => {
            alert('Error adding URL: ' + error.message);
        });
}

function showEditURLDialog(index, currentData) {
    const name = prompt('Enter URL name:', currentData.name);
    if (!name) return;

    const url = prompt('Enter FBref URL:', currentData.url);
    if (!url) return;

    const league = prompt('Enter league name:', currentData.league);
    if (!league) return;

    const type = prompt('Enter type (fixtures or stats):', currentData.type);
    if (!type || (type !== 'fixtures' && type !== 'stats')) {
        alert('Type must be "fixtures" or "stats"');
        return;
    }

    URLManager.updateURL(index, { name, url, league, type })
        .then(() => {
            loadURLList();
        })
        .catch(error => {
            alert('Error updating URL: ' + error.message);
        });
}

function downloadJSON(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// =============================================================================
// SCRAPER TEST (Settings Tab)
// =============================================================================

// Initialize test functionality when page loads
document.addEventListener('DOMContentLoaded', () => {
    const testBtn = document.getElementById('testScraperBtn');
    const clearBtn = document.getElementById('clearTestBtn');

    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            await testScraper();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearTestOutput();
        });
    }
});

async function testScraper() {
    const statusDiv = document.getElementById('testStatus');
    const summaryDiv = document.getElementById('testSummary');
    const outputDiv = document.getElementById('testOutput');

    // Show loading status
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#d1ecf1';
    statusDiv.style.color = '#0c5460';
    statusDiv.style.border = '1px solid #bee5eb';
    statusDiv.textContent = '⏳ Extracting data from current tab...';

    // Hide previous results
    summaryDiv.style.display = 'none';
    outputDiv.style.display = 'none';

    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            throw new Error('No active tab found');
        }

        if (!tab.url.includes('fbref.com')) {
            throw new Error('Current tab is not an FBref page! Please open an FBref page first.');
        }

        // Inject and execute content scraper
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content_scraper.js']
        });

        if (results && results[0]) {
            const data = results[0].result;

            if (data.error) {
                throw new Error(data.error);
            }

            // Show success status
            statusDiv.style.background = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.style.border = '1px solid #c3e6cb';
            statusDiv.textContent = `✅ Successfully extracted data from: ${data.league}`;

            // Show summary
            summaryDiv.style.display = 'block';
            document.getElementById('summaryLeague').textContent = data.league || 'Unknown';
            document.getElementById('summaryType').textContent = data.pageType || 'unknown';
            document.getElementById('summaryTables').textContent = data.tables.length;
            const totalRows = data.tables.reduce((sum, t) => sum + t.rowCount, 0);
            document.getElementById('summaryRows').textContent = totalRows;

            // Show formatted JSON output
            outputDiv.style.display = 'block';
            outputDiv.textContent = JSON.stringify(data, null, 2);

        } else {
            throw new Error('No data returned from scraper');
        }

    } catch (error) {
        statusDiv.style.background = '#f8d7da';
        statusDiv.style.color = '#721c24';
        statusDiv.style.border = '1px solid #f5c6cb';
        statusDiv.textContent = `❌ Error: ${error.message}`;

        outputDiv.style.display = 'block';
        outputDiv.textContent = `Error details:\n${error.stack || error.message}`;
    }
}

function clearTestOutput() {
    document.getElementById('testStatus').style.display = 'none';
    document.getElementById('testSummary').style.display = 'none';
    document.getElementById('testOutput').style.display = 'none';
}

// =============================================================================
// DATA ENRICHMENT TAB (NEW)
// =============================================================================

function initEnrichmentTab() {
    const enableWeatherCheck = document.getElementById('enable-weather');
    const weatherApiContainer = document.getElementById('weather-api-container');
    const enrichDataBtn = document.getElementById('enrich-data-btn');

    // Show/hide API key input when weather checkbox is toggled
    enableWeatherCheck.addEventListener('change', () => {
        weatherApiContainer.style.display = enableWeatherCheck.checked ? 'block' : 'none';
    });

    // Handle enrich data button click
    enrichDataBtn.addEventListener('click', async () => {
        await runEnrichment();
    });

    // Load saved API key
    chrome.storage.local.get(['weatherApiKey'], (result) => {
        if (result.weatherApiKey) {
            document.getElementById('weather-api-key').value = result.weatherApiKey;
        }
    });
}

async function runEnrichment() {
    const enableOdds = document.getElementById('enable-odds').checked;
    const enableInjuries = document.getElementById('enable-injuries').checked;
    const enableWeather = document.getElementById('enable-weather').checked;
    const enableClubElo = document.getElementById('enable-clubelo').checked;
    const weatherApiKey = document.getElementById('weather-api-key').value.trim();
    const clubeloDays = parseInt(document.getElementById('clubelo-days').value) || 7;

    const statusDiv = document.getElementById('enrichment-status');
    const progressDiv = document.getElementById('enrichment-progress');
    const enrichBtn = document.getElementById('enrich-data-btn');

    // Validation
    if (!enableOdds && !enableInjuries && !enableWeather && !enableClubElo) {
        showEnrichmentStatus('⚠️ Please select at least one data source', 'warning');
        return;
    }

    if (enableWeather && !weatherApiKey) {
        showEnrichmentStatus('⚠️ Please enter your OpenWeatherMap API key', 'warning');
        return;
    }

    try {
        // Save API key for future use
        if (weatherApiKey) {
            chrome.storage.local.set({ weatherApiKey: weatherApiKey });
        }

        // Disable button
        enrichBtn.disabled = true;
        enrichBtn.textContent = '⏳ Enriching...';

        // Show progress
        progressDiv.style.display = 'block';
        statusDiv.style.display = 'none';

        // Create enrichment processor
        const processor = new window.EnrichmentProcessor();

        // Define leagues to process (matching common leagues in both systems)
        const leagues = [
            'Premier League',
            'Championship',
            'League One',
            'League Two',
            'Bundesliga',
            '2. Bundesliga',
            'La Liga',
            'Segunda Division',
            'Serie A',
            'Serie B',
            'Ligue 1',
            'Ligue 2',
            'Eredivisie',
            'Belgian Pro League',
            'Super Lig',
            'Scottish Premiership',
            'Primeira Liga',
            'Austrian Bundesliga',
            'Greek Super League',
            'MLS',
            'Brasileirao Serie A',
            'Argentine Primera Division',
            'J1 League'
        ];

        // For weather: we'd need fixtures data
        // For now, we'll pass empty array (weather only works if you have fixtures)
        const fixtures = []; // TODO: Load from FBref data if available

        // Listen for status updates
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'enrichmentStatus') {
                updateEnrichmentProgress(message.message, message.progress);
            }
        });

        // Run enrichment
        console.log('🚀 Starting enrichment with options:', {
            enableOdds,
            enableInjuries,
            enableWeather,
            enableClubElo,
            clubeloDays,
            leagues: leagues.length
        });

        const results = await processor.processEnrichment({
            enableOdds,
            enableInjuries,
            enableWeather,
            enableClubElo,
            clubeloDays,
            weatherApiKey,
            leagues,
            fixtures
        });

        console.log('✅ Enrichment completed! Results:', results);

        // Show success
        progressDiv.style.display = 'none';

        // Check if any data was collected
        const summary = getEnrichmentSummary(results);
        if (summary === '') {
            showEnrichmentStatus(
                '⚠️ Enrichment complete but no data collected. Check console for details.',
                'warning'
            );
        } else {
            showEnrichmentStatus(
                `✅ Enrichment complete! Added ${summary}`,
                'success'
            );
        }

        // Log results for debugging
        console.log('Full Enrichment Results:', JSON.stringify(results, null, 2));
        console.log(processor.getSummaryText());

        // Store results in extension storage for batch processor to use
        chrome.storage.local.set({ enrichmentData: results });

        // Re-enable button
        enrichBtn.disabled = false;
        enrichBtn.textContent = '✨ Enrich Current Data';

    } catch (error) {
        console.error('❌ Enrichment error:', error);
        console.error('Error stack:', error.stack);
        progressDiv.style.display = 'none';
        showEnrichmentStatus(`❌ Error: ${error.message}`, 'error');

        enrichBtn.disabled = false;
        enrichBtn.textContent = '✨ Enrich Current Data';
    }
}

function updateEnrichmentProgress(message, progress) {
    const progressText = document.getElementById('progress-text');
    const progressPercent = document.getElementById('progress-percent');
    const progressBar = document.getElementById('progress-bar');

    if (progressText) progressText.textContent = message;
    if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;
}

function showEnrichmentStatus(message, type) {
    const statusDiv = document.getElementById('enrichment-status');
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;

    // Set colors based on type
    if (type === 'success') {
        statusDiv.style.background = '#d4edda';
        statusDiv.style.color = '#155724';
        statusDiv.style.border = '2px solid #c3e6cb';
    } else if (type === 'error') {
        statusDiv.style.background = '#f8d7da';
        statusDiv.style.color = '#721c24';
        statusDiv.style.border = '2px solid #f5c6cb';
    } else if (type === 'warning') {
        statusDiv.style.background = '#fff3cd';
        statusDiv.style.color = '#856404';
        statusDiv.style.border = '2px solid #ffc107';
    }

    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 10000);
    }
}

function getEnrichmentSummary(results) {
    const parts = [];

    if (results.odds) {
        parts.push(`${results.odds.summary.totalMatches} odds`);
    }
    if (results.injuries) {
        parts.push(`${results.injuries.summary.totalInjuries} injuries`);
    }
    if (results.weather) {
        parts.push(`${results.weather.count} forecasts`);
    }
    if (results.clubelo) {
        parts.push(`${results.clubelo.count} fixtures`);
    }

    return parts.join(', ');
}

// =============================================================================
// BACKEND TAB — PredictIQ Connection & Auth
// =============================================================================

function initBackendTab() {
    // Elements will be created dynamically on first open
    refreshBackendTab();
}

async function refreshBackendTab() {
    const tab = document.getElementById('tab-backend');
    if (!tab) return;

    // Load stored user
    const { predictiq_user: user, predictiq_token: token } = await new Promise(resolve =>
        chrome.storage.local.get(['predictiq_user', 'predictiq_token'], resolve)
    );

    // Check live connection
    const bs = window.backendSync;
    const isOnline = bs ? bs.isOnline : false;
    const statusColor = isOnline ? '#3fb950' : '#f85149';
    const statusText = isOnline ? '● Connected' : '● Offline';

    if (user && token) {
        // Logged in view
        tab.innerHTML = `
            <div style="padding:12px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                    <span style="color:${statusColor};font-weight:700;font-size:12px">${statusText}</span>
                    <span style="color:#8b949e;font-size:11px">${bs ? bs.backendUrl : 'http://localhost:4000'}</span>
                </div>
                <div style="background:#1c2230;border:1px solid #30363d;border-radius:8px;padding:12px;margin-bottom:12px">
                    <div style="font-size:11px;color:#8b949e;margin-bottom:2px">Signed in as</div>
                    <div style="font-weight:700;font-size:13px">${user.email}</div>
                    <div style="font-size:10px;color:#bc8cff;margin-top:2px">
                        ${user.role === 'admin' ? '👑 Admin' : '👤 User'}
                    </div>
                </div>
                <div style="margin-bottom:12px">
                    <div style="font-size:11px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Generate Predictions</div>
                    <div id="backend-leagues-list" style="display:flex;flex-direction:column;gap:6px">
                        <div style="color:#484f58;font-size:12px">Loading leagues…</div>
                    </div>
                </div>
                <button id="backend-logout-btn" style="width:100%;padding:8px;background:rgba(248,81,73,.12);color:#f85149;border:1px solid #f85149;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
                    Sign Out
                </button>
            </div>
        `;

        document.getElementById('backend-logout-btn').addEventListener('click', () => {
            if (window.backendSync) window.backendSync.logout();
            refreshBackendTab();
        });

        // Load leagues list
        loadBackendLeagues();

    } else {
        // Login view
        tab.innerHTML = `
            <div style="padding:12px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                    <span style="color:${statusColor};font-weight:700;font-size:12px">${statusText}</span>
                    <span style="color:#8b949e;font-size:11px">${bs ? bs.backendUrl : 'http://localhost:4000'}</span>
                </div>
                <div id="backend-login-error" style="display:none;background:rgba(248,81,73,.12);border:1px solid #f85149;border-radius:6px;padding:8px;margin-bottom:10px;font-size:12px;color:#f85149"></div>
                <div style="margin-bottom:10px">
                    <label style="display:block;font-size:10px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Email</label>
                    <input id="backend-email" type="email" value="admin@prediction.local"
                        style="width:100%;padding:7px 10px;background:#0d1117;border:1px solid #30363d;color:#e6edf3;border-radius:6px;font-size:12px" />
                </div>
                <div style="margin-bottom:12px">
                    <label style="display:block;font-size:10px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Password</label>
                    <input id="backend-password" type="password" value="Admin@2026"
                        style="width:100%;padding:7px 10px;background:#0d1117;border:1px solid #30363d;color:#e6edf3;border-radius:6px;font-size:12px" />
                </div>
                <button id="backend-login-btn" style="width:100%;padding:9px;background:#1f6feb;color:white;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">
                    Sign In to PredictIQ
                </button>
                <div style="margin-top:10px;font-size:11px;color:#484f58;text-align:center">
                    Backend must be running at localhost:4000
                </div>
            </div>
        `;

        document.getElementById('backend-login-btn').addEventListener('click', async () => {
            const btn = document.getElementById('backend-login-btn');
            const errDiv = document.getElementById('backend-login-error');
            const email = document.getElementById('backend-email').value.trim();
            const password = document.getElementById('backend-password').value;

            btn.disabled = true;
            btn.textContent = 'Signing in…';
            errDiv.style.display = 'none';

            const bs = window.backendSync;
            if (!bs) {
                errDiv.textContent = 'BackendSync not loaded. Reload extension.';
                errDiv.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Sign In to PredictIQ';
                return;
            }

            const result = await bs.login(email, password);
            if (result.success) {
                refreshBackendTab();
            } else {
                errDiv.textContent = result.error || 'Login failed';
                errDiv.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Sign In to PredictIQ';
            }
        });
    }
}

async function loadBackendLeagues() {
    const listEl = document.getElementById('backend-leagues-list');
    if (!listEl) return;

    const bs = window.backendSync;
    if (!bs || !bs.isOnline) {
        listEl.innerHTML = '<div style="color:#484f58;font-size:12px">Backend offline — start the server first</div>';
        return;
    }

    try {
        const res = await fetch(`${bs.backendUrl}/api/leagues`, {
            headers: bs._authHeaders()
        });
        const json = await res.json();
        const leagues = Array.isArray(json) ? json : (json.leagues || []);

        if (!leagues.length) {
            listEl.innerHTML = '<div style="color:#484f58;font-size:12px">No leagues yet — sync FBref data first</div>';
            return;
        }

        listEl.innerHTML = '';
        leagues.forEach(l => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px';
            row.innerHTML = `
                <span style="font-size:12px;font-weight:600;flex:1">${l.name}</span>
                <button data-league-id="${l.id}" data-league-name="${l.name}" class="gen-btn"
                    style="padding:4px 10px;background:#1f6feb;color:white;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">
                    Predict
                </button>
            `;
            listEl.appendChild(row);
        });

        listEl.querySelectorAll('.gen-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const leagueId = btn.getAttribute('data-league-id');
                const leagueName = btn.getAttribute('data-league-name');
                btn.disabled = true;
                btn.textContent = '⏳';
                const fixtures = await bs.getFixtures(leagueId);
                if (!fixtures.length) {
                    btn.textContent = '0 fixtures';
                    setTimeout(() => { btn.textContent = 'Predict'; btn.disabled = false; }, 3000);
                    return;
                }
                let count = 0;
                for (const f of fixtures) {
                    const pred = await bs.predictMatch(f.home_team_id, f.away_team_id, f.league_id, f.season_id);
                    if (pred && !pred.error && !pred.detail) {
                        count++;
                        bs.recordPrediction({
                            match_id: f.id, home_team: f.home_team, away_team: f.away_team,
                            league: f.league, match_date: f.match_date,
                            predicted: pred.predicted_outcome, confidence: pred.confidence,
                            confidence_score: pred.confidence_score,
                            home_win_prob: pred.probabilities?.home_win,
                            draw_prob: pred.probabilities?.draw,
                            away_win_prob: pred.probabilities?.away_win,
                        });
                    }
                }
                btn.textContent = `✅ ${count}`;
                setTimeout(() => { btn.textContent = 'Predict'; btn.disabled = false; }, 4000);
            });
        });

    } catch (err) {
        listEl.innerHTML = `<div style="color:#f85149;font-size:12px">Error: ${err.message}</div>`;
    }
}

