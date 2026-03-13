// Batch Processor JavaScript - ENHANCED VERSION
// Handles sequential processing with league selection and incremental processing

let urls = [];
let allData = []; // Stores ALL processed data (across multiple runs)
let currentIndex = 0;
let isPaused = false;
let isStopped = false;
let failedUrls = [];
let processedLeagues = new Set(); // Track which leagues have been processed
let selectedLeagues = new Set(); // Track which leagues are selected
let leagueGroups = {}; // Group URLs by league

// Timer variables
let startTime = null;
let timerInterval = null;
let urlStartTimes = [];  // Track start time for each URL

// UI Elements
let loadUrlsBtn, startBtn, pauseBtn, resumeBtn, stopBtn, downloadBtn, syncBackendBtn;
let totalUrlsEl, completedUrlsEl, failedUrlsEl, remainingUrlsEl;
let progressBar, currentUrlEl, statusEl, urlInfoEl;
let errorListContainer, errorList;
let leagueSelectionContainer, leagueCheckboxesContainer;
let selectAllBtn, deselectAllBtn, processedCountEl, selectedCountEl;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Get UI elements
    loadUrlsBtn = document.getElementById('loadUrlsBtn');
    startBtn = document.getElementById('startBtn');
    pauseBtn = document.getElementById('pauseBtn');
    resumeBtn = document.getElementById('resumeBtn');
    stopBtn = document.getElementById('stopBtn');
    downloadBtn = document.getElementById('downloadBtn');

    totalUrlsEl = document.getElementById('totalUrls');
    completedUrlsEl = document.getElementById('completedUrls');
    failedUrlsEl = document.getElementById('failedUrls');
    remainingUrlsEl = document.getElementById('remainingUrls');

    progressBar = document.getElementById('progressBar');
    currentUrlEl = document.getElementById('currentUrl');
    statusEl = document.getElementById('status');
    urlInfoEl = document.getElementById('urlInfo');

    errorListContainer = document.getElementById('errorListContainer');
    errorList = document.getElementById('errorList');

    leagueSelectionContainer = document.getElementById('leagueSelectionContainer');
    leagueCheckboxesContainer = document.getElementById('leagueCheckboxes');
    selectAllBtn = document.getElementById('selectAllBtn');
    deselectAllBtn = document.getElementById('deselectAllBtn');
    processedCountEl = document.getElementById('processedCount');
    selectedCountEl = document.getElementById('selectedCount');
    syncBackendBtn = document.getElementById('syncBackendBtn');

    // Timer elements
    timerContainer = document.getElementById('timer-container');
    staticTimer = document.getElementById('static-timer');
    timerElapsed = document.getElementById('timer-elapsed');
    timerAvg = document.getElementById('timer-avg');
    timerRemaining = document.getElementById('timer-remaining');
    timerCompletion = document.getElementById('timer-completion');
    totalTimeEstimate = document.getElementById('total-time-estimate');

    // Event listeners
    loadUrlsBtn.addEventListener('click', loadUrls);
    startBtn.addEventListener('click', startProcessing);
    pauseBtn.addEventListener('click', pauseProcessing);
    resumeBtn.addEventListener('click', resumeProcessing);
    stopBtn.addEventListener('click', stopProcessing);
    downloadBtn.addEventListener('click', downloadAllData);
    syncBackendBtn.addEventListener('click', syncToBackend);
    selectAllBtn.addEventListener('click', () => toggleAllLeagues(true));
    deselectAllBtn.addEventListener('click', () => toggleAllLeagues(false));

    // Wire up clear button if it exists in the HTML
    const clearBtn = document.getElementById('clearDataBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearSavedData);

    // Wire up "Check Sync Status" button
    const checkStatusBtn = document.getElementById('checkStatusBtn');
    if (checkStatusBtn) checkStatusBtn.addEventListener('click', loadSyncStatus);

    // ── Feature 1: Restore scraped data from previous session (IndexedDB) ──────
    try {
        // Wait for IndexedDB to be ready (it auto-initialises in indexeddb_manager.js)
        await new Promise(resolve => setTimeout(resolve, 300));
        const saved = await dbManager.getAllScrapedData();
        if (saved && saved.length > 0) {
            allData = saved.map(entry => entry.data || entry); // entry = { url, league, data, timestamp }
            completedUrlsEl.textContent = allData.length;
            downloadBtn.disabled = false;
            syncBackendBtn.disabled = false;
            statusEl.style.display = 'block';
            statusEl.className = 'success';
            statusEl.textContent = `♻️ Restored ${allData.length} datasets from previous session (IndexedDB). Ready to sync or download.`;
            urlInfoEl.style.display = 'block';
            urlInfoEl.textContent = `♻️ ${allData.length} datasets in memory (from last session)`;
            console.log(`♻️ Restored ${allData.length} datasets from IndexedDB`);
        }
    } catch (e) {
        console.warn('⚠️ Could not restore from IndexedDB:', e.message);
    }
});

