/**
 * Odds Scraper for Chrome Extension
 * Downloads CSV data from Football-Data.co.uk
 * 
 * Features:
 * - Downloads historical odds CSV files
 * - Parses CSV in browser
 * - Supports multiple leagues
 * - No external dependencies
 */

class OddsScraper {
    constructor() {
        this.baseUrl = 'https://www.football-data.co.uk/mmz4281';

        // League code mapping
        this.leagueCodes = {
            'Premier League': 'E0',
            'Championship': 'E1',
            'League One': 'E2',
            'League Two': 'E3',
            'Bundesliga': 'D1',
            '2. Bundesliga': 'D2',
            'La Liga': 'SP1',
            'Segunda Division': 'SP2',
            'Serie A': 'I1',
            'Serie B': 'I2',
            'Ligue 1': 'F1',
            'Ligue 2': 'F2',
            'Eredivisie': 'N1',
            'Belgian Pro League': 'B1',
            'Super Lig': 'T1'
        };

        this.currentSeason = this.getCurrentSeasonCode();
    }

    /**
     * Get current season code (e.g., '2425' for 2024-2025)
     */
    getCurrentSeasonCode() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Season starts in August
        const seasonYear = month >= 8 ? year : year - 1;
        const nextYear = seasonYear + 1;

        return `${seasonYear.toString().slice(-2)}${nextYear.toString().slice(-2)}`;
    }

    /**
     * Download odds CSV for a specific league
     */
    async downloadLeagueOdds(leagueName, seasonCode = null) {
        const code = this.leagueCodes[leagueName];
        if (!code) {
            throw new Error(`Unknown league: ${leagueName}`);
        }

        const season = seasonCode || this.currentSeason;
        const url = `${this.baseUrl}/${season}/${code}.csv`;

        try {
            const response = await fetch(url, {
                mode: 'cors',
                headers: {
                    'Accept': 'text/csv'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const csvText = await response.text();
            const data = this.parseCSV(csvText);

            // Add league name to each row
            data.forEach(row => {
                row.League = leagueName;
            });

            return {
                league: leagueName,
                season: season,
                matches: data,
                count: data.length
            };

        } catch (error) {
            console.error(`Failed to download ${leagueName} odds:`, error);
            return {
                league: leagueName,
                season: season,
                matches: [],
                count: 0,
                error: error.message
            };
        }
    }

    /**
     * Parse CSV text into array of objects
     */
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim());

        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = this.parseCSVLine(line);
            const row = {};

            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            data.push(row);
        }

        return data;
    }

    /**
     * Parse a single CSV line (handles quoted values)
     */
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current.trim());
        return values;
    }

    /**
     * Download odds for multiple leagues
     */
    async downloadAllLeagues(leagues, onProgress = null) {
        const results = [];
        let completed = 0;

        for (const league of leagues) {
            const result = await this.downloadLeagueOdds(league);
            results.push(result);

            completed++;
            if (onProgress) {
                onProgress({
                    current: completed,
                    total: leagues.length,
                    league: league,
                    matches: result.count
                });
            }

            // Small delay to be respectful
            await this.delay(500);
        }

        return results;
    }

    /**
     * Get combined odds data from all leagues
     */
    getCombinedData(results) {
        const allMatches = [];

        results.forEach(result => {
            if (result.matches && result.matches.length > 0) {
                allMatches.push(...result.matches);
            }
        });

        return allMatches;
    }

    /**
     * Get summary statistics
     */
    getSummary(results) {
        const summary = {
            totalLeagues: results.length,
            successfulLeagues: 0,
            failedLeagues: 0,
            totalMatches: 0,
            leagueBreakdown: []
        };

        results.forEach(result => {
            if (result.error) {
                summary.failedLeagues++;
            } else {
                summary.successfulLeagues++;
                summary.totalMatches += result.count;
            }

            summary.leagueBreakdown.push({
                league: result.league,
                matches: result.count,
                status: result.error ? 'failed' : 'success',
                error: result.error || null
            });
        });

        return summary;
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in extension
if (typeof window !== 'undefined') {
    window.OddsScraper = OddsScraper;
}
