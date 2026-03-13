/**
 * Backend Sync Module for Football Extension
 * Handles all communication with prediction backend API
 * API Version: 2.0 (Normalized Schema)
 */

class BackendSync {
    constructor() {
        this.backendUrl = 'https://plusone-backend-production.up.railway.app';
        this.isOnline = false;
        this.lastSync = null;
        this.checkInterval = null;
        this.token = null;
    }

    /**
     * Set authentication token (call this after login)
     */
    setToken(token) {
        this.token = token;
        // Also try to pull from storage if not provided
        if (!token) {
            chrome.storage.local.get(['predictiq_token'], (res) => {
                if (res.predictiq_token) this.token = res.predictiq_token;
            });
        }
    }

    /**
     * Get auth headers — always include JWT if available
     */
    _authHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return headers;
    }

    /**
     * Login to PredictIQ backend and store JWT token
     * @param {string} email
     * @param {string} password
     * @returns {Object} { success, user, error }
     */
    async login(email, password) {
        try {
            const res = await fetch(`${this.backendUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success && data.token) {
                this.token = data.token;
                // Persist token across popup sessions
                chrome.storage.local.set({ predictiq_token: data.token, predictiq_user: data.user });
                console.log('✅ PredictIQ login successful:', data.user?.email);
            }
            return data;
        } catch (err) {
            console.error('❌ PredictIQ login failed:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Logout — clear stored token
     */
    logout() {
        this.token = null;
        chrome.storage.local.remove(['predictiq_token', 'predictiq_user']);
        console.log('🚪 PredictIQ logged out');
    }

    /**
     * Trigger full sync of all data types for a league
     * @param {Object} payload - { league, season, fixtures, stats, playerStats }
     */
    async syncAll(payload) {
        if (!this.isOnline) return { success: false, error: 'Backend offline' };
        try {
            const res = await fetch(`${this.backendUrl}/api/sync/all`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify(payload)
            });
            return await res.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Initialize backend sync - check if backend is available
     */
    async init() {
        console.log('🔌 Initializing backend sync...');

        // Auto-load stored token
        await new Promise(resolve => {
            chrome.storage.local.get(['predictiq_token'], (res) => {
                if (res.predictiq_token) {
                    this.token = res.predictiq_token;
                    console.log('🔑 Auth token loaded from storage');
                }
                resolve();
            });
        });

        // Check connection immediately
        await this.checkConnection();

        // Set up periodic health checks (every 30 seconds)
        this.checkInterval = setInterval(() => {
            this.checkConnection();
        }, 30000);

        return this.isOnline;
    }

    /**
     * Check backend health status
     * @returns {Object} Health status object
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.backendUrl}/api/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                return {
                    healthy: false,
                    status: 'error',
                    message: `HTTP ${response.status}`
                };
            }

            const data = await response.json();
            return {
                healthy: true,
                status: 'online',
                ...data
            };
        } catch (error) {
            console.error('Health check failed:', error);
            return {
                healthy: false,
                status: 'offline',
                error: error.message
            };
        }
    }

    /**
     * Check backend connection
     */
    async checkConnection() {
        try {
            const response = await fetch(`${this.backendUrl}/api/health`);
            const data = await response.json();

            const wasOnline = this.isOnline;
            this.isOnline = response.ok && data.status === 'healthy';

            if (this.isOnline && !wasOnline) {
                console.log('✅ Backend connected (v' + (data.version || 'unknown') + ')');
                this.dispatchStatusEvent(true);
            } else if (!this.isOnline && wasOnline) {
                console.log('❌ Backend disruconnected');
                this.dispatchStatusEvent(false);
            }
        } catch (error) {
            const wasOnline = this.isOnline;
            this.isOnline = false;

            if (wasOnline) {
                console.log('❌ Backend connection lost:', error.message);
                this.dispatchStatusEvent(false);
            }
        }

        return this.isOnline;
    }

    /**
     * Dispatch status change event
     */
    dispatchStatusEvent(isOnline) {
        const event = new CustomEvent('backendStatusChanged', {
            detail: { isOnline, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
    }

    // ====================
    // SYNC METHODS
    // ====================

    /**
     * Sync fixtures data to backend
     */
    async syncFixtures(fixturesData) {
        if (!this.isOnline) {
            console.warn('⚠️ Backend is offline, cannot sync data');
            return { success: false, error: 'Backend offline' };
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/sync/fixtures`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify(fixturesData)
            });

            const result = await response.json();

            if (result.success) {
                this.lastSync = new Date();
                console.log(`✅ Synced ${result.matches_inserted} fixtures for ${fixturesData.league}`);
            }

            return result;
        } catch (error) {
            console.error('❌ Fixtures sync failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync squad stats data to backend
     */
    async syncStats(statsData) {
        if (!this.isOnline) {
            return { success: false, error: 'Backend offline' };
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/sync/stats`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify(statsData)
            });

            const result = await response.json();

            if (result.success) {
                this.lastSync = new Date();
                console.log(`✅ Synced ${result.stats_inserted} stats for ${statsData.league}`);
            }

            return result;
        } catch (error) {
            console.error('❌ Stats sync failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync player stats data to backend
     */
    async syncPlayerStats(playerStatsData) {
        if (!this.isOnline) {
            return { success: false, error: 'Backend offline' };
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/sync/player_stats`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify(playerStatsData)
            });

            const result = await response.json();

            if (result.success) {
                this.lastSync = new Date();
                console.log(`✅ Synced ${result.players_inserted} player stats for ${playerStatsData.league}`);
            }

            return result;
        } catch (error) {
            console.error('❌ Player stats sync failed:', error);
            return { success: false, error: error.message };
        }
    }

    // ====================
    // PREDICTION METHODS
    // ====================

    /**
     * Get league predictions from backend
     */
    async getLeaguePredictions(league) {
        if (!this.isOnline) {
            return { success: false, error: 'Backend offline' };
        }

        try {
            // PlusOne does not have /api/predictions/league/{league}.
            // Use /api/predictions/fixtures which returns upcoming matches.
            const response = await fetch(
                `${this.backendUrl}/api/predictions/fixtures?limit=50`,
                { headers: this._authHeaders() }
            );
            const data = await response.json();
            return { success: true, predictions: data.predictions || data || [] };
        } catch (error) {
            console.error('❌ Failed to get predictions:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate prediction for a specific match
     */
    async generateMatchPrediction(homeTeam, awayTeam, league) {
        if (!this.isOnline) {
            return { success: false, error: 'Backend offline' };
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/predictions/generate`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify({ home_team: homeTeam, away_team: awayTeam, league: league })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Failed to generate prediction:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate predictions for all upcoming matches in a league
     * @param {string} league - League name
     * @param {string} model - Model type: 'statistical', 'ml', or 'both' (default)
     * @returns {Object} Predictions result
     */
    async generatePredictions(league, model = 'both') {
        if (!this.isOnline) {
            return { success: false, error: 'Backend offline' };
        }

        try {
            console.log(`🔮 Generating predictions for ${league}...`);
            const response = await fetch(`${this.backendUrl}/api/predictions/generate`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify({ league, season: null })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return { success: false, error: errorData.error || `HTTP ${response.status}` };
            }

            const data = await response.json();
            if (data.success || data.predictions) {
                console.log(`✅ Generated ${data.predictions?.length || 0} predictions`);
                return { success: true, predictions: data.predictions || [], count: data.count || 0, league };
            }
            return { success: false, error: data.error || 'Unknown error' };

        } catch (error) {
            console.error('❌ Failed to generate predictions:', error);
            return { success: false, error: error.message };
        }
    }

    // ====================
    // PLUSONE ML ENGINE (NEW)
    // These methods talk to the deployed PlusOne FastAPI backend.
    // ====================

    /** ML engine status. GET /api/predictions/status */
    async getEngineStatus() {
        try {
            const r = await fetch(`${this.backendUrl}/api/predictions/status`,
                { headers: this._authHeaders() });
            return await r.json();
        } catch (e) { return { success: false, error: e.message }; }
    }

    /**
     * Start background model training (returns immediately).
     * Poll getTrainingStatus() for progress.
     * POST /api/predictions/train
     */
    async trainModel() {
        try {
            const r = await fetch(`${this.backendUrl}/api/predictions/train`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify({})
            });
            return await r.json();
        } catch (e) { return { success: false, error: e.message }; }
    }

    /** Poll training progress. GET /api/predictions/training-status */
    async getTrainingStatus() {
        try {
            const r = await fetch(`${this.backendUrl}/api/predictions/training-status`,
                { headers: this._authHeaders() });
            return await r.json();
        } catch (e) { return { status: 'error', error: e.message }; }
    }

    /**
     * Upcoming fixtures with team IDs for ML prediction.
     * GET /api/predictions/fixtures
     */
    async getFixtures(leagueId = null) {
        try {
            let url = `${this.backendUrl}/api/predictions/fixtures?limit=50`;
            if (leagueId) url += `&league_id=${leagueId}`;
            const r = await fetch(url, { headers: this._authHeaders() });
            const d = await r.json();
            return d.predictions || d || [];
        } catch (e) { console.error('❌ getFixtures:', e); return []; }
    }

    /**
     * ML prediction by team IDs.
     * POST /api/predictions/predict
     * Response: { match, predicted_outcome, confidence, confidence_score,
     *             probabilities:{home_win,draw,away_win}, expected_goals:{home,away}, key_factors }
     */
    async predictMatch(homeTeamId, awayTeamId, leagueId, seasonId) {
        if (!this.isOnline) return { success: false, error: 'Backend offline' };
        try {
            const r = await fetch(`${this.backendUrl}/api/predictions/predict`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify({
                    home_team_id: homeTeamId,
                    away_team_id: awayTeamId,
                    league_id: leagueId,
                    season_id: seasonId
                })
            });
            return await r.json();
        } catch (e) { return { success: false, error: e.message }; }
    }

    /** Log a prediction for performance tracking. POST /api/prediction-log/record */
    async recordPrediction(data) {
        try {
            await fetch(`${this.backendUrl}/api/prediction-log/record`, {
                method: 'POST',
                headers: this._authHeaders(),
                body: JSON.stringify(data)
            });
        } catch (_) { /* non-blocking */ }
    }

    /** Grade predictions against results. POST /api/prediction-log/evaluate */
    async evaluatePredictions() {
        try {
            const r = await fetch(`${this.backendUrl}/api/prediction-log/evaluate`, {
                method: 'POST', headers: this._authHeaders()
            });
            return await r.json();
        } catch (e) { return { success: false, error: e.message }; }
    }

    /** Real-world accuracy stats. GET /api/prediction-log/accuracy */
    async getRealWorldAccuracy(league = null) {
        try {
            let url = `${this.backendUrl}/api/prediction-log/accuracy`;
            if (league) url += `?league=${encodeURIComponent(league)}`;
            const r = await fetch(url, { headers: this._authHeaders() });
            return await r.json();
        } catch (e) { return { success: false, error: e.message }; }
    }

    // ====================
    // BACKWARD COMPATIBILITY
    // ====================

    /**
     * Alias kept for backward compatibility — routes to getLeaguePredictions()
     * @deprecated
     */
    async _legacyGetPredictions(league) {
        console.log(`🔄 Getting predictions for ${league}...`);

        // Get predictions from the new endpoint
        const result = await this.getLeaguePredictions(league);

        if (!result || !result.predictions) {
            return {
                success: false,
                error: result?.error || 'No predictions available'
            };
        }

        // Transform to old format
        const transformedPredictions = result.predictions.map(pred => ({
            match_id: `${pred.home_team}_vs_${pred.away_team}`,
            home_team: pred.home_team,
            away_team: pred.away_team,
            match_date: pred.match_date,
            predictions: {
                statistical: pred.statistical || {},
                ml: pred.ml || {},
                consensus: pred.consensus || {}
            },
            confidence: pred.confidence || 0,
            home_form: pred.home_form || [],
            away_form: pred.away_form || []
        }));

        return {
            success: true,
            count: transformedPredictions.length,
            predictions: transformedPredictions,
            league: league
        };
    }

    /**
     * Get match prediction by ID (backward compatible)
     * @deprecated
     */
    async getMatchPrediction(matchId) {
        return {
            success: false,
            error: 'Method deprecated - use generateMatchPrediction(homeTeam, awayTeam, league) instead'
        };
    }

    // ====================
    // UTILITY METHODS
    // ====================

    /**
     * Get backend version info
     */
    async getVersion() {
        if (!this.isOnline) {
            return { success: false, error: 'Backend offline' };
        }

        try {
            const response = await fetch(`${this.backendUrl}/api/health`);
            const data = await response.json();
            return {
                success: true,
                version: data.version,
                status: data.status
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop health checks
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isOnline: this.isOnline,
            lastSync: this.lastSync,
            backendUrl: this.backendUrl
        };
    }
}

// Create singleton instance
const backendSync = new BackendSync();

// Initialize on load
backendSync.init().then(isOnline => {
    if (isOnline) {
        console.log('🎉 Backend sync service initialized successfully');
    } else {
        console.log('⚠️ Backend sync service initialized but backend is offline');
    }
});

// Export for use in other files
if (typeof window !== 'undefined') {
    window.backendSync = backendSync;
    window.BackendSync = BackendSync;
}
