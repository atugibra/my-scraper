/**
 * ClubElo Fixtures Scraper
 * Fetches upcoming match predictions from api.clubelo.com
 * 
 * Features:
 * - Statistical match probabilities (Elo-based)
 * - Traditional 1X2 odds calculation
 * - Exact score predictions
 * - Filter by date range
 */

class ClubEloScraper {
    constructor() {
        this.baseUrl = 'https://api.clubelo.com';
    }

    /**
     * Fetch upcoming fixtures with probabilities
     */
    async fetchFixtures(options = {}) {
        const days = options.days || 7;

        try {
            console.log(`📊 Fetching ClubElo fixtures for next ${days} days...`);

            // Add timeout to fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(`${this.baseUrl}/Fixtures`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const rawData = await response.json();
            console.log(`✅ Received ${rawData.length} total fixtures from ClubElo`);

            // Filter by date range
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() + days);

            const fixtures = rawData
                .filter(f => {
                    const fixtureDate = new Date(f.Date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return fixtureDate >= today && fixtureDate <= cutoffDate;
                })
                .map(f => this.parseFixture(f));

            console.log(`✅ Filtered to ${fixtures.length} fixtures in next ${days} days`);

            return {
                fixtures: fixtures,
                count: fixtures.length,
                daysAhead: days,
                fetchedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ ClubElo fetch error:', error);

            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = 'Request timeout - ClubElo API did not respond within 10 seconds';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error - ClubElo API may be down or CORS blocked';
            }

            return {
                fixtures: [],
                count: 0,
                error: errorMessage,
                fetchedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Parse fixture data and calculate odds
     */
    parseFixture(fixture) {
        // Calculate 1X2 odds from goal difference probabilities
        const odds = this.calculate1X2Odds(fixture);

        // Find most likely score
        const { score, probability } = this.findMostLikelyScore(fixture);

        return {
            date: fixture.Date,
            home: fixture.HomeTeam,
            away: fixture.AwayTeam,
            odds: {
                home: odds.home,
                draw: odds.draw,
                away: odds.away,
                homePercent: (odds.home * 100).toFixed(1),
                drawPercent: (odds.draw * 100).toFixed(1),
                awayPercent: (odds.away * 100).toFixed(1)
            },
            mostLikelyScore: score,
            scoreProb: probability,
            scoreProbPercent: (probability * 100).toFixed(1),
            // Store raw probabilities for advanced analysis
            goalDiffProbs: this.extractGoalDiffProbs(fixture),
            scoreProbs: this.extractScoreProbs(fixture)
        };
    }

    /**
     * Calculate traditional 1X2 odds from goal difference probabilities
     */
    calculate1X2Odds(fixture) {
        // Home Win = sum of all positive goal differences
        const homeWin = (fixture['Prob+1'] || 0) +
            (fixture['Prob+2'] || 0) +
            (fixture['Prob+3'] || 0) +
            (fixture['Prob+4'] || 0) +
            (fixture['Prob+5'] || 0) +
            (fixture['Prob>+5'] || 0);

        // Draw = goal difference 0
        const draw = fixture['Prob0'] || 0;

        // Away Win = sum of all negative goal differences
        const awayWin = (fixture['Prob-1'] || 0) +
            (fixture['Prob-2'] || 0) +
            (fixture['Prob-3'] || 0) +
            (fixture['Prob-4'] || 0) +
            (fixture['Prob-5'] || 0) +
            (fixture['Prob<-5'] || 0);

        return {
            home: homeWin,
            draw: draw,
            away: awayWin
        };
    }

    /**
     * Find most likely exact score
     */
    findMostLikelyScore(fixture) {
        const scores = [];

        // Extract all score probabilities (format: Prob0-0, Prob1-0, etc.)
        for (const key in fixture) {
            if (key.startsWith('Prob') && key.includes('-') && key !== 'Prob-1' && key !== 'Prob-2') {
                const score = key.replace('Prob', '');
                const probability = fixture[key];
                if (probability) {
                    scores.push({ score, probability });
                }
            }
        }

        // Find highest probability
        if (scores.length === 0) {
            return { score: 'Unknown', probability: 0 };
        }

        scores.sort((a, b) => b.probability - a.probability);
        return scores[0];
    }

    /**
     * Extract goal difference probabilities
     */
    extractGoalDiffProbs(fixture) {
        return {
            'away5plus': fixture['Prob<-5'] || 0,
            'away5': fixture['Prob-5'] || 0,
            'away4': fixture['Prob-4'] || 0,
            'away3': fixture['Prob-3'] || 0,
            'away2': fixture['Prob-2'] || 0,
            'away1': fixture['Prob-1'] || 0,
            'draw': fixture['Prob0'] || 0,
            'home1': fixture['Prob+1'] || 0,
            'home2': fixture['Prob+2'] || 0,
            'home3': fixture['Prob+3'] || 0,
            'home4': fixture['Prob+4'] || 0,
            'home5': fixture['Prob+5'] || 0,
            'home5plus': fixture['Prob>+5'] || 0
        };
    }

    /**
     * Extract exact score probabilities
     */
    extractScoreProbs(fixture) {
        const scoreProbs = {};

        for (const key in fixture) {
            if (key.startsWith('Prob') && key.includes('-') &&
                key !== 'Prob-1' && key !== 'Prob-2' &&
                key !== 'Prob-3' && key !== 'Prob-4' &&
                key !== 'Prob-5' && key !== 'Prob<-5') {
                const score = key.replace('Prob', '');
                scoreProbs[score] = fixture[key];
            }
        }

        return scoreProbs;
    }

    /**
     * Get summary statistics
     */
    getSummary(results) {
        if (!results.fixtures || results.fixtures.length === 0) {
            return 'No fixtures found';
        }

        const summary = {
            totalFixtures: results.count,
            dateRange: `${results.daysAhead} days`,
            highConfidenceMatches: results.fixtures.filter(f =>
                Math.max(f.odds.home, f.odds.draw, f.odds.away) > 0.5
            ).length
        };

        return `${summary.totalFixtures} fixtures (${summary.highConfidenceMatches} high confidence)`;
    }
}

// Export for use in extension
if (typeof window !== 'undefined') {
    window.ClubEloScraper = ClubEloScraper;
}