// ── Feature 1: Clear all persisted data (IndexedDB) ─────────────────────────
async function clearSavedData() {
    if (!confirm('Clear all saved session data? This cannot be undone.')) return;
    allData = [];
    processedLeagues.clear();
    try {
        await dbManager.clearScrapedData();
        await chrome.storage.local.remove(['syncStatus']);
    } catch (e) { }
    completedUrlsEl.textContent = 0;
    downloadBtn.disabled = true;
    syncBackendBtn.disabled = true;
    statusEl.style.display = 'block';
    statusEl.className = 'info';
    statusEl.textContent = '🗑 Saved data cleared. Ready for a fresh session.';
    urlInfoEl.style.display = 'none';
    console.log('🗑 IndexedDB scraped data cleared');
}

async function loadUrls() {
    try {
        statusEl.style.display = 'block';
        statusEl.className = 'info';
        statusEl.textContent = '⏳ Loading URLs from storage...';

        // Use URLManager class (same as URLs tab)
        urls = await window.URLManager.loadURLs();

        if (!urls || urls.length === 0) {
            throw new Error('No URLs found! Please reset to defaults in the URLs tab.');
        }

        // Group URLs by league
        groupUrlsByLeague();

        // Update UI
        totalUrlsEl.textContent = urls.length;
        remainingUrlsEl.textContent = urls.length;

        urlInfoEl.style.display = 'block';
        urlInfoEl.textContent = `✅ Loaded ${urls.length} URLs from storage`;

        statusEl.className = 'success';
        statusEl.textContent = `✅ Successfully loaded ${urls.length} URLs (${Object.keys(leagueGroups).length} leagues)`;

        // Show league selection
        renderLeagueSelection();

        // Check for existing enrichment data
        checkEnrichmentData();

        // Update static estimate when URLs are loaded
        setTimeout(() => {
            const totalUrls = parseInt(totalUrlsEl.textContent) || 0;
            if (totalUrls > 0) {
                updateStaticEstimate(totalUrls);
            }
        }, 500);

        console.log('✅ Batch Processor initialized');
        console.log('Using Enhanced Excel Download Module');
        console.log(`✅ Loaded ${urls.length} URLs:`, urls);

    } catch (error) {
        statusEl.className = 'error';
        statusEl.textContent = `❌ Error: ${error.message}`;
        console.error('Load URLs error:', error);
    }
}

function groupUrlsByLeague() {
    leagueGroups = {};

    urls.forEach((url, index) => {
        const league = url.league || 'Unknown League';

        if (!leagueGroups[league]) {
            leagueGroups[league] = {
                name: league,
                urls: [],
                types: []
            };
        }

        leagueGroups[league].urls.push({ ...url, originalIndex: index });
        leagueGroups[league].types.push(url.type || 'unknown');
    });

    console.log('League groups:', leagueGroups);
}

function renderLeagueSelection() {
    leagueSelectionContainer.style.display = 'block';
    leagueCheckboxesContainer.innerHTML = '';

    // Sort leagues alphabetically
    const sortedLeagues = Object.keys(leagueGroups).sort();

    sortedLeagues.forEach(leagueName => {
        const league = leagueGroups[leagueName];
        const isProcessed = processedLeagues.has(leagueName);

        const checkbox = document.createElement('div');
        checkbox.className = 'league-checkbox';
        checkbox.innerHTML = `
            <label>
                <input type="checkbox" 
                       value="${leagueName}" 
                       ${isProcessed ? 'disabled' : ''}>
                <span>${leagueName}</span>
                <span class="league-meta">(${league.urls.length} URLs)${isProcessed ? ' <span class="processed-badge">✅ Processed</span>' : ''}</span>
            </label>
        `;

        leagueCheckboxesContainer.appendChild(checkbox);

        // Get the checkbox input and add event listener properly
        const input = checkbox.querySelector('input');

        // Add event listener via JavaScript (more reliable than inline HTML)
        input.addEventListener('change', updateSelectedCount);

        // Auto-select if not processed
        if (!isProcessed) {
            selectedLeagues.add(leagueName);
            input.checked = true;
        }
    });

    updateSelectedCount();
}

