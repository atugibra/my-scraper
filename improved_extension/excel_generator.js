// Excel Generator for Football Data Extension
// Converts extracted FBref data into Excel XLSM files with multiple sheets
// Uses SheetJS library (loaded externally)

/**
 * Main function to generate Excel file from extracted data
 * @param {Array} allData - Array of extracted page data from content_scraper.js
 * @param {Object} options - Generation options
 * @returns {Blob} Excel file blob
 */
function generateExcel(allData, options = {}) {
    // Ensure XLSX library is loaded
    if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS library not loaded! Make sure xlsx.full.min.js is included.');
    }

    const {
        filename = 'Football_Data.xlsx',
        includeMetadata = true
    } = options;

    // Create new workbook
    const workbook = XLSX.utils.book_new();

    // Add metadata sheet if requested
    if (includeMetadata) {
        const metadataSheet = createMetadataSheet(allData);
        XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    }

    // Process each page's data
    allData.forEach((pageData, index) => {
        if (!pageData || pageData.error) {
            console.warn(`Skipping page ${index} due to error:`, pageData?.error);
            return;
        }

        // Create sheets for each table in the page data
        pageData.tables.forEach((table, tableIndex) => {
            const sheetName = generateSheetName(pageData.league, pageData.pageType, table.name, tableIndex);
            const worksheet = createWorksheet(table);

            try {
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
                console.log(`✅ Created sheet: ${sheetName}`);
            } catch (error) {
                console.error(`Error creating sheet ${sheetName}:`, error);
            }
        });
    });

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        compression: true
    });

    return new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

/**
 * Create metadata sheet with summary information
 */
function createMetadataSheet(allData) {
    const metadata = [
        ['Football Data Export'],
        [''],
        ['Generated', new Date().toLocaleString()],
        ['Total Pages', allData.length],
        ['Total Tables', allData.reduce((sum, page) => sum + (page.tables?.length || 0), 0)],
        [''],
        ['Page Summary'],
        ['League', 'Page Type', 'Tables', 'URL']
    ];

    allData.forEach(page => {
        if (page && !page.error) {
            metadata.push([
                page.league || 'Unknown',
                page.pageType || 'unknown',
                page.tables?.length || 0,
                page.url || ''
            ]);
        }
    });

    return XLSX.utils.aoa_to_sheet(metadata);
}

/**
 * Generate a valid sheet name (Excel has 31 char limit, no special chars)
 */
function generateSheetName(league, pageType, tableName, tableIndex) {
    // Clean the actual table name from FBref
    // Examples: "Squad Standard Stats" -> "Squad_Standard"
    let cleanTable = (tableName || 'Table')
        .replace(/[\\/:*?[\]]/g, '')    // Remove invalid Excel chars
        .replace(/\s+/g, '_')            // Replace spaces with underscores
        .replace(/_Stats?$/i, '')        // Remove trailing "Stats" or "Stat"
        .replace(/^Squad_/, '')          // Remove "Squad_" prefix to save space
        .replace(/^Opponent_/, 'Opp_')   // Shorten "Opponent"
        .substring(0, 20);               // Limit length

    // Clean league name (shorter)
    let cleanLeague = (league || 'Unknown')
        .replace(/[\\/:*?[\]]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_League$/i, '')        // Remove "_League" suffix
        .substring(0, 10);               // Shorter league name

    // Combine: League_TableName
    // Examples: "Premier_Standard", "Bundesliga_Goalkeeping"
    let sheetName = `${cleanLeague}_${cleanTable}`;

    // Ensure name is under 31 characters (Excel limit)
    if (sheetName.length > 31) {
        sheetName = sheetName.substring(0, 31);
    }

    return sheetName;
}

/**
 * Create worksheet from table data
 */
function createWorksheet(table) {
    // Start with headers
    const data = [table.headers];

    // Add all rows
    table.rows.forEach(row => {
        // Handle cells that might be objects (with text and link)
        const cleanRow = row.map(cell => {
            if (typeof cell === 'object' && cell !== null) {
                // If cell has both text and link, use text for display
                return cell.text || cell.link || '';
            }
            return cell;
        });
        data.push(cleanRow);
    });

    // Convert array of arrays to worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Auto-size columns (approximate)
    const colWidths = [];
    data[0].forEach((header, colIndex) => {
        let maxWidth = String(header).length;

        // Check first 10 rows to estimate width
        for (let i = 1; i < Math.min(data.length, 11); i++) {
            const cellLength = String(data[i][colIndex] || '').length;
            maxWidth = Math.max(maxWidth, cellLength);
        }

        // Cap at 50 characters
        colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
    });

    worksheet['!cols'] = colWidths;

    // Freeze header row
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

    return worksheet;
}

