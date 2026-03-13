/**
 * Injury Scraper for Chrome Extension
 * Scrapes injury data from Transfermarkt.com
 * 
 * Features:
 * - Opens pages in background tabs
 * - Extracts injury tables
 * - Auto-closes tabs after scraping
 * - Respectful delays between requests
 */

class InjuryScraper {
    constructor() {
        this.baseUrl = 'https://www.transfermarkt.com';

        // League URLs
        this.leagueUrls = {
            'Premier League': '/premier-league/verletztespieler/wettbewerb/GB1',
            'Championship': '/championship/verletztespieler/wettbewerb/GB2',
            'Bundesliga': '/bundesliga/verletztespieler/wettbewerb/L1',
            '2. Bundesliga': '/2-bundesliga/verletztespieler/wettbewerb/L2',
            'La Liga': '/laliga/verletztespieler/wettbewerb/ES1',
            'Segunda Division': '/segunda-division/verletztespieler/wettbewerb/ES2',
            'Serie A': '/serie-a/verletztespieler/wettbewerb/IT1',
            'Serie B': '/serie-b/verletztespieler/wettbewerb/IT2',
            'Ligue 1': '/ligue-1/verletztespieler/wettbewerb/FR1',
            'Ligue 2': '/ligue-2/verletztespieler/wettbewerb/FR2',
            'Eredivisie': '/eredivisie/verletztespieler/wettbewerb/NL1',
            'Belgian Pro League': '/jupiler-pro-league/verletztespieler/wettbewerb/BE1',
            'Super Lig': '/super-lig/verletztespieler/wettbewerb/TR1'
        };
    }

    /**
     * Scrape injuries for a specific league
     */
    async scrapeLeagueInjuries(leagueName) {
        const leagueUrl = this.leagueUrls[leagueName];
        if (!leagueUrl) {
            throw new Error(`Unknown league: ${leagueName}`);
        }

        const url = this.baseUrl + leagueUrl;

        try {
            // Create background tab
            const tab = await chrome.tabs.create({
                url: url,
                active: false
            });

            // Wait for page to load
            await this.waitForTabLoad(tab.id);

            // Give extra time for content to render
            await this.delay(2000);

            // Execute scraping script in page context
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: this.extractInjuriesFromPage
            });

            // Close tab
            await chrome.tabs.remove(tab.id);

            const injuries = results[0]?.result || [];

            // Add league name to each injury
            injuries.forEach(injury => {
                injury.League = leagueName;
            });

            return {
                league: leagueName,
                injuries: injuries,
                count: injuries.length
            };

        } catch (error) {
            console.error(`Failed to scrape ${leagueName} injuries:`, error);
            return {
                league: leagueName,
                injuries: [],
                count: 0,
                error: error.message
            };
        }
    }

    /**
     * Function that runs in page context to extract injuries
     * (This is injected into the Transfermarkt page)
     */
    extractInjuriesFromPage() {
        const injuries = [];

        try {
            // Find injury table (Transfermarkt uses class 'items')
            const table = document.querySelector('table.items');
            if (!table) {
                return injuries;
            }

            // Get all data rows
            const rows = table.querySelectorAll('tr.odd, tr.even');

            rows.forEach(row => {
                try {
                    const cells = row.querySelectorAll('td');

                    if (cells.length < 5) return;

                    // Extract player name
                    const playerCell = cells[0];
                    const playerLink = playerCell.querySelector('a.spielprofil_tooltip');
                    const playerName = playerLink ? playerLink.textContent.trim() : '';

                    // Extract team name
                    const teamCell = cells[1];
                    const teamLink = teamCell.querySelector('a');
                    const teamName = teamLink ? teamLink.getAttribute('title') || teamLink.textContent.trim() : '';

                    // Extract injury type
                    const injuryCell = cells[3];
                    const injuryType = injuryCell.textContent.trim();

                    // Extract return date
                    const returnCell = cells[4];
                    const returnDate = returnCell.textContent.trim();

                    if (playerName && teamName) {
                        injuries.push({
                            Player: playerName,
                            Team: teamName,
                            Injury: injuryType || 'Unknown',
                            Return_Date: returnDate || 'Unknown',
                            Scraped_Date: new Date().toISOString().split('T')[0]
                        });
                    }

                } catch (rowError) {
                    console.warn('Error parsing injury row:', rowError);
                }
            });

        } catch (error) {
            console.error('Error extracting injuries:', error);
        }

        return injuries;
    }

    /**
     * Wait for tab to complete loading
     */
    waitForTabLoad(tabId) {
        return new Promise((resolve) => {
            const listener = (updatedTabId, changeInfo) => {
                if (updatedTabId === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };

            chrome.tabs.onUpdated.addListener(listener);

            // Timeout after 30 seconds
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }, 30000);
        });
    }

    /**
     * Scrape multiple leagues
     */
    async scrapeAllLeagues(leagues, onProgress = null) {
        const results = [];
        let completed = 0;

        for (const league of leagues) {
            const result = await this.scrapeLeagueInjuries(league);
            results.push(result);

            completed++;
            if (onProgress) {
                onProgress({
                    current: completed,
                    total: leagues.length,
                    league: league,
                    injuries: result.count
                });
            }

            // Delay between leagues to be respectful
            await this.delay(2000);
        }

        return results;
    }

    /**
     * Get combined injury data
     */
    getCombinedData(results) {
        const allInjuries = [];

        results.forEach(result => {
            if (result.injuries && result.injuries.length > 0) {
                allInjuries.push(...result.injuries);
            }
        });

        return allInjuries;
    }

    /**
     * Get summary statistics
     */
    getSummary(results) {
        const summary = {
            totalLeagues: results.length,
            successfulLeagues: 0,
            failedLeagues: 0,
            totalInjuries: 0,
            leagueBreakdown: []
        };

        results.forEach(result => {
            if (result.error) {
                summary.failedLeagues++;
            } else {
                summary.successfulLeagues++;
                summary.totalInjuries += result.count;
            }

            summary.leagueBreakdown.push({
                league: result.league,
                injuries: result.count,
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
    window.InjuryScraper = InjuryScraper;
}
