/**
 * IndexedDB Manager for Football Extension
 * Provides offline storage for scraped data, predictions, and team information
 */

class IndexedDBManager {
    constructor() {
        this.dbName = 'football_data';
        this.version = 1;
        this.db = null;
    }

    /**
     * Initialize database and create object stores
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Teams store
                if (!db.objectStoreNames.contains('teams')) {
                    const teamsStore = db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
                    teamsStore.createIndex('name', 'name', { unique: true });
                    teamsStore.createIndex('league', 'league', { unique: false });
                }

                // Matches store
                if (!db.objectStoreNames.contains('matches')) {
                    const matchesStore = db.createObjectStore('matches', { keyPath: 'id', autoIncrement: true });
                    matchesStore.createIndex('league', 'league', { unique: false });
                    matchesStore.createIndex('date', 'date', { unique: false });
                    matchesStore.createIndex('season', 'season', { unique: false });
                }

                // Predictions store
                if (!db.objectStoreNames.contains('predictions')) {
                    const predictionsStore = db.createObjectStore('predictions', { keyPath: 'id', autoIncrement: true });
                    predictionsStore.createIndex('matchId', 'matchId', { unique: false });
                    predictionsStore.createIndex('league', 'league', { unique: false });
                }

                // Stats store (scraped tables)
                if (!db.objectStoreNames.contains('stats')) {
                    const statsStore = db.createObjectStore('stats', { keyPath: 'id', autoIncrement: true });
                    statsStore.createIndex('league', 'league', { unique: false });
                    statsStore.createIndex('type', 'type', { unique: false });
                    statsStore.createIndex('scrapedAt', 'scrapedAt', { unique: false });
                }

                // Scraped data cache
                if (!db.objectStoreNames.contains('scraped_data')) {
                    const scrapedStore = db.createObjectStore('scraped_data', { keyPath: 'url' });
                    scrapedStore.createIndex('league', 'league', { unique: false });
                    scrapedStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                console.log('✅ IndexedDB object stores created');
            };
        });
    }

    /**
     * Add or update team
     */
    async saveTeam(team) {
        const tx = this.db.transaction('teams', 'readwrite');
        const store = tx.objectStore('teams');

        // Check if team exists
        const index = store.index('name');
        const existing = await this._getByIndex(index, team.name);

        if (existing) {
            team.id = existing.id;
            await store.put(team);
        } else {
            await store.add(team);
        }

        return tx.complete;
    }

    /**
     * Get team by name
     */
    async getTeam(name) {
        const tx = this.db.transaction('teams', 'readonly');
        const store = tx.objectStore('teams');
        const index = store.index('name');
        return this._getByIndex(index, name);
    }

    /**
     * Get all teams in a league
     */
    async getTeamsByLeague(league) {
        const tx = this.db.transaction('teams', 'readonly');
        const store = tx.objectStore('teams');
        const index = store.index('league');
        return this._getAllByIndex(index, league);
    }

    /**
     * Save match data
     */
    async saveMatch(match) {
        const tx = this.db.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        return store.add(match);
    }

    /**
     * Get matches by league
     */
    async getMatchesByLeague(league) {
        const tx = this.db.transaction('matches', 'readonly');
        const store = tx.objectStore('matches');
        const index = store.index('league');
        return this._getAllByIndex(index, league);
    }

    /**
     * Save prediction
     */
    async savePrediction(prediction) {
        const tx = this.db.transaction('predictions', 'readwrite');
        const store = tx.objectStore('predictions');
        return store.add(prediction);
    }

    /**
     * Get predictions for a match
     */
    async getPredictionsForMatch(matchId) {
        const tx = this.db.transaction('predictions', 'readonly');
        const store = tx.objectStore('predictions');
        const index = store.index('matchId');
        return this._getAllByIndex(index, matchId);
    }

    /**
     * Get predictions by league
     */
    async getPredictionsByLeague(league) {
        const tx = this.db.transaction('predictions', 'readonly');
        const store = tx.objectStore('predictions');
        const index = store.index('league');
        return this._getAllByIndex(index, league);
    }

    /**
     * Save scraped data (for caching)
     */
    async saveScrapedData(url, league, data) {
        const tx = this.db.transaction('scraped_data', 'readwrite');
        const store = tx.objectStore('scraped_data');

        const record = {
            url: url,
            league: league,
            data: data,
            timestamp: new Date().toISOString()
        };

        return store.put(record);
    }

    /**
     * Get scraped data from cache
     */
    async getScrapedData(url) {
        const tx = this.db.transaction('scraped_data', 'readonly');
        const store = tx.objectStore('scraped_data');
        return store.get(url);
    }

    /**
     * Get ALL scraped data (for session restore)
     */
    async getAllScrapedData() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('scraped_data', 'readonly');
            const store = tx.objectStore('scraped_data');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Clear only scraped_data store (keep predictions/teams intact)
     */
    async clearScrapedData() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('scraped_data', 'readwrite');
            const store = tx.objectStore('scraped_data');
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Check if scraped data is fresh (< 24 hours old)
     */
    async isDataFresh(url, maxAgeHours = 24) {
        const data = await this.getScrapedData(url);

        if (!data) return false;

        const scrapedTime = new Date(data.timestamp);
        const now = new Date();
        const ageHours = (now - scrapedTime) / (1000 * 60 * 60);

        return ageHours < maxAgeHours;
    }

    /**
     * Save stats data
     */
    async saveStats(league, type, data) {
        const tx = this.db.transaction('stats', 'readwrite');
        const store = tx.objectStore('stats');

        const record = {
            league: league,
            type: type,
            data: data,
            scrapedAt: new Date().toISOString()
        };

        return store.add(record);
    }

    /**
     * Get stats by league and type
     */
    async getStats(league, type = null) {
        const tx = this.db.transaction('stats', 'readonly');
        const store = tx.objectStore('stats');

        if (type) {
            // Get specific type for league
            const allStats = await this._getAllByIndex(store.index('league'), league);
            return allStats.filter(stat => stat.type === type);
        } else {
            // Get all stats for league
            return this._getAllByIndex(store.index('league'), league);
        }
    }

    /**
     * Clear all data (useful for testing or reset)
     */
    async clearAllData() {
        const stores = ['teams', 'matches', 'predictions', 'stats', 'scraped_data'];

        for (const storeName of stores) {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            await store.clear();
        }

        console.log('✅ All IndexedDB data cleared');
    }

    /**
     * Get database statistics
     */
    async getStats() {
        const stats = {};
        const stores = ['teams', 'matches', 'predictions', 'stats', 'scraped_data'];

        for (const storeName of stores) {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const count = await store.count();
            stats[storeName] = count;
        }

        return stats;
    }

    /**
     * Helper: Get single item by index
     */
    _getByIndex(index, key) {
        return new Promise((resolve, reject) => {
            const request = index.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Helper: Get all items by index
     */
    _getAllByIndex(index, key) {
        return new Promise((resolve, reject) => {
            const request = index.getAll(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

// Create singleton instance
const dbManager = new IndexedDBManager();

// Initialize on load
dbManager.init().then(() => {
    console.log('📦 IndexedDB Manager ready');
}).catch(err => {
    console.error('❌ IndexedDB initialization failed:', err);
});

// Export for use in other files
if (typeof window !== 'undefined') {
    window.IndexedDBManager = IndexedDBManager;
    window.dbManager = dbManager;
}