function updateSelectedCount() {
    // Update selected leagues set
    selectedLeagues.clear();
    const checkboxes = leagueCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)');
    checkboxes.forEach(cb => selectedLeagues.add(cb.value));

    // Count URLs for selected leagues
    let selectedUrlCount = 0;
    selectedLeagues.forEach(league => {
        selectedUrlCount += leagueGroups[league].urls.length;
    });

    // Update UI
    processedCountEl.textContent = processedLeagues.size;
    selectedCountEl.textContent = selectedLeagues.size;

    // Enable start button if leagues selected
    startBtn.disabled = selectedLeagues.size === 0;

    console.log(`Selected: ${selectedLeagues.size} leagues, ${selectedUrlCount} URLs`);
}

function toggleAllLeagues(select) {
    const checkboxes = leagueCheckboxesContainer.querySelectorAll('input[type="checkbox"]:not(:disabled)');
    checkboxes.forEach(cb => {
        cb.checked = select;
    });
    updateSelectedCount();
}

async function startProcessing() {
    // Get URLs for selected leagues only
    const urlsToProcess = [];
    selectedLeagues.forEach(league => {
        leagueGroups[league].urls.forEach(url => {
            urlsToProcess.push(url);
        });
    });

    if (urlsToProcess.length === 0) {
        statusEl.className = 'error';
        statusEl.textContent = '❌ No leagues selected!';
        return;
    }

    // Reset state for this batch
    currentIndex = 0;
    isPaused = false;
    isStopped = false;
    const batchData = [];
    const batchFailedUrls = [];

    completedUrlsEl.textContent = allData.length;
    failedUrlsEl.textContent = failedUrls.length;
    remainingUrlsEl.textContent = urlsToProcess.length;
    errorListContainer.style.display = 'none';
    errorList.innerHTML = '';

    // Update buttons
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    loadUrlsBtn.disabled = true;
    downloadBtn.disabled = true;

    statusEl.style.display = 'block';
    statusEl.className = 'info';
    statusEl.textContent = `🚀 Processing ${urlsToProcess.length} URLs from ${selectedLeagues.size} leagues...`;

    // Start timer
    startTimer();

    console.log(`🚀 Starting batch processing of ${urlsToProcess.length} URLs...`);

    // Process URLs
    await processUrls(urlsToProcess, batchData, batchFailedUrls);

    // Mark selected leagues as processed
    selectedLeagues.forEach(league => processedLeagues.add(league));

    // Update UI to show processed leagues
    renderLeagueSelection();

    // Stop timer - processing complete
    stopTimer();

    // Enable download button
    downloadBtn.disabled = false;
}

// ─── Parallel URL processor ───────────────────────────────────────────────────
// CONCURRENCY controls how many FBref tabs are open simultaneously.
// 3 is a safe sweet-spot: fast enough to see a real speedup, low enough
// that FBref doesn't rate-limit us and Chrome stays responsive.
const CONCURRENCY = 3;

