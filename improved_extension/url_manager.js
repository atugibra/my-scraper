// URL Manager for Football League Auto Saver
// Handles CRUD operations for FBref URLs

const DEFAULT_URLS = [
    { name: 'Bundesliga Scores & Fixtures', url: 'https://fbref.com/en/comps/20/schedule/Bundesliga-Scores-and-Fixtures', league: 'Bundesliga', type: 'fixtures' },
    { name: 'Bundesliga Stats', url: 'https://fbref.com/en/comps/20/Bundesliga-Stats', league: 'Bundesliga', type: 'stats' },
    { name: 'Bundesliga Player Stats', url: 'https://fbref.com/en/comps/20/stats/Bundesliga-Stats', league: 'Bundesliga', type: 'player_stats' },
    { name: '2. Bundesliga Scores & Fixtures', url: 'https://fbref.com/en/comps/33/schedule/2-Bundesliga-Scores-and-Fixtures', league: '2. Bundesliga', type: 'fixtures' },
    { name: '2. Bundesliga Stats', url: 'https://fbref.com/en/comps/33/2-Bundesliga-Stats', league: '2. Bundesliga', type: 'stats' },
    { name: '2. Bundesliga Player Stats', url: 'https://fbref.com/en/comps/33/stats/2-Bundesliga-Stats', league: '2. Bundesliga', type: 'player_stats' },
    { name: 'Belgian Pro League Scores & Fixtures', url: 'https://fbref.com/en/comps/37/schedule/Belgian-Pro-League-Scores-and-Fixtures', league: 'Belgian Pro League', type: 'fixtures' },
    { name: 'Belgian Pro League Stats', url: 'https://fbref.com/en/comps/37/Belgian-Pro-League-Stats', league: 'Belgian Pro League', type: 'stats' },
    { name: 'Belgian Pro League Player Stats', url: 'https://fbref.com/en/comps/37/stats/Belgian-Pro-League-Stats', league: 'Belgian Pro League', type: 'player_stats' },
    { name: 'Championship Scores & Fixtures', url: 'https://fbref.com/en/comps/10/schedule/Championship-Scores-and-Fixtures', league: 'Championship', type: 'fixtures' },
    { name: 'Championship Stats', url: 'https://fbref.com/en/comps/10/Championship-Stats', league: 'Championship', type: 'stats' },
    { name: 'Championship Player Stats', url: 'https://fbref.com/en/comps/10/stats/Championship-Stats', league: 'Championship', type: 'player_stats' },
    { name: 'Eredivisie Scores & Fixtures', url: 'https://fbref.com/en/comps/23/schedule/Eredivisie-Scores-and-Fixtures', league: 'Eredivisie', type: 'fixtures' },
    { name: 'Eredivisie Stats', url: 'https://fbref.com/en/comps/23/Eredivisie-Stats', league: 'Eredivisie', type: 'stats' },
    { name: 'Eredivisie Player Stats', url: 'https://fbref.com/en/comps/23/stats/Eredivisie-Stats', league: 'Eredivisie', type: 'player_stats' },
    { name: 'La Liga Scores & Fixtures', url: 'https://fbref.com/en/comps/12/schedule/La-Liga-Scores-and-Fixtures', league: 'La Liga', type: 'fixtures' },
    { name: 'La Liga Stats', url: 'https://fbref.com/en/comps/12/La-Liga-Stats', league: 'La Liga', type: 'stats' },
    { name: 'La Liga Player Stats', url: 'https://fbref.com/en/comps/12/stats/La-Liga-Stats', league: 'La Liga', type: 'player_stats' },
    { name: 'League One Scores & Fixtures', url: 'https://fbref.com/en/comps/15/schedule/League-One-Scores-and-Fixtures', league: 'League One', type: 'fixtures' },
    { name: 'League One Stats', url: 'https://fbref.com/en/comps/15/League-One-Stats', league: 'League One', type: 'stats' },
    { name: 'League One Player Stats', url: 'https://fbref.com/en/comps/15/stats/League-One-Stats', league: 'League One', type: 'player_stats' },
    { name: 'League Two Scores & Fixtures', url: 'https://fbref.com/en/comps/16/schedule/League-Two-Scores-and-Fixtures', league: 'League Two', type: 'fixtures' },
    { name: 'League Two Stats', url: 'https://fbref.com/en/comps/16/League-Two-Stats', league: 'League Two', type: 'stats' },
    { name: 'League Two Player Stats', url: 'https://fbref.com/en/comps/16/stats/League-Two-Stats', league: 'League Two', type: 'player_stats' },
    { name: 'Ligue 1 Scores & Fixtures', url: 'https://fbref.com/en/comps/13/schedule/Ligue-1-Scores-and-Fixtures', league: 'Ligue 1', type: 'fixtures' },
    { name: 'Ligue 1 Stats', url: 'https://fbref.com/en/comps/13/Ligue-1-Stats', league: 'Ligue 1', type: 'stats' },
    { name: 'Ligue 1 Player Stats', url: 'https://fbref.com/en/comps/13/stats/Ligue-1-Stats', league: 'Ligue 1', type: 'player_stats' },
    { name: 'Ligue 2 Scores & Fixtures', url: 'https://fbref.com/en/comps/60/schedule/Ligue-2-Scores-and-Fixtures', league: 'Ligue 2', type: 'fixtures' },
    { name: 'Ligue 2 Stats', url: 'https://fbref.com/en/comps/60/Ligue-2-Stats', league: 'Ligue 2', type: 'stats' },
    { name: 'Ligue 2 Player Stats', url: 'https://fbref.com/en/comps/60/stats/Ligue-2-Stats', league: 'Ligue 2', type: 'player_stats' },
    { name: 'Premier League Scores & Fixtures', url: 'https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures', league: 'Premier League', type: 'fixtures' },
    { name: 'Premier League Stats', url: 'https://fbref.com/en/comps/9/Premier-League-Stats', league: 'Premier League', type: 'stats' },
    { name: 'Premier League Player Stats', url: 'https://fbref.com/en/comps/9/stats/Premier-League-Stats', league: 'Premier League', type: 'player_stats' },
    { name: 'Segunda Division Scores & Fixtures', url: 'https://fbref.com/en/comps/17/schedule/Segunda-Division-Scores-and-Fixtures', league: 'Segunda Division', type: 'fixtures' },
    { name: 'Segunda Division Stats', url: 'https://fbref.com/en/comps/17/Segunda-Division-Stats', league: 'Segunda Division', type: 'stats' },
    { name: 'Segunda Division Player Stats', url: 'https://fbref.com/en/comps/17/stats/Segunda-Division-Stats', league: 'Segunda Division', type: 'player_stats' },
    { name: 'Serie A Scores & Fixtures', url: 'https://fbref.com/en/comps/11/schedule/Serie-A-Scores-and-Fixtures', league: 'Serie A', type: 'fixtures' },
    { name: 'Serie A Stats', url: 'https://fbref.com/en/comps/11/Serie-A-Stats', league: 'Serie A', type: 'stats' },
    { name: 'Serie A Player Stats', url: 'https://fbref.com/en/comps/11/stats/Serie-A-Stats', league: 'Serie A', type: 'player_stats' },
    { name: 'Serie B Scores & Fixtures', url: 'https://fbref.com/en/comps/18/schedule/Serie-B-Scores-and-Fixtures', league: 'Serie B', type: 'fixtures' },
    { name: 'Serie B Stats', url: 'https://fbref.com/en/comps/18/Serie-B-Stats', league: 'Serie B', type: 'stats' },
    { name: 'Serie B Player Stats', url: 'https://fbref.com/en/comps/18/stats/Serie-B-Stats', league: 'Serie B', type: 'player_stats' },
    { name: 'Super Lig Scores & Fixtures', url: 'https://fbref.com/en/comps/26/schedule/Super-Lig-Scores-and-Fixtures', league: 'Super Lig', type: 'fixtures' },
    { name: 'Super Lig Stats', url: 'https://fbref.com/en/comps/26/Super-Lig-Stats', league: 'Super Lig', type: 'stats' },
    { name: 'Super Lig Player Stats', url: 'https://fbref.com/en/comps/26/stats/Super-Lig-Stats', league: 'Super Lig', type: 'player_stats' },
    { name: 'Scottish Premiership Scores & Fixtures', url: 'https://fbref.com/en/comps/40/schedule/Scottish-Premiership-Scores-and-Fixtures', league: 'Scottish Premiership', type: 'fixtures' },
    { name: 'Scottish Premiership Stats', url: 'https://fbref.com/en/comps/40/Scottish-Premiership-Stats', league: 'Scottish Premiership', type: 'stats' },
    { name: 'Scottish Premiership Player Stats', url: 'https://fbref.com/en/comps/40/stats/Scottish-Premiership-Stats', league: 'Scottish Premiership', type: 'player_stats' },
    { name: 'Primeira Liga Scores & Fixtures', url: 'https://fbref.com/en/comps/32/schedule/Primeira-Liga-Scores-and-Fixtures', league: 'Primeira Liga', type: 'fixtures' },
    { name: 'Primeira Liga Stats', url: 'https://fbref.com/en/comps/32/Primeira-Liga-Stats', league: 'Primeira Liga', type: 'stats' },
    { name: 'Primeira Liga Player Stats', url: 'https://fbref.com/en/comps/32/stats/Primeira-Liga-Stats', league: 'Primeira Liga', type: 'player_stats' },
    { name: 'Austrian Bundesliga Scores & Fixtures', url: 'https://fbref.com/en/comps/56/schedule/Austrian-Football-Bundesliga-Scores-and-Fixtures', league: 'Austrian Bundesliga', type: 'fixtures' },
    { name: 'Austrian Bundesliga Stats', url: 'https://fbref.com/en/comps/56/Austrian-Football-Bundesliga-Stats', league: 'Austrian Bundesliga', type: 'stats' },
    { name: 'Austrian Bundesliga Player Stats', url: 'https://fbref.com/en/comps/56/stats/Austrian-Football-Bundesliga-Stats', league: 'Austrian Bundesliga', type: 'player_stats' },
    { name: 'Greek Super League Scores & Fixtures', url: 'https://fbref.com/en/comps/27/schedule/Super-League-Greece-1-Scores-and-Fixtures', league: 'Greek Super League', type: 'fixtures' },
    { name: 'Greek Super League Stats', url: 'https://fbref.com/en/comps/27/Super-League-Greece-1-Stats', league: 'Greek Super League', type: 'stats' },
    { name: 'Greek Super League Player Stats', url: 'https://fbref.com/en/comps/27/stats/Super-League-Greece-1-Stats', league: 'Greek Super League', type: 'player_stats' },
    { name: 'MLS Scores & Fixtures', url: 'https://fbref.com/en/comps/22/schedule/Major-League-Soccer-Scores-and-Fixtures', league: 'MLS', type: 'fixtures' },
    { name: 'MLS Stats', url: 'https://fbref.com/en/comps/22/Major-League-Soccer-Stats', league: 'MLS', type: 'stats' },
    { name: 'MLS Player Stats', url: 'https://fbref.com/en/comps/22/stats/Major-League-Soccer-Stats', league: 'MLS', type: 'player_stats' },
    { name: 'Brasileirao Serie A Scores & Fixtures', url: 'https://fbref.com/en/comps/24/schedule/Serie-A-Scores-and-Fixtures', league: 'Brasileirao Serie A', type: 'fixtures' },
    { name: 'Brasileirao Serie A Stats', url: 'https://fbref.com/en/comps/24/Serie-A-Stats', league: 'Brasileirao Serie A', type: 'stats' },
    { name: 'Brasileirao Serie A Player Stats', url: 'https://fbref.com/en/comps/24/stats/Serie-A-Stats', league: 'Brasileirao Serie A', type: 'player_stats' },
    { name: 'Argentine Primera Division Scores & Fixtures', url: 'https://fbref.com/en/comps/21/schedule/Primera-Division-Scores-and-Fixtures', league: 'Argentine Primera Division', type: 'fixtures' },
    { name: 'Argentine Primera Division Stats', url: 'https://fbref.com/en/comps/21/Primera-Division-Stats', league: 'Argentine Primera Division', type: 'stats' },
    { name: 'Argentine Primera Division Player Stats', url: 'https://fbref.com/en/comps/21/stats/Primera-Division-Stats', league: 'Argentine Primera Division', type: 'player_stats' },
    { name: 'J1 League Scores & Fixtures', url: 'https://fbref.com/en/comps/25/schedule/J1-League-Scores-and-Fixtures', league: 'J1 League', type: 'fixtures' },
    { name: 'J1 League Stats', url: 'https://fbref.com/en/comps/25/J1-League-Stats', league: 'J1 League', type: 'stats' },
    { name: 'J1 League Player Stats', url: 'https://fbref.com/en/comps/25/stats/J1-League-Stats', league: 'J1 League', type: 'player_stats' },

    // ========== UEFA CLUB COMPETITIONS ==========
    { name: 'Champions League Scores & Fixtures', url: 'https://fbref.com/en/comps/8/schedule/Champions-League-Scores-and-Fixtures', league: 'UEFA Champions League', type: 'fixtures' },
    { name: 'Champions League Stats', url: 'https://fbref.com/en/comps/8/Champions-League-Stats', league: 'UEFA Champions League', type: 'stats' },
    { name: 'Champions League Player Stats', url: 'https://fbref.com/en/comps/8/stats/Champions-League-Stats', league: 'UEFA Champions League', type: 'player_stats' },
    { name: 'Europa League Scores & Fixtures', url: 'https://fbref.com/en/comps/19/schedule/Europa-League-Scores-and-Fixtures', league: 'UEFA Europa League', type: 'fixtures' },
    { name: 'Europa League Stats', url: 'https://fbref.com/en/comps/19/Europa-League-Stats', league: 'UEFA Europa League', type: 'stats' },
    { name: 'Europa League Player Stats', url: 'https://fbref.com/en/comps/19/stats/Europa-League-Stats', league: 'UEFA Europa League', type: 'player_stats' },
    { name: 'Conference League Scores & Fixtures', url: 'https://fbref.com/en/comps/882/schedule/UEFA-Europa-Conference-League-Scores-and-Fixtures', league: 'UEFA Conference League', type: 'fixtures' },
    { name: 'Conference League Stats', url: 'https://fbref.com/en/comps/882/UEFA-Europa-Conference-League-Stats', league: 'UEFA Conference League', type: 'stats' },
    { name: 'Conference League Player Stats', url: 'https://fbref.com/en/comps/882/stats/UEFA-Europa-Conference-League-Stats', league: 'UEFA Conference League', type: 'player_stats' },

    // ========== 2024-2025 SEASON (HISTORICAL DATA) ==========
    { name: 'Premier League 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/9/2024-2025/schedule/2024-2025-Premier-League-Scores-and-Fixtures', league: 'Premier League', type: 'historical_fixtures' },
    { name: 'La Liga 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/12/2024-2025/schedule/2024-2025-La-Liga-Scores-and-Fixtures', league: 'La Liga', type: 'historical_fixtures' },
    { name: 'Bundesliga 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/20/2024-2025/schedule/2024-2025-Bundesliga-Scores-and-Fixtures', league: 'Bundesliga', type: 'historical_fixtures' },
    { name: 'Serie A 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/11/2024-2025/schedule/2024-2025-Serie-A-Scores-and-Fixtures', league: 'Serie A', type: 'historical_fixtures' },
    { name: 'Ligue 1 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/13/2024-2025/schedule/2024-2025-Ligue-1-Scores-and-Fixtures', league: 'Ligue 1', type: 'historical_fixtures' },
    { name: 'Eredivisie 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/23/2024-2025/schedule/2024-2025-Eredivisie-Scores-and-Fixtures', league: 'Eredivisie', type: 'historical_fixtures' },
    { name: 'Championship 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/10/2024-2025/schedule/2024-2025-Championship-Scores-and-Fixtures', league: 'Championship', type: 'historical_fixtures' },
    { name: '2. Bundesliga 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/33/2024-2025/schedule/2024-2025-2-Bundesliga-Scores-and-Fixtures', league: '2. Bundesliga', type: 'historical_fixtures' },
    { name: 'Serie B 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/18/2024-2025/schedule/2024-2025-Serie-B-Scores-and-Fixtures', league: 'Serie B', type: 'historical_fixtures' },
    { name: 'Segunda Division 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/17/2024-2025/schedule/2024-2025-Segunda-Division-Scores-and-Fixtures', league: 'Segunda Division', type: 'historical_fixtures' },
    { name: 'Ligue 2 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/60/2024-2025/schedule/2024-2025-Ligue-2-Scores-and-Fixtures', league: 'Ligue 2', type: 'historical_fixtures' },
    { name: 'League One 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/15/2024-2025/schedule/2024-2025-League-One-Scores-and-Fixtures', league: 'League One', type: 'historical_fixtures' },
    { name: 'League Two 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/16/2024-2025/schedule/2024-2025-League-Two-Scores-and-Fixtures', league: 'League Two', type: 'historical_fixtures' },
    { name: 'Belgian Pro League 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/37/2024-2025/schedule/2024-2025-Belgian-Pro-League-Scores-and-Fixtures', league: 'Belgian Pro League', type: 'historical_fixtures' },
    { name: 'Super Lig 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/26/2024-2025/schedule/2024-2025-Super-Lig-Scores-and-Fixtures', league: 'Super Lig', type: 'historical_fixtures' },
    { name: 'Scottish Premiership 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/40/2024-2025/schedule/2024-2025-Scottish-Premiership-Scores-and-Fixtures', league: 'Scottish Premiership', type: 'historical_fixtures' },
    { name: 'Primeira Liga 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/32/2024-2025/schedule/2024-2025-Primeira-Liga-Scores-and-Fixtures', league: 'Primeira Liga', type: 'historical_fixtures' },
    { name: 'Brasileirao Serie A 2024 Fixtures', url: 'https://fbref.com/en/comps/24/2024/schedule/2024-Serie-A-Scores-and-Fixtures', league: 'Brasileirao Serie A', type: 'historical_fixtures' },
    { name: 'Argentine Primera 2024 Fixtures', url: 'https://fbref.com/en/comps/21/2024/schedule/2024-Primera-Division-Scores-and-Fixtures', league: 'Argentine Primera Division', type: 'historical_fixtures' },
    { name: 'J1 League 2024 Fixtures', url: 'https://fbref.com/en/comps/25/2024/schedule/2024-J1-League-Scores-and-Fixtures', league: 'J1 League', type: 'historical_fixtures' },

    // ========== UEFA CLUB COMPETITIONS HISTORICAL DATA ==========
    { name: 'Champions League 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/8/2024-2025/schedule/2024-2025-Champions-League-Scores-and-Fixtures', league: 'UEFA Champions League', type: 'historical_fixtures' },
    { name: 'Europa League 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/19/2024-2025/schedule/2024-2025-Europa-League-Scores-and-Fixtures', league: 'UEFA Europa League', type: 'historical_fixtures' },
    { name: 'Conference League 2024-2025 Fixtures', url: 'https://fbref.com/en/comps/882/2024-2025/schedule/2024-2025-UEFA-Europa-Conference-League-Scores-and-Fixtures', league: 'UEFA Conference League', type: 'historical_fixtures' }

];

