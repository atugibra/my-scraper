// Content Scraper for FBref Pages
// Extracts table data from FBref football statistics pages
// This script is injected into FBref pages to parse and extract structured data

(function () {
    'use strict';

    /**
     * Main extraction function
     * Returns structured data from the current FBref page
     */
    function extractPageData() {
        const pageData = {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            league: extractLeagueName(),
            season: extractSeason(),
            pageType: detectPageType(),
            tables: [],
            team_logos: {}   // team_name → absolute logo URL
        };

        // Find all tables with class 'stats_table' (FBref's standard table class)
        const tables = document.querySelectorAll('table.stats_table');

        console.log(`Found ${tables.length} tables on page`);

        tables.forEach((table, index) => {
            try {
                const tableData = extractTableData(table);
                if (tableData && tableData.rows.length > 0) {
                    pageData.tables.push(tableData);
                }
            } catch (error) {
                console.error(`Error extracting table ${index}:`, error);
            }
        });

        // Extract team logos from the page (works best on stats & standings pages)
        pageData.team_logos = extractTeamLogos();

        return pageData;
    }

    /**
     * Extract league name from page.
     * Handles FBref patterns like:
     *   "2025-2026 Premier League Stats"  → "Premier League"
     *   "Premier League Stats"            → "Premier League"
     *   "2. Bundesliga Scores & Fixtures" → "2. Bundesliga"
     */
    function extractLeagueName() {
        const selectors = [
            '[data-label="Competition"]',
            'h1',
            'title'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                let text = element.textContent.trim();

                // Strip leading season year patterns: "2024-2025 " or "2025 "
                text = text.replace(/^\d{4}[-\/]\d{2,4}\s+/, '').replace(/^\d{4}\s+/, '');

                // Strip trailing page-type words
                text = text.replace(/\s+(Stats|Scores|Fixtures|Standings|Results|Schedule|Tables?|Player\s+Stats).*$/i, '').trim();

                if (text && !text.match(/^\d{4}$/)) {
                    return text;
                }
            }
        }

        return 'Unknown League';
    }

    /**
     * Extract season from page.
     * Priority:
     *  1. URL path — historical FBref URLs contain /YYYY-YYYY/ e.g. /2024-2025/schedule/
     *  2. H1 text  — current season pages begin H1 with "2025-2026 League Name..."
     *  3. FBref season filter elements
     *  4. Default to current season 2025-2026
     */
    function extractSeason() {
        // 1. URL path (most reliable for historical pages)
        const urlMatch = window.location.href.match(/\/(\d{4}-\d{4})\//);
        if (urlMatch) {
            return urlMatch[1];
        }

        // 2. H1 text directly (FBref does NOT wrap season in a span)
        const h1 = document.querySelector('h1');
        if (h1) {
            const match = h1.textContent.trim().match(/\d{4}-\d{4}/);
            if (match) return match[0];
        }

        // 3. FBref season filter or meta elements
        const seasonSelectors = ['[data-label="Season"]', '.filter .current', '#meta'];
        for (const selector of seasonSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const match = el.textContent.trim().match(/\d{4}-\d{4}/);
                if (match) return match[0];
            }
        }

        // 4. Default — current season
        return '2025-2026';
    }

    /**
     * Detect what type of page this is
     */
    function detectPageType() {
        const url = window.location.href;

        if (url.includes('/schedule/') || url.includes('Fixtures')) {
            return 'fixtures';
        } else if (url.includes('/stats/') || url.includes('Stats')) {
            return 'stats';
        } else if (url.includes('standings') || url.includes('table')) {
            return 'standings';
        }

        return 'unknown';
    }

    /**
     * Extract team logos from the current FBref page.
     *
     * FBref embeds small team crest images inside the squad/team name cells of
     * stats and standings tables.  The img elements typically look like:
     *   <img class="teamlogo" src="/mini/team_logos/18bb7c10.png" ...>
     * or the newer CDN path:
     *   <img src="https://cdn.fbref.com/req/.../team_logos/18bb7c10.png">
     *
     * We walk every row, find the cell whose data-stat is "squad" or "team",
     * pull the <img> inside it, resolve the src to an absolute URL, and build
     * a  { teamName: logoUrl }  map.
     */
    function extractTeamLogos() {
        const logos = {};
        const FBREF_ORIGIN = 'https://fbref.com';

        // FBref uses data-stat="squad" on the team-name cell in stats tables
        // and data-stat="team" on some other pages.
        const teamCellSelectors = [
            'td[data-stat="squad"]',
            'td[data-stat="team"]',
            'th[data-stat="squad"]',
        ];

        teamCellSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(cell => {
                // Team name — prefer the anchor text, fall back to cell text
                const anchor = cell.querySelector('a');
                const teamName = (anchor ? anchor.textContent : cell.textContent).trim();
                if (!teamName || teamName === 'Squad' || teamName === 'Team') return;

                // Logo image — FBref puts a small img just before/inside the anchor
                const img = cell.querySelector('img.teamlogo, img[src*="team_logo"], img[src*="team-logo"]') ||
                            cell.closest('tr')?.querySelector('td[data-stat="team_logo"] img, td.team_logo img') ||
                            cell.querySelector('img');

                if (!img) return;

                let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                if (!src) return;

                // Resolve relative URLs to absolute
                if (src.startsWith('//')) {
                    src = 'https:' + src;
                } else if (src.startsWith('/')) {
                    src = FBREF_ORIGIN + src;
                }

                // Only save the first occurrence per team (avoids overwriting with a worse URL)
                if (!logos[teamName]) {
                    logos[teamName] = src;
                }
            });
        });

        // Also look for standalone team-logo cells (some FBref page layouts)
        document.querySelectorAll('td[data-stat="team_logo"] img, td.team_logo img').forEach(img => {
            const row = img.closest('tr');
            if (!row) return;
            const nameCell = row.querySelector('td[data-stat="squad"] a, td[data-stat="team"] a') ||
                             row.querySelector('th[data-stat="squad"] a');
            if (!nameCell) return;
            const teamName = nameCell.textContent.trim();
            if (!teamName || logos[teamName]) return;
            let src = img.getAttribute('src') || '';
            if (src.startsWith('/')) src = 'https://fbref.com' + src;
            if (src) logos[teamName] = src;
        });

        console.log(`Extracted logos for ${Object.keys(logos).length} teams`);
        return logos;
    }

    /**
     * Extract data from a single table
     */
    function extractTableData(table) {
        // Get table caption/name
        const caption = table.querySelector('caption');
        const tableName = caption ? caption.textContent.trim() : 'Unnamed Table';

        // Get thead - headers
        const thead = table.querySelector('thead');
        if (!thead) {
            console.warn('Table has no thead:', tableName);
            return null;
        }

        const headers = extractHeaders(thead);

        // Get tbody - data rows
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.warn('Table has no tbody:', tableName);
            return null;
        }

        const rows = extractRows(tbody, headers.length);

        return {
            name: tableName,
            id: table.id || null,
            headers: headers,
            rows: rows,
            rowCount: rows.length,
            columnCount: headers.length
        };
    }

    /**
     * Extract headers from thead
     * Handles multi-row headers and colspan/rowspan
     */
    function extractHeaders(thead) {
        const headers = [];
        const headerRows = thead.querySelectorAll('tr');

        // For simplicity, use the last header row (usually contains the actual column names)
        const lastHeaderRow = headerRows[headerRows.length - 1];
        const ths = lastHeaderRow.querySelectorAll('th');

        ths.forEach(th => {
            let headerText = th.textContent.trim();

            // Clean up header text
            headerText = headerText.replace(/\s+/g, ' ');

            // Handle data-stat attribute (FBref's way of identifying columns)
            const dataStat = th.getAttribute('data-stat');
            if (dataStat) {
                headerText = dataStat;
            }

            headers.push(headerText);
        });

        return headers;
    }

    /**
     * Extract data rows from tbody
     */
    function extractRows(tbody, expectedColumns) {
        const rows = [];
        const trs = tbody.querySelectorAll('tr');

        trs.forEach(tr => {
            // Skip spacer/separator rows
            if (tr.classList.contains('thead') || tr.classList.contains('spacer')) {
                return;
            }

            const row = [];
            const cells = tr.querySelectorAll('th, td');

            cells.forEach(cell => {
                let cellValue = cell.textContent.trim();

                // Get data-stat for better column identification
                const dataStat = cell.getAttribute('data-stat');

                // Columns where csk is a sort-only composite/number — must use display text
                //   referee  → csk = "{name}{YYYYMMDD}" (e.g. "Richard Hempel20250801")
                //   position → csk = 1/2/3/4/3.5 sort integer (e.g. "3.5" for MF/FW)
                //   score    → csk strips the dash ("21" instead of "2–1")
                const USE_TEXT_NOT_CSK = new Set(['referee', 'position', 'pos', 'score']);

                // Try to get sort key value (more reliable for dates, attendance, age…)
                const csk = cell.getAttribute('csk') || cell.getAttribute('data-csk');
                if (csk && !USE_TEXT_NOT_CSK.has(dataStat)) {
                    cellValue = csk;
                }

                // Check for links (team names, player names often have links)
                const link = cell.querySelector('a');
                if (link) {
                    const href = link.getAttribute('href');
                    // Store both text and link
                    cellValue = {
                        text: cellValue,
                        link: href ? `https://fbref.com${href}` : null
                    };
                }

                row.push(cellValue);
            });

            // Only add rows that have data
            if (row.length > 0) {
                rows.push(row);
            }
        });

        return rows;
    }

    // Execute extraction and return result
    try {
        const data = extractPageData();
        console.log('Extracted data:', data);
        return data;
    } catch (error) {
        console.error('Error in content scraper:', error);
        return {
            error: error.message,
            url: window.location.href
        };
    }
})();