async function processUrls(urlsToProcess, batchData, batchFailedUrls) {
    // Shared index — each worker atomically claims the next URL
    let nextIndex = 0;
    let completedCount = 0;
    const total = urlsToProcess.length;

    // Single worker: keeps grabbing the next unclaimed URL until all done
    async function worker() {
        while (true) {
            // ── Pause handling ──────────────────────────────────────────────
            if (isPaused) {
                statusEl.className = 'info';
                statusEl.textContent = '⏸ Processing paused. Click Resume to continue.';
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'inline-block';
                resumeBtn.disabled = false;
                // Poll until resumed or stopped
                while (isPaused && !isStopped) await sleep(200);
                if (!isPaused) {
                    resumeBtn.style.display = 'none';
                    pauseBtn.style.display = 'inline-block';
                    pauseBtn.disabled = false;
                }
            }

            if (isStopped) return;

            // ── Claim next URL ───────────────────────────────────────────────
            const i = nextIndex++;
            if (i >= total) return; // All URLs claimed

            const url = urlsToProcess[i];
            const urlNumber = i + 1;

            // Update status (non-blocking, best-effort)
            statusEl.className = 'info';
            statusEl.textContent = `⚡ Processing ${completedCount}/${total} done — active workers: ${Math.min(CONCURRENCY, total - i)} tabs open`;
            console.log(`[${urlNumber}/${total}] Processing: ${url.name} (${url.url})`);

            try {
                // Open tab in background
                const tab = await chrome.tabs.create({ url: url.url, active: false });
                console.log(`  → Created tab ${tab.id} for ${url.name}`);

                // Wait for FBref to finish loading
                await waitForTabLoad(tab.id);
                console.log(`  → Tab ${tab.id} loaded, extracting data...`);

                // Scrape the page
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content_scraper.js']
                });

                if (results && results[0] && results[0].result) {
                    const data = results[0].result;
                    if (data.error) throw new Error(data.error);

                    data.leagueName = url.league;
                    data.urlName = url.name;

                    // JS arrays are single-threaded — no lock needed
                    batchData.push(data);
                    allData.push(data);

                    // ── Feature 1: Persist to IndexedDB (no 5MB quota limit) ──
                    dbManager.saveScrapedData(url.url, url.league, data)
                        .catch(e => console.warn('⚠️ IndexedDB save failed:', e.message));

                    // Keep lightweight metadata in chrome.storage.local (just counts, no raw data)
                    chrome.storage.local.set({
                        syncStatus: {
                            count: allData.length,
                            lastUpdated: new Date().toISOString(),
                            leagues: Array.from(processedLeagues)
                        }
                    }).catch(() => { });

                    // ── Feature 2: Pipeline sync — fire-and-forget to Railway ───
                    // Runs in background; does NOT block next URL from starting.
                    if (window.backendSync) {
                        const lgName = url.league || data.leagueName || 'Unknown';
                        const season = data.season || '2025-2026';
                        if (data.tables && data.tables.length > 0) {
                            window.backendSync.checkHealth()
                                .then(health => {
                                    if (!health?.healthy) return null;
                                    return window.backendSync.syncAll({
                                        league: lgName, season, tables: data.tables, team_logos: data.team_logos
                                    });
                                })
                                .then(result => {
                                    if (result?.success) {
                                        console.log(`☁️ Pipeline synced: ${lgName} → fixtures=${result.fixtures_inserted ?? 0} players=${result.players_inserted ?? 0} standings=${result.standings_inserted ?? 0}`);
                                    }
                                })
                                .catch(e => console.warn(`⚠️ Pipeline sync skipped for ${lgName}:`, e.message));
                        }
                    }

                    completedCount++;
                    completedUrlsEl.textContent = allData.length;
                    remainingUrlsEl.textContent = total - completedCount;
                    updateProgress(completedCount, total);

                    console.log(`✅ [${urlNumber}/${total}] Success: ${url.name} - ${data.tables.length} tables`);
                } else {
                    throw new Error('No data returned from scraper');
                }

                // Close the tab
                await chrome.tabs.remove(tab.id);
                await sleep(100); // Reduced: was 500ms

            } catch (error) {
                console.error(`❌ [${urlNumber}/${total}] Failed: ${url.name}:`, error);
                const failedUrl = { name: url.name, url: url.url, error: error.message };
                batchFailedUrls.push(failedUrl);
                failedUrls.push(failedUrl);
                failedUrlsEl.textContent = failedUrls.length;
                updateErrorList();
            }

            // Short inter-URL pause per worker — avoids hammering FBref
            await sleep(200); // Reduced: was 1000ms
        }
    }

    // Launch CONCURRENCY workers in parallel and wait for all to finish
    currentUrlEl.style.display = 'block';
    currentUrlEl.textContent = `⚡ Running ${Math.min(CONCURRENCY, total)} parallel workers...`;

    const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker());
    await Promise.all(workers);

    // ── All done ────────────────────────────────────────────────────────────
    currentUrlEl.style.display = 'none';

    if (batchData.length === 0) {
        statusEl.className = 'error';
        statusEl.textContent = '❌ No data extracted! All URLs failed.';
        resetButtons();
        return;
    }

    statusEl.className = 'success';
    statusEl.textContent = `✅ Complete! Processed ${batchData.length}/${total} URLs successfully.`;
    if (batchFailedUrls.length > 0) {
        statusEl.textContent += ` (${batchFailedUrls.length} failed — see below)`;
    }

    resetButtons();
}