// Storage keys
const STORAGE_KEY_URLS = 'custom_urls';
const STORAGE_KEY_USE_CUSTOM = 'use_custom_urls';

class URLManager {
    /**
     * Load URLs from storage or return defaults
     */
    static async loadURLs() {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY_URLS, STORAGE_KEY_USE_CUSTOM], (result) => {
                if (result[STORAGE_KEY_USE_CUSTOM] && result[STORAGE_KEY_URLS]) {
                    resolve(result[STORAGE_KEY_URLS]);
                } else {
                    resolve(DEFAULT_URLS);
                }
            });
        });
    }

    /**
     * Save custom URLs to storage
     */
    static async saveURLs(urls) {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                [STORAGE_KEY_URLS]: urls,
                [STORAGE_KEY_USE_CUSTOM]: true
            }, () => {
                resolve(true);
            });
        });
    }

    /**
     * Reset to default URLs
     */
    static async resetToDefaults() {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                [STORAGE_KEY_URLS]: DEFAULT_URLS,
                [STORAGE_KEY_USE_CUSTOM]: false
            }, () => {
                resolve(DEFAULT_URLS);
            });
        });
    }

    /**
     * Add a new URL
     */
    static async addURL(urlData) {
        const urls = await this.loadURLs();

        // Validate URL
        if (!this.validateURL(urlData.url)) {
            throw new Error('Invalid FBref URL');
        }

        // Add to list
        urls.push({
            name: urlData.name,
            url: urlData.url,
            league: urlData.league,
            type: urlData.type
        });

        await this.saveURLs(urls);
        return urls;
    }

    /**
     * Update an existing URL
     */
    static async updateURL(index, urlData) {
        const urls = await this.loadURLs();

        if (index < 0 || index >= urls.length) {
            throw new Error('Invalid index');
        }

        // Validate URL
        if (!this.validateURL(urlData.url)) {
            throw new Error('Invalid FBref URL');
        }

        urls[index] = {
            name: urlData.name,
            url: urlData.url,
            league: urlData.league,
            type: urlData.type
        };

        await this.saveURLs(urls);
        return urls;
    }

    /**
     * Delete a URL
     */
    static async deleteURL(index) {
        const urls = await this.loadURLs();

        if (index < 0 || index >= urls.length) {
            throw new Error('Invalid index');
        }

        urls.splice(index, 1);
        await this.saveURLs(urls);
        return urls;
    }

    /**
     * Validate FBref URL
     */
    static validateURL(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname === 'fbref.com' && urlObj.pathname.startsWith('/en/comps/');
        } catch (e) {
            return false;
        }
    }

    /**
     * Get URL count
     */
    static async getCount() {
        const urls = await this.loadURLs();
        return urls.length;
    }

    /**
     * Export URLs as JSON
     */
    static async exportURLs() {
        const urls = await this.loadURLs();
        return JSON.stringify(urls, null, 2);
    }

    /**
     * Import URLs from JSON
     */
    static async importURLs(jsonString) {
        try {
            const urls = JSON.parse(jsonString);

            // Validate all URLs
            for (const urlData of urls) {
                if (!this.validateURL(urlData.url)) {
                    throw new Error(`Invalid URL: ${urlData.url}`);
                }
            }

            await this.saveURLs(urls);
            return urls;
        } catch (e) {
            throw new Error('Invalid JSON or contains invalid URLs');
        }
    }

    /**
     * Get default URLs (for reference)
     */
    static getDefaults() {
        return [...DEFAULT_URLS];
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.URLManager = URLManager;
}
