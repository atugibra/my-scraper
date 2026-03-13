/**
 * Predictions Tab UI Logic
 * Handles prediction generation, display, and export
 */

document.addEventListener('DOMContentLoaded', () => {
    initPredictionsTab();
});

function initPredictionsTab() {
    const generateBtn = document.getElementById('generate-predictions-btn');
    const exportBtn = document.getElementById('export-predictions-btn');
    const leagueSelector = document.getElementById('league-selector');

    // Listen for backend status changes
    window.addEventListener('backend-status-changed', (event) => {
        handleBackendStatusChange(event.detail.isOnline);
    });

    // Check initial backend status immediately
    if (window.backendSync) {
        // Check if backend is online now
        const isOnline = window.backendSync.isOnline;
        console.log('Initial backend status:', isOnline ? 'online' : 'offline');
        handleBackendStatusChange(isOnline);

        // Also do a fresh health check
        window.backendSync.checkHealth().then(result => {
            const healthy = result && result.healthy;
            console.log('Health check result:', result);
            handleBackendStatusChange(healthy);
        });
    } else {
        console.warn('⚠️ backendSync not yet loaded, will retry...');
        // Retry after a delay if backendSync isn't loaded yet
        setTimeout(() => {
            if (window.backendSync) {
                const isOnline = window.backendSync.isOnline;
                handleBackendStatusChange(isOnline);
                window.backendSync.checkHealth().then(result => {
                    handleBackendStatusChange(result && result.healthy);
                });
            }
        }, 1000);
    }

    // Generate predictions button
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const league = leagueSelector.value;
            if (!league) {
                alert('Please select a league first');
                return;
            }

            await generatePredictions(league);
        });
    }

    // Export predictions button
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const league = leagueSelector.value;
            if (!league) {
                alert('Please select a league first');
                return;
            }

            await exportPredictionsJSON(league);
        });
    }
}

function handleBackendStatusChange(isOnline) {
    const offlineMessage = document.getElementById('backend-offline-message');
    const controlsDiv = document.getElementById('predictions-controls');
    const statusIndicator = document.getElementById('backend-status-indicator');

    if (isOnline) {
        // Show controls, hide offline message
        if (offlineMessage) offlineMessage.style.display = 'none';
        if (controlsDiv) controlsDiv.style.display = 'block';

        // Update status indicator
        if (statusIndicator) {
            statusIndicator.className = 'status online';
            statusIndicator.textContent = '🟢 Backend Online';
        }

        console.log('✅ Backend online - predictions available');
    } else {
        // Show offline message, hide controls
        if (offlineMessage) offlineMessage.style.display = 'block';
        if (controlsDiv) controlsDiv.style.display = 'none';

        // Update status indicator
        if (statusIndicator) {
            statusIndicator.className = 'status offline';
            statusIndicator.textContent = '🔴 Backend Offline';
        }

        console.log('⚠️ Backend offline - predictions unavailable');
    }
}