async function downloadAllData() {
    if (allData.length === 0) {
        statusEl.className = 'error';
        statusEl.textContent = '❌ No data to download! Process some leagues first.';
        return;
    }

    statusEl.className = 'info';
    statusEl.textContent = '⏳ Generating Excel file with all processed data...';

    console.log(`📊 Generating Excel with ${allData.length} datasets...`);

    try {
        // Generate base Excel with FBref data
        let workbook = window.ExcelGenerator.generateCombinedExcel(allData, {
            filename: 'Football_Data_All_Leagues.xlsx',
            includeMetadata: true,
            combineByleague: true
        });

        // Check for enrichment data in storage
        const { enrichmentData } = await chrome.storage.local.get(['enrichmentData']);

        if (enrichmentData) {
            console.log('📊 Adding enrichment data to Excel...');
            statusEl.textContent = '⏳ Adding enrichment data (odds, injuries, weather, ClubElo)...';

            // Convert blob to workbook
            const arrayBuffer = await workbook.arrayBuffer();
            const wb = XLSX.read(arrayBuffer, { type: 'array' });

            // Add enrichment sheets
            window.ExcelGenerator.addEnrichmentSheets(wb, enrichmentData);

            // Convert back to blob
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            workbook = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            console.log('✅ Enrichment sheets added!');
        } else {
            console.log('ℹ️  No enrichment data found. Use Data+ tab to enrich.');
        }

        // Download enhanced Excel
        window.ExcelDownloadEnhanced.downloadExcelWithDialog(workbook, 'Football_Data_All_Leagues.xlsx');

        // Create success message
        let successMsg = `✅ Excel downloaded! ${allData.length} datasets from ${processedLeagues.size} leagues`;
        if (enrichmentData) {
            const enrichCount = [];
            if (enrichmentData.odds?.summary?.totalMatches) {
                enrichCount.push(`${enrichmentData.odds.summary.totalMatches} odds`);
            }
            if (enrichmentData.injuries?.summary?.totalInjuries) {
                enrichCount.push(`${enrichmentData.injuries.summary.totalInjuries} injuries`);
            }
            if (enrichmentData.weather?.count) {
                enrichCount.push(`${enrichmentData.weather.count} forecasts`);
            }
            if (enrichmentData.clubelo?.count) {
                enrichCount.push(`${enrichmentData.clubelo.count} fixtures`);
            }
            if (enrichCount.length > 0) {
                successMsg += ` + ${enrichCount.join(', ')}`;
            }
        }

        statusEl.className = 'success';
        statusEl.textContent = successMsg;

        console.log(`✅ Excel generation complete!`);

    } catch (error) {
        statusEl.className = 'error';
        statusEl.textContent = `❌ Error generating Excel: ${error.message}`;
        console.error('Excel generation error:', error);
    }
}

