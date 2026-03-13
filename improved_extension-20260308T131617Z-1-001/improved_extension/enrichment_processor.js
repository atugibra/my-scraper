/**
 * Data Enrichment Processor
 * Orchestrates odds, injury, and weather data collection
 * 
 * Features:
 * - Manages all three scrapers
 * - Progress tracking
 * - Error handling
 * - Results aggregation
 */

class EnrichmentProcessor {
    constructor() {
        this.oddsScraper = new window.OddsScraper();
        this.injuryScraper = new window.InjuryScraper();
        this.weatherCollector = null;
        this.results = null;
    }

    /**
     * Process all enrichment data
     */
    async processEnrichment(options) {
        const results = {
            odds: null,
            injuries: null,
            weather: null,
            clubelo: null,
            summary: {
                started: new Date().toISOString(),
                completed: null,
                totalTime: null
            }
        };

        const startTime = Date.now();

        // Calculate progress steps
        const enabledCount = [
            options.enableOdds,
            options.enableInjuries,
            options.enableWeather,
            options.enableClubElo
        ].filter(Boolean).length;

        const progressPerStep = 100 / (enabledCount || 1);
        let currentProgress = 0;

        try {
            // Step 1: Download odds data
            if (options.enableOdds) {
                this.sendStatus('📥 Downloading odds data...', currentProgress);
                results.odds = await this.processOdds(options.leagues);
                currentProgress += progressPerStep;
                this.sendStatus(`✅ Odds: ${results.odds.summary.totalMatches} matches`, currentProgress);
            }

            // Step 2: Scrape injuries
            if (options.enableInjuries) {
                this.sendStatus('🏥 Scraping injury data...', currentProgress);
                results.injuries = await this.processInjuries(options.leagues);
                currentProgress += progressPerStep;
                this.sendStatus(`✅ Injuries: ${results.injuries.summary.totalInjuries} found`, currentProgress);
            }

            // Step 3: Collect weather
            if (options.enableWeather && options.weatherApiKey) {
                this.sendStatus('🌤️  Collecting weather data...', currentProgress);
                results.weather = await this.processWeather(options.weatherApiKey, options.fixtures);
                currentProgress += progressPerStep;
                this.sendStatus(`✅ Weather: ${results.weather.count} matches`, currentProgress);
            }

            // Step 4: Fetch ClubElo fixtures
            if (options.enableClubElo) {
                this.sendStatus('📊 Fetching ClubElo fixtures...', currentProgress);
                results.clubelo = await this.processClubElo(options.clubeloDays);
                currentProgress += progressPerStep;
                this.sendStatus(`✅ ClubElo: ${results.clubelo.count} fixtures`, currentProgress);
            }

            // Complete
            const endTime = Date.now();
            results.summary.completed = new Date().toISOString();
            results.summary.totalTime = Math.round((endTime - startTime) / 1000);

            this.results = results;
            this.sendStatus('✅ Enrichment complete!', 100);

            return results;

        } catch (error) {
            this.sendStatus(`❌ Error: ${error.message}`, -1);
            throw error;
        }
    }

    /**
     * Process odds data
     */
    async processOdds(leagues) {
        const oddsResults = await this.oddsScraper.downloadAllLeagues(
            leagues,
            (progress) => {
                const percent = Math.round((progress.current / progress.total) * 100);
                this.sendStatus(
                    `📥 Odds: ${progress.league} (${progress.matches} matches)`,
                    percent * 0.33
                );
            }
        );

        const combinedOdds = this.oddsScraper.getCombinedData(oddsResults);
        const summary = this.oddsScraper.getSummary(oddsResults);

        return {
            data: combinedOdds,
            summary: summary,
            results: oddsResults
        };
    }

    /**
     * Process injury data
     */
    async processInjuries(leagues) {
        const injuryResults = await this.injuryScraper.scrapeAllLeagues(
            leagues,
            (progress) => {
                const percent = Math.round((progress.current / progress.total) * 100);
                this.sendStatus(
                    `🏥 Injuries: ${progress.league} (${progress.injuries} found)`,
                    33 + (percent * 0.33)
                );
            }
        );

        const combinedInjuries = this.injuryScraper.getCombinedData(injuryResults);
        const summary = this.injuryScraper.getSummary(injuryResults);

        return {
            data: combinedInjuries,
            summary: summary,
            results: injuryResults
        };
    }

    /**
     * Process weather data
     */
    async processWeather(apiKey, fixtures) {
        // Validate API key first
        this.weatherCollector = new window.WeatherCollector(apiKey);

        const validation = await this.weatherCollector.validateApiKey();
        if (!validation.valid) {
            throw new Error(`Invalid weather API key: ${validation.error}`);
        }

        // Collect weather for fixtures
        const weatherResults = await this.weatherCollector.collectFixturesWeather(
            fixtures,
            (progress) => {
                const percent = Math.round((progress.current / progress.total) * 100);
                this.sendStatus(
                    `🌤️  Weather: ${progress.match}`,
                    66 + (percent * 0.34)
                );
            }
        );

        return weatherResults;
    }

    /**
     * Process ClubElo fixtures
     */
    async processClubElo(days = 7) {
        if (!window.ClubEloScraper) {
            throw new Error('ClubElo scraper not loaded');
        }

        const clubelo = new window.ClubEloScraper();
        const results = await clubelo.fetchFixtures({ days });

        return results;
    }

    /**
     * Send status update to UI
     */
    sendStatus(message, progress) {
        // Send message via runtime
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'enrichmentStatus',
                message: message,
                progress: progress
            }).catch(() => {
                // Ignore errors (popup may be closed)
            });
        }

        // Also log to console
        console.log(`[Enrichment] ${message} (${progress}%)`);
    }

    /**
     * Get results
     */
    getResults() {
        return this.results;
    }

    /**
     * Get formatted summary
     */
    getSummaryText() {
        if (!this.results) {
            return 'No results available';
        }

        const lines = [];
        lines.push('='.repeat(50));
        lines.push('DATA ENRICHMENT SUMMARY');
        lines.push('='.repeat(50));

        if (this.results.odds) {
            lines.push(`\nOdds Data:`);
            lines.push(`  Total Matches: ${this.results.odds.summary.totalMatches}`);
            lines.push(`  Successful Leagues: ${this.results.odds.summary.successfulLeagues}/${this.results.odds.summary.totalLeagues}`);
        }

        if (this.results.injuries) {
            lines.push(`\nInjury Data:`);
            lines.push(`  Total Injuries: ${this.results.injuries.summary.totalInjuries}`);
            lines.push(`  Successful Leagues: ${this.results.injuries.summary.successfulLeagues}/${this.results.injuries.summary.totalLeagues}`);
        }

        if (this.results.weather) {
            lines.push(`\nWeather Data:`);
            lines.push(`  Matches with Weather: ${this.results.weather.count}`);
        }

        if (this.results.clubelo) {
            lines.push(`\nClubElo Fixtures:`);
            lines.push(`  Upcoming Matches: ${this.results.clubelo.count}`);
            lines.push(`  Days Ahead: ${this.results.clubelo.daysAhead}`);
        }

        lines.push(`\nTotal Time: ${this.results.summary.totalTime}s`);
        lines.push('='.repeat(50));

        return lines.join('\n');
    }
}

// Export for use in extension
if (typeof window !== 'undefined') {
    window.EnrichmentProcessor = EnrichmentProcessor;
}