/**
 * Download the Excel file
 */
function downloadExcel(blob, filename = 'Football_Data.xlsx') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Trigger download via Chrome extension API
 */
async function downloadExcelViaExtension(blob, filename = 'Football_Data.xlsx', folder = 'football_data') {
    // Convert blob to data URL
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;

            chrome.downloads.download({
                url: dataUrl,
                filename: `${folder}/${filename}`,
                saveAs: false,
                conflictAction: 'overwrite'
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(downloadId);
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Export functions for use in extension
if (typeof window !== 'undefined') {
    window.ExcelGenerator = {
        generateExcel,
        downloadExcel,
        downloadExcelViaExtension,
        createMetadataSheet,
        createWorksheet,
        generateCombinedExcel  // NEW: Combined generator
    };
}

/**
 * NEW FUNCTION: Generate Combined Excel with table titles and league grouping
 * @param {Array} allData - Array of extracted page data
 * @param {Object} options - Generation options
 * @returns {Blob} Excel file blob
 */
function generateCombinedExcel(allData, options = {}) {
    // Ensure XLSX library is loaded
    if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS library not loaded!');
    }

    const {
        filename = 'Football_Data_All_Leagues.xlsx',
        includeMetadata = true,
        combineByLeague = true
    } = options;

    // Create new workbook
    const workbook = XLSX.utils.book_new();

    // Add metadata sheet if requested
    if (includeMetadata) {
        const metadataSheet = createMetadataSheet(allData);
        XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    }

    if (combineByLeague) {
        // Group data by league
        const leagueGroups = {};

        allData.forEach((pageData, index) => {
            if (!pageData || pageData.error) {
                console.warn(`Skipping page ${index} due to error:`, pageData?.error);
                return;
            }

            const leagueName = pageData.leagueName || pageData.league || 'Unknown';

            if (!leagueGroups[leagueName]) {
                leagueGroups[leagueName] = [];
            }

            leagueGroups[leagueName].push(pageData);
        });

        // Create one sheet per league with all tables combined
        Object.keys(leagueGroups).forEach(leagueName => {
            const leagueData = leagueGroups[leagueName];
            const worksheet = createCombinedWorksheet(leagueName, leagueData);

            const sheetName = cleanSheetName(leagueName);

            try {
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
                console.log(`✅ Created combined sheet: ${sheetName}`);
            } catch (error) {
                console.error(`Error creating sheet ${sheetName}:`, error);
            }
        });

    } else {
        // Use original method (each table gets own sheet)
        allData.forEach((pageData, index) => {
            if (!pageData || pageData.error) {
                console.warn(`Skipping page ${index} due to error:`, pageData?.error);
                return;
            }

            pageData.tables.forEach((table, tableIndex) => {
                const sheetName = generateSheetName(pageData.league, pageData.pageType, table.name, tableIndex);
                const worksheet = createWorksheet(table);

                try {
                    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
                    console.log(`✅ Created sheet: ${sheetName}`);
                } catch (error) {
                    console.error(`Error creating sheet ${sheetName}:`, error);
                }
            });
        });
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
        compression: true
    });

    return new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

/**
 * Create a combined worksheet with multiple tables and titles
 */
function createCombinedWorksheet(leagueName, leagueData) {
    const allRows = [];
    let currentRow = 0;

    leagueData.forEach((pageData, pageIndex) => {
        pageData.tables.forEach((table, tableIndex) => {
            // Use actual table name from FBref instead of generic title
            // Examples: "Squad Standard Stats", "Squad Goalkeeping", etc.
            const tableName = table.name || 'Unnamed Table';
            const title = tableName.toUpperCase();

            // Add title row
            allRows.push([title]);
            currentRow++;

            // Add headers
            allRows.push(table.headers);
            currentRow++;

            // Add data rows
            table.rows.forEach(row => {
                const cleanRow = row.map(cell => {
                    if (typeof cell === 'object' && cell !== null) {
                        return cell.text || cell.link || '';
                    }
                    return cell;
                });
                allRows.push(cleanRow);
                currentRow++;
            });

            // Add blank row for spacing (unless it's the last table)
            if (!(pageIndex === leagueData.length - 1 && tableIndex === pageData.tables.length - 1)) {
                allRows.push([]);
                currentRow++;
            }
        });
    });

    // Convert to worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);

    // Auto-size columns
    const colWidths = [];
    if (allRows.length > 0) {
        const maxCols = Math.max(...allRows.map(row => row.length));

        for (let colIndex = 0; colIndex < maxCols; colIndex++) {
            let maxWidth = 10;

            allRows.forEach(row => {
                if (row[colIndex]) {
                    const cellLength = String(row[colIndex]).length;
                    maxWidth = Math.max(maxWidth, cellLength);
                }
            });

            colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
        }
    }

    worksheet['!cols'] = colWidths;

    // Make title rows bold (requires cell styling)
    // Note: Basic XLSX might not support cell formatting, but we'll try
    Object.keys(worksheet).forEach(cell => {
        if (cell[0] === '!') return; // Skip special keys

        const cellObj = worksheet[cell];
        if (cellObj && cellObj.v && typeof cellObj.v === 'string') {
            // Check if this is a title row (all caps with " - ")
            if (cellObj.v.includes(' - ') && cellObj.v === cellObj.v.toUpperCase()) {
                cellObj.s = {
                    font: { bold: true, sz: 12 },
                    fill: { fgColor: { rgb: "E0E7FF" } }
                };
            }
        }
    });

    return worksheet;
}

/**
 * Clean sheet name for Excel (31 char limit, no special chars)
 */
function cleanSheetName(name) {
    return name
        .replace(/[\\/:*?\[\]]/g, '')  // Remove invalid Excel chars
        .replace(/\s+/g, '_')          // Replace spaces with underscores
        .substring(0, 31);             // Limit to 31 chars
}

/**
 * Add data enrichment sheets to existing workbook
 * @param {Object} workbook - XLSX workbook object
 * @param {Object} enrichmentData - Data from EnrichmentProcessor
 * @returns {Object} Modified workbook
 */
function addEnrichmentSheets(workbook, enrichmentData) {
    if (!enrichmentData) return workbook;

    // Add Odds sheet
    if (enrichmentData.odds && enrichmentData.odds.data && enrichmentData.odds.data.length > 0) {
        console.log(`Adding Odds sheet with ${enrichmentData.odds.data.length} matches`);
        const oddsSheet = XLSX.utils.json_to_sheet(enrichmentData.odds.data);
        XLSX.utils.book_append_sheet(workbook, oddsSheet, 'Odds_Data');
    }

    // Add Injuries sheet
    if (enrichmentData.injuries && enrichmentData.injuries.data && enrichmentData.injuries.data.length > 0) {
        console.log(`Adding Injuries sheet with ${enrichmentData.injuries.data.length} injuries`);
        const injurySheet = XLSX.utils.json_to_sheet(enrichmentData.injuries.data);
        XLSX.utils.book_append_sheet(workbook, injurySheet, 'Injuries');
    }

    // Add Weather sheet
    if (enrichmentData.weather && enrichmentData.weather.matches && enrichmentData.weather.matches.length > 0) {
        console.log(`Adding Weather sheet with ${enrichmentData.weather.matches.length} matches`);
        const weatherSheet = XLSX.utils.json_to_sheet(enrichmentData.weather.matches);
        XLSX.utils.book_append_sheet(workbook, weatherSheet, 'Weather');
    }

    // Add ClubElo Fixtures sheet
    if (enrichmentData.clubelo && enrichmentData.clubelo.fixtures && enrichmentData.clubelo.fixtures.length > 0) {
        console.log(`Adding ClubElo Fixtures sheet with ${enrichmentData.clubelo.fixtures.length} matches`);

        // Format ClubElo data for Excel
        const clubeloData = enrichmentData.clubelo.fixtures.map(fixture => ({
            'Date': fixture.date,
            'Home Team': fixture.home,
            'Away Team': fixture.away,
            'Home Win %': fixture.odds.homePercent,
            'Draw %': fixture.odds.drawPercent,
            'Away Win %': fixture.odds.awayPercent,
            'Most Likely Score': fixture.mostLikelyScore,
            'Score Probability %': fixture.scoreProbPercent
        }));

        const clubeloSheet = XLSX.utils.json_to_sheet(clubeloData);
        XLSX.utils.book_append_sheet(workbook, clubeloSheet, 'ClubElo_Fixtures');
    }

    return workbook;
}

// Export functions for extension use
if (typeof window !== 'undefined') {
    window.ExcelGenerator = {
        generateExcel,
        generateCombinedExcel,
        downloadExcel,
        downloadExcelViaExtension,
        addEnrichmentSheets  // NEW: Export enrichment function
    };
}