function updateProgress(current, total) {
    const percentage = Math.round((current / total) * 100);
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${percentage}%`;
}

function updateErrorList() {
    if (failedUrls.length > 0) {
        errorListContainer.style.display = 'block';
        errorList.innerHTML = '';

        failedUrls.forEach(failed => {
            const li = document.createElement('li');
            li.textContent = `${failed.name}: ${failed.error}`;
            errorList.appendChild(li);
        });
    }
}

function pauseProcessing() {
    isPaused = true;
    stopTimer(); // Pause timer
    console.log('⏸ Processing paused');
}

function resumeProcessing() {
    isPaused = false;
    resumeBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.disabled = false;

    startTimer(); // Resume timer

    console.log('▶ Processing resumed');

    // Continue processing (will resume in loop)
}

function stopProcessing() {
    isStopped = true;
    resetTimer(); // Stop and reset timer
    console.log('⏹ Processing stopped');
}

function resetButtons() {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resumeBtn.style.display = 'none';
    stopBtn.disabled = true;

    // Enable download and sync if we have data
    if (allData && allData.length > 0) {
        downloadBtn.disabled = false;
        syncBackendBtn.disabled = false;
    } else {
        downloadBtn.disabled = true;
        syncBackendBtn.disabled = true;
    }

    pauseBtn.style.display = 'inline-block';
    loadUrlsBtn.disabled = false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForTabLoad(tabId) {
    return new Promise((resolve) => {
        const checkComplete = (details) => {
            if (details.tabId === tabId && details.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(checkComplete);
                // 500ms buffer for dynamic content (was 2000ms — FBref tables are SSR)
                setTimeout(() => resolve(), 500);
            }
        };

        chrome.tabs.onUpdated.addListener(checkComplete);

        // Hard timeout: 30 seconds is reasonable for FBref
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(checkComplete);
            resolve();
        }, 30000);
    });
}

// Check for enrichment data in storage and display status
async function checkEnrichmentData() {
    const enrichmentInfoEl = document.getElementById('enrichmentInfo');
    const enrichmentDetailsEl = document.getElementById('enrichmentDetails');

    try {
        const { enrichmentData } = await chrome.storage.local.get(['enrichmentData']);

        if (enrichmentData) {
            const details = [];

            if (enrichmentData.odds?.summary) {
                details.push(`✅ <strong>${enrichmentData.odds.summary.totalMatches || 0}</strong> matches with odds`);
            }

            if (enrichmentData.injuries?.summary) {
                details.push(`✅ <strong>${enrichmentData.injuries.summary.totalInjuries || 0}</strong> injuries/suspensions`);
            }

            if (enrichmentData.weather?.count) {
                details.push(`✅ <strong>${enrichmentData.weather.count}</strong> weather forecasts`);
            }

            if (details.length > 0) {
                enrichmentDetailsEl.innerHTML = details.join('<br>');
                enrichmentInfoEl.style.display = 'block';
                enrichmentInfoEl.style.background = '#d4edda';
                enrichmentInfoEl.style.color = '#155724';
                enrichmentInfoEl.style.border = '2px solid #c3e6cb';

                console.log('📊 Enrichment data will be added to Excel:', enrichmentData);
            } else {
                showNoEnrichmentMessage();
            }
        } else {
            showNoEnrichmentMessage();
        }
    } catch (error) {
        console.error('Error checking enrichment data:', error);
    }
}

function showNoEnrichmentMessage() {
    const enrichmentInfoEl = document.getElementById('enrichmentInfo');
    const enrichmentDetailsEl = document.getElementById('enrichmentDetails');

    enrichmentDetailsEl.innerHTML = `
        ℹ️ No enrichment data found<br>
        <span style="font-size: 12px; color: #666;">
            Use the <strong>Data+</strong> tab in the extension popup to collect odds, injuries, and weather data
        </span>
    `;
    enrichmentInfoEl.style.display = 'block';
    enrichmentInfoEl.style.background = '#f8f9fa';
    enrichmentInfoEl.style.color = '#333';
    enrichmentInfoEl.style.border = '2px solid #dee2e6';
}

// =============================================================================
// TIMER FUNCTIONS
// =============================================================================

function startTimer() {
    startTime = Date.now();
    urlStartTimes = [];

    // Show dynamic timer, hide static
    timerContainer.style.display = 'block';
    staticTimer.style.display = 'none';

    // Update timer every second
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer(); // Initial update
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimer() {
    if (!startTime) return;

    const elapsed = Math.floor((Date.now() - startTime) / 1000); // seconds
    const completed = parseInt(completedUrlsEl.textContent) || 0;
    const failed = parseInt(failedUrlsEl.textContent) || 0;
    const remaining = parseInt(remainingUrlsEl.textContent) || 0;

    // Update elapsed time (MM:SS format)
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerElapsed.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Calculate average time per URL (only if we've completed at least one)
    if (completed > 0) {
        const avgSeconds = Math.floor(elapsed / completed);
        const avgMin = Math.floor(avgSeconds / 60);
        const avgSec = avgSeconds % 60;
        timerAvg.textContent = `${avgMin}:${avgSec.toString().padStart(2, '0')}`;

        // Calculate remaining time
        if (remaining > 0) {
            const remainingSeconds = avgSeconds * remaining;
            const remMin = Math.floor(remainingSeconds / 60);
            const remSec = remainingSeconds % 60;
            timerRemaining.textContent = `${remMin}:${remSec.toString().padStart(2, '0')}`;

            // Calculate estimated completion time
            const completionTime = new Date(Date.now() + (remainingSeconds * 1000));
            const hours = completionTime.getHours();
            const mins = completionTime.getMinutes();
            timerCompletion.textContent = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        } else {
            // Processing complete!
            timerRemaining.textContent = '0:00';
            timerCompletion.textContent = 'Complete!';
            stopTimer();
        }
    } else {
        timerAvg.textContent = '--';
        timerRemaining.textContent = '--';
        timerCompletion.textContent = '--';
    }
}

function resetTimer() {
    stopTimer();
    startTime = null;
    urlStartTimes = [];

    // Reset display
    timerElapsed.textContent = '0:00';
    timerAvg.textContent = '--';
    timerRemaining.textContent = '--';
    timerCompletion.textContent = '--';

    // Hide dynamic timer, show static
    timerContainer.style.display = 'none';
    staticTimer.style.display = 'block';
}

function updateStaticEstimate(totalUrls) {
    // Update static timer with total URLs estimate
    const estimatedMinutes = Math.ceil((totalUrls * 30) / 60); // 30 sec per URL
    totalTimeEstimate.textContent = `${totalUrls} URLs ≈ ${estimatedMinutes} minutes total`;
}

// ==============================
// BACKEND SYNC FUNCTIONALITY
// ==============================

async function syncToBackend() {
    if (!allData || allData.length === 0) {
        alert('❌ No data to sync! Please process some leagues first.');
        return;
    }

    if (!window.backendSync) {
        alert('❌ Backend sync module not loaded! Please refresh the page.');
        return;
    }

    const backendStatus = await window.backendSync.checkHealth().catch(() => null);
    if (!backendStatus || !backendStatus.healthy) {
        statusEl.style.display = 'block';
        statusEl.className = 'info';
        statusEl.innerHTML = `ℹ️ <strong>Backend Offline</strong> — Extension works without backend. Backend only needed for predictions.`;
        syncBackendBtn.disabled = true;
        return;
    }

    // Disable button, clear old sync log
    syncBackendBtn.disabled = true;
    const originalText = syncBackendBtn.textContent;
    syncBackendBtn.textContent = '⏳ Syncing...';

    // Show the sync progress panel
    const syncLogEl = document.getElementById('syncLog');
    const syncLogList = document.getElementById('syncLogList');
    const syncProgressBar = document.getElementById('syncProgressBar');
    const syncProgressText = document.getElementById('syncProgressText');
    if (syncLogEl) { syncLogEl.style.display = 'block'; syncLogList.innerHTML = ''; }

    statusEl.style.display = 'block';
    statusEl.className = 'info';
    statusEl.textContent = `☁️ Starting sync of ${allData.length} datasets…`;

    let successCount = 0;
    let failureCount = 0;
    const total = allData.length;

    try {
        for (let i = 0; i < allData.length; i++) {
            const item = allData[i];
            const leagueName = item.leagueName || item.league || 'Unknown League';
            const season = item.season || '2025-2026';
            const pct = Math.round(((i) / total) * 100);

            // Update progress bar
            if (syncProgressBar) {
                syncProgressBar.style.width = pct + '%';
                syncProgressText.textContent = `${i}/${total} done`;
            }
            statusEl.textContent = `☁️ Syncing (${i + 1}/${total}): ${leagueName}…`;

            if (!item.tables || item.tables.length === 0) {
                appendSyncLog(syncLogList, leagueName, null, 'skipped', 'No tables');
                continue;
            }

            try {
                const result = await window.backendSync.syncAll({
                    league: leagueName,
                    season: season,
                    tables: item.tables,
                    team_logos: item.team_logos
                });

                if (result && result.success) {
                    successCount++;
                    const detail = [
                        result.fixtures_inserted ? `${result.fixtures_inserted} fixtures` : '',
                        result.standings_inserted ? `${result.standings_inserted} standings` : '',
                        result.home_away_inserted ? `${result.home_away_inserted} H/A rows` : '',
                        result.players_inserted ? `${result.players_inserted} players` : '',
                        result.stats_inserted ? `${result.stats_inserted} stats` : '',
                    ].filter(Boolean).join(' · ') || 'no new rows';
                    appendSyncLog(syncLogList, leagueName, season, 'success', detail);
                } else {
                    failureCount++;
                    const errMsg = result?.error || result?.detail || 'Unknown error';
                    appendSyncLog(syncLogList, leagueName, season, 'error', errMsg);
                }
            } catch (error) {
                failureCount++;
                appendSyncLog(syncLogList, leagueName, season, 'error', error.message);
            }
        }

        // Final progress bar
        if (syncProgressBar) { syncProgressBar.style.width = '100%'; syncProgressText.textContent = `${total}/${total} done`; }

        if (failureCount === 0) {
            statusEl.className = 'success';
            statusEl.textContent = `✅ Sync complete! ${successCount}/${total} datasets synced.`;
        } else {
            statusEl.className = 'error';
            statusEl.textContent = `⚠️ Done: ${successCount} ok, ${failureCount} failed. See log below.`;
        }

        // Auto-load status from API after sync
        await loadSyncStatus();

    } catch (error) {
        statusEl.className = 'error';
        statusEl.textContent = `❌ Sync failed: ${error.message}`;
    } finally {
        syncBackendBtn.disabled = false;
        syncBackendBtn.textContent = originalText;
    }
}

/** Append one row to the inline sync log */
function appendSyncLog(listEl, league, season, state, detail) {
    if (!listEl) return;
    const icon = state === 'success' ? '✅' : state === 'skipped' ? '⏭' : '❌';
    const li = document.createElement('li');
    li.className = `sync-log-${state}`;
    li.innerHTML = `${icon} <strong>${league}</strong>${season ? ` <span class="sync-season">(${season})</span>` : ''} — <span class="sync-detail">${detail}</span>`;
    listEl.appendChild(li);
    listEl.scrollTop = listEl.scrollHeight; // auto-scroll to latest
}

/** Fetch DB sync status from /api/sync/status and render a summary table */
async function loadSyncStatus() {
    const statusTableEl = document.getElementById('syncStatusTable');
    const statusTableBody = document.getElementById('syncStatusBody');
    const checkStatusBtn = document.getElementById('checkStatusBtn');
    if (!statusTableEl) return;

    if (checkStatusBtn) checkStatusBtn.textContent = '⏳ Loading…';
    statusTableEl.style.display = 'block';
    statusTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#666;">Loading from database…</td></tr>';

    try {
        const res = await fetch(`${window.backendSync.backendUrl}/api/sync/status`);
        const data = await res.json();

        if (!data.success || !data.leagues) {
            statusTableBody.innerHTML = '<tr><td colspan="6" style="color:red;">Failed to load status</td></tr>';
            return;
        }

        if (data.leagues.length === 0) {
            statusTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">No sync data found — sync to backend first</td></tr>';
            return;
        }

        statusTableBody.innerHTML = '';
        data.leagues.forEach(lg => {
            const live = lg.live || {};
            const lastEntry = (lg.log || []).sort((a, b) => (b.last_sync || '') > (a.last_sync || '') ? 1 : -1)[0];
            const lastSync = lastEntry?.last_sync
                ? new Date(lastEntry.last_sync).toLocaleString()
                : '—';
            const fixtures = live.fixtures ?? '—';
            const haRows = live.home_away_rows ?? '—';
            const standingsRows = live.standings_rows ?? '—';

            const statusClass = live.fixtures > 0 ? 'synced' : 'not-synced';
            const tr = document.createElement('tr');
            tr.className = statusClass;
            tr.innerHTML = `
                <td><strong>${lg.league}</strong></td>
                <td>${lg.season || '—'}</td>
                <td>${fixtures}</td>
                <td>${haRows}</td>
                <td>${standingsRows}</td>
                <td style="font-size:12px;">${lastSync}</td>
            `;
            statusTableBody.appendChild(tr);
        });
    } catch (e) {
        statusTableBody.innerHTML = `<tr><td colspan="6" style="color:red;">Error: ${e.message}</td></tr>`;
    } finally {
        if (checkStatusBtn) checkStatusBtn.textContent = '🔍 Refresh Status';
    }
}