async function generatePredictions(league) {
    if (!window.backendSync || !window.backendSync.isOnline) {
        alert('Backend is offline. Please start the backend API first.');
        return;
    }

    const generateBtn = document.getElementById('generate-predictions-btn');
    const originalText = generateBtn.textContent;

    try {
        generateBtn.disabled = true;
        generateBtn.textContent = '⏳ Generating...';

        const bs = window.backendSync;
        let predictions = [];

        if (typeof bs.getFixtures === 'function') {
            // PlusOne path: fetch fixtures then predict each one
            const fixtures = await bs.getFixtures();
            for (const f of fixtures) {
                const pred = await bs.predictMatch(
                    f.home_team_id, f.away_team_id, f.league_id, f.season_id
                );
                if (pred && !pred.error && !pred.detail) {
                    predictions.push({ match: `${f.home_team} vs ${f.away_team}`, prediction: pred });
                    bs.recordPrediction && bs.recordPrediction({
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
        } else {
            // Legacy fallback
            const result = await bs.generatePredictions(league, 'both');
            if (result.success) predictions = result.predictions;
        }

        if (predictions.length > 0) {
            displayPredictions(predictions);
            alert(`✅ Generated ${predictions.length} predictions for ${league}`);
        } else {
            alert('❌ No predictions generated. Make sure the ML model is trained and fixtures are synced.');
        }

    } catch (error) {
        console.error('Error generating predictions:', error);
        alert(`❌ Error: ${error.message}`);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = originalText;
    }
}

function displayPredictions(predictions) {
    const resultDiv = document.getElementById('prediction-results');
    const listDiv = document.getElementById('predictions-list');
    const countSpan = document.getElementById('predictions-count');

    if (!predictions || predictions.length === 0) {
        resultDiv.style.display = 'none';
        return;
    }

    // Update count
    countSpan.textContent = predictions.length;

    // Clear previous results
    listDiv.innerHTML = '';

    // Add each prediction
    predictions.forEach(pred => {
        const card = createPredictionCard(pred);
        listDiv.appendChild(card);
    });

    // Show results
    resultDiv.style.display = 'block';
}

function createPredictionCard(predictionData) {
    const { match, prediction } = predictionData;

    // Normalise: PlusOne nests probs under prediction.probabilities
    const probs = prediction.probabilities || {};
    const homeWin = probs.home_win ?? prediction.home_win ?? 0;
    const draw = probs.draw ?? prediction.draw ?? 0;
    const awayWin = probs.away_win ?? prediction.away_win ?? 0;

    // Confidence: PlusOne = string ("High"/"Medium"/"Low"), old = number 0-100
    const confRaw = prediction.confidence;
    const confStr = typeof confRaw === 'string' ? confRaw : null;
    const confNum = typeof confRaw === 'number' ? confRaw : null;
    const confScore = prediction.confidence_score != null
        ? Math.round(prediction.confidence_score * 100) : confNum;
    const confColor = confStr === 'High' || confNum >= 80 ? '#28a745' :
        confStr === 'Medium' || confNum >= 60 ? '#ffc107' : '#dc3545';

    const card = document.createElement('div');
    card.style.cssText = 'border-bottom: 1px solid #dee2e6; padding: 15px; background: white;';

    // Match header
    const header = document.createElement('div');
    header.style.cssText = 'font-weight: 700; font-size: 14px; color: #333; margin-bottom: 6px;';
    header.textContent = match;
    card.appendChild(header);

    // Predicted outcome (PlusOne)
    if (prediction.predicted_outcome) {
        const colors = { 'Home Win': '#1976D2', 'Draw': '#e0a800', 'Away Win': '#dc3545' };
        const oc = document.createElement('div');
        oc.style.cssText = `font-size:12px;font-weight:700;color:${colors[prediction.predicted_outcome] || '#333'};margin-bottom:8px;`;
        oc.textContent = `► ${prediction.predicted_outcome}`;
        card.appendChild(oc);
    }

    // Probabilities
    const resultDiv = document.createElement('div');
    resultDiv.style.cssText = 'margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px;';
    resultDiv.innerHTML = `
        <div style="font-size: 11px; color: #666; margin-bottom: 6px; font-weight: 600;">🎯 Match Result</div>
        <div style="display: flex; justify-content: space-between; gap: 8px;">
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 10px; color: #666;">Home</div>
                <div style="font-size: 14px; font-weight: 700; color: ${homeWin > 0.4 ? '#28a745' : '#333'};">
                    ${(homeWin * 100).toFixed(0)}%
                </div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 10px; color: #666;">Draw</div>
                <div style="font-size: 14px; font-weight: 700; color: ${draw > 0.3 ? '#ffc107' : '#333'};">
                    ${(draw * 100).toFixed(0)}%
                </div>
            </div>
            <div style="flex: 1; text-align: center;">
                <div style="font-size: 10px; color: #666;">Away</div>
                <div style="font-size: 14px; font-weight: 700; color: ${awayWin > 0.4 ? '#28a745' : '#333'};">
                    ${(awayWin * 100).toFixed(0)}%
                </div>
            </div>
        </div>
    `;
    card.appendChild(resultDiv);

    // Over/Under (old format only)
    if (prediction.over_25) {
        const goalsDiv = document.createElement('div');
        goalsDiv.style.cssText = 'margin-bottom: 10px; font-size: 11px;';
        goalsDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                <div style="background: #e7f3ff; padding: 6px; border-radius: 4px; text-align: center;">
                    <div style="color: #666;">O 1.5</div>
                    <div style="font-weight: 700; color: #1976D2;">${(prediction.over_15 * 100).toFixed(0)}%</div>
                </div>
                <div style="background: #e7f3ff; padding: 6px; border-radius: 4px; text-align: center;">
                    <div style="color: #666;">O 2.5</div>
                    <div style="font-weight: 700; color: #1976D2;">${(prediction.over_25 * 100).toFixed(0)}%</div>
                </div>
                <div style="background: #e7f3ff; padding: 6px; border-radius: 4px; text-align: center;">
                    <div style="color: #666;">O 3.5</div>
                    <div style="font-weight: 700; color: #1976D2;">${(prediction.over_35 * 100).toFixed(0)}%</div>
                </div>
            </div>
        `;
        card.appendChild(goalsDiv);
    }

    // BTTS (old format only)
    if (prediction.btts_yes) {
        const bttsDiv = document.createElement('div');
        bttsDiv.style.cssText = 'font-size: 11px; margin-bottom: 8px;';
        bttsDiv.innerHTML = `
            <span style="color: #666;">BTTS:</span>
            <span style="font-weight: 700; color: ${prediction.btts_yes > 0.5 ? '#28a745' : '#dc3545'};">
                ${prediction.btts_yes > 0.5 ? 'Yes' : 'No'} (${(prediction.btts_yes * 100).toFixed(0)}%)
            </span>
        `;
        card.appendChild(bttsDiv);
    }

    // Expected goals (PlusOne)
    if (prediction.expected_goals) {
        const xgDiv = document.createElement('div');
        xgDiv.style.cssText = 'font-size:11px;color:#666;margin-bottom:6px;';
        xgDiv.textContent = `xG: ${prediction.expected_goals.home?.toFixed(1) ?? '?'} – ${prediction.expected_goals.away?.toFixed(1) ?? '?'}`;
        card.appendChild(xgDiv);
    }

    // Confidence
    if (confScore != null || confStr) {
        const confDiv = document.createElement('div');
        confDiv.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid #dee2e6;';
        const display = confStr ? `${confStr}${confScore != null ? ` (${confScore}%)` : ''}` : `${confScore}%`;
        confDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 10px; color: #666;">Confidence</span>
                <span style="font-size: 11px; font-weight: 700; color: ${confColor};">${display}</span>
            </div>
            <div style="background: #dee2e6; height: 6px; border-radius: 3px; overflow: hidden;">
                <div style="background: ${confColor}; height: 100%; width: ${confScore ?? (confStr === 'High' ? 85 : confStr === 'Medium' ? 60 : 35)}%; transition: width 0.3s;"></div>
            </div>
        `;
        card.appendChild(confDiv);
    }

    // Key factors (PlusOne) or explanation (old)
    const factors = prediction.key_factors?.length ? prediction.key_factors.slice(0, 3).join(' · ') : null;
    const explanation = prediction.explanation || factors;
    if (explanation) {
        const explDiv = document.createElement('div');
        explDiv.style.cssText = 'margin-top: 8px; font-size: 10px; color: #666; font-style: italic;';
        explDiv.textContent = explanation;
        card.appendChild(explDiv);
    }

    return card;
}

async function exportPredictionsJSON(league) {
    if (!window.backendSync || !window.backendSync.isOnline) {
        alert('Backend is offline');
        return;
    }

    try {
        await window.backendSync.exportJSON(league);
        console.log('✅ Predictions exported as JSON');
    } catch (error) {
        console.error('Error exporting predictions:', error);
        alert(`❌ Export failed: ${error.message}`);
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.PredictionsUI = {
        generatePredictions,
        displayPredictions,
        exportPredictionsJSON
    };
}
