// Enhanced Content Scraper for FBref Pages
// STANDALONE VERSION - Handles tables that the original scraper misses
// Fixes: Ligue 1, Ligue 2, Serie B, Super Lig stat pages
// NOTE: This is a standalone file - does NOT modify the original working extension

(function () {
    'use strict';

    /**
     * Enhanced table detection with multiple fallback strategies
     * Handles:
     * 1. Standard stats_table class
     * 2. Tables in HTML comments (FBref anti-scraping)
     * 3. Generic table detection as last resort
     */
    function findAllTables() {
        const foundTables = [];
        const tableIds = new Set(); // Avoid duplicates

        // Strategy 1: Standard stats_table class (works for most leagues)
        console.log('Strategy 1: Looking for table.stats_table...');
        const standardTables = document.querySelectorAll('table.stats_table');
        standardTables.forEach(table => {
            if (!tableIds.has(table.id || table.outerHTML.substring(0, 100))) {
                foundTables.push({ table, source: 'standard_class' });
                tableIds.add(table.id || table.outerHTML.substring(0, 100));
            }
        });
        console.log(`  Found ${standardTables.length} tables with stats_table class`);

        // Strategy 2: Extract tables from HTML comments
        // FBref sometimes hides tables in comments like <!-- <table class="stats_table"> -->
        console.log('Strategy 2: Checking HTML comments for hidden tables...');
        const commentTables = extractTablesFromComments();
        commentTables.forEach(table => {
            if (!tableIds.has(table.id || table.outerHTML.substring(0, 100))) {
                foundTables.push({ table, source: 'html_comment' });
                tableIds.add(table.id || table.outerHTML.substring(0, 100));
            }
        });
        console.log(`  Found ${commentTables.length} tables in HTML comments`);

        // Strategy 3: Generic table detection (last resort)
        // Look for tables with typical FBref structure even without stats_table class
        if (foundTables.length === 0) {
            console.log('Strategy 3: Using generic table detection...');
            const allTables = document.querySelectorAll('table');
            allTables.forEach(table => {
                // Check if table looks like an FBref stats table
                const caption = table.querySelector('caption');
                const thead = table.querySelector('thead');
                const tbody = table.querySelector('tbody');

                // Must have caption, thead, and tbody to be a valid stats table
                if (caption && thead && tbody) {
                    const rows = tbody.querySelectorAll('tr');
                    // Must have at least 5 rows to be meaningful
                    if (rows.length >= 5 && !tableIds.has(table.id || table.outerHTML.substring(0, 100))) {
                        foundTables.push({ table, source: 'generic_detection' });
                        tableIds.add(table.id || table.outerHTML.substring(0, 100));
                    }
                }
            });
            console.log(`  Found ${foundTables.length - standardTables.length - commentTables.length} tables via generic detection`);
        }

        console.log(`Total tables found: ${foundTables.length}`);
        return foundTables;
    }

    /**
     * Extract tables hidden in HTML comments
     * FBref sometimes wraps tables in comments: <!-- <table>...</table> -->
     */
    function extractTablesFromComments() {
        const tables = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_COMMENT,
            null,
            false
        );

        let comment;
        while (comment = walker.nextNode()) {
            const commentText = comment.textContent;

            // Check if comment contains a table
            if (commentText.includes('<table') && commentText.includes('</table>')) {
                try {
                    // Create a temporary container to parse the HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = commentText;

                    // Extract all tables from the comment
                    const commentTables = tempDiv.querySelectorAll('table');
                    commentTables.forEach(table => {
                        // Insert the table into the DOM (temporarily, in a hidden div)
                        const hiddenDiv = document.createElement('div');
                        hiddenDiv.style.display = 'none';
                        hiddenDiv.appendChild(table.cloneNode(true));
                        document.body.appendChild(hiddenDiv);

                        tables.push(hiddenDiv.querySelector('table'));
                    });
                } catch (error) {
                    console.warn('Error parsing table from comment:', error);
                }
            }
        }

        return tables;
    }

    /**
     * Main extraction function - Enhanced version
     */
    function extractPageData() {
        const pageData = {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            league: extractLeagueName(),
            season: extractSeason(),
            pageType: detectPageType(),
            tables: [],
            extractionMethod: [] // Track which strategies worked
        };

        // Use enhanced table detection
        const foundTables = findAllTables();

        console.log(`Processing ${foundTables.length} tables...`);

        foundTables.forEach(({ table, source }, index) => {
            try {
                const tableData = extractTableData(table);
                if (tableData && tableData.rows.length > 0) {
                    tableData.extractionSource = source; // Track how we found this table
                    pageData.tables.push(tableData);
                    if (!pageData.extractionMethod.includes(source)) {
                        pageData.extractionMethod.push(source);
                    }
                }
            } catch (error) {
                console.error(`Error extracting table ${index}:`, error);
            }
        });

        console.log(`Successfully extracted ${pageData.tables.length} tables`);
        console.log(`Extraction methods used: ${pageData.extractionMethod.join(', ')}`);

        return pageData;
    }

    /**
     * Extract league name from page
     */
    function extractLeagueName() {
        const selectors = [
            'h1',
            'title',
            '[data-label="Competition"]'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent.trim();
                const match = text.match(/^([^-]+)/);
                if (match) {
                    return match[1].trim();
                }
            }
        }

        return 'Unknown League';
    }

    /**
     * Extract season from page
     */
    function extractSeason() {
        const seasonSelectors = [
            '[data-label="Season"]',
            'h1 span',
            '.filter .current'
        ];

        for (const selector of seasonSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent.trim();
                const match = text.match(/\d{4}[-\/]?\d{0,4}/);
                if (match) {
                    return match[0];
                }
            }
        }

        return '2024-2025';
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
     * Extract data from a single table
     */
    function extractTableData(table) {
        const caption = table.querySelector('caption');
        const tableName = caption ? caption.textContent.trim() : 'Unnamed Table';

        const thead = table.querySelector('thead');
        if (!thead) {
            console.warn('Table has no thead:', tableName);
            return null;
        }

        const headers = extractHeaders(thead);

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
     */
    function extractHeaders(thead) {
        const headers = [];
        const headerRows = thead.querySelectorAll('tr');
        const lastHeaderRow = headerRows[headerRows.length - 1];
        const ths = lastHeaderRow.querySelectorAll('th');

        ths.forEach(th => {
            let headerText = th.textContent.trim();
            headerText = headerText.replace(/\s+/g, ' ');

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
            if (tr.classList.contains('thead') || tr.classList.contains('spacer')) {
                return;
            }

            const row = [];
            const cells = tr.querySelectorAll('th, td');

            cells.forEach(cell => {
                let cellValue = cell.textContent.trim();

                const csk = cell.getAttribute('csk') || cell.getAttribute('data-csk');
                if (csk) {
                    cellValue = csk;
                }

                const link = cell.querySelector('a');
                if (link) {
                    const href = link.getAttribute('href');
                    cellValue = {
                        text: cellValue,
                        link: href ? `https://fbref.com${href}` : null
                    };
                }

                row.push(cellValue);
            });

            if (row.length > 0) {
                rows.push(row);
            }
        });

        return rows;
    }

    // Execute extraction and return result
    try {
        const data = extractPageData();
        console.log('ENHANCED SCRAPER - Extracted data:', data);
        return data;
    } catch (error) {
        console.error('Error in enhanced content scraper:', error);
        return {
            error: error.message,
            url: window.location.href
        };
    }
})();
