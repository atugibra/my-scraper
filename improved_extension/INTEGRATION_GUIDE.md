# Extension Integration Guide

## Backend API v2.0 - Chrome Extension Integration

### Overview
The backend has been updated to use a fully normalized database schema (3NF) with 15 tables. All API endpoints have been updated to work with the new schema.

### API Endpoint Changes

#### ✅ NEW ENDPOINTS:

**Data Sync:**
- `POST /api/sync/fixtures` - Sync fixture data
- `POST /api/sync/stats` - Sync squad stats (13 tables per league)
- `POST /api/sync/player-stats` - Sync player stats (30 tables per league)
- `POST /api/sync/all` - Batch sync all data types

**Team Metrics:**
- `GET /api/metrics/team/<name>?league=...&season=...&location=...` - Get team strength metrics
- `GET /api/metrics/league/<name>?season=...` - Get all team metrics for a league

**Head-to-Head:**
- `GET /api/h2h/<team_a>/<team_b>?league=...&limit=6` - Get H2H analysis

**Predictions:**
- `POST /api/predictions/match` - Generate prediction for specific match
- `GET /api/predictions/league/<name>` - Get all predictions for a league

**Data Queries:**
- `GET /api/teams?league=...` - Get all teams (optionally filter by league)
- `GET /api/leagues` - Get all leagues

**Export:**
- `GET /api/export/json?league=...&type=...` - Export data as JSON

**Info:**
- `GET /api/health` - Health check
- `GET /api/version` - Get API version and features

### Usage Examples

#### 1. Sync Fixtures from Extension

```javascript
// After scraping FBRef fixtures page
const fixturesData = {
    type: 'fixtures',
    league: 'Premier League',
    season: '2025-2026',
    tables: [
        {
            id: 'sched_2025-2026_9_1',
            columns: ['gameweek', 'date', 'time', 'home_team', 'score', 'away_team', 'venue'],
            rows: [
                [1, '2025-08-15', '15:00', 'Arsenal', '2–1', 'Liverpool', 'Emirates Stadium'],
                // ... more matches
            ]
        }
    ]
};

const result = await window.backendSync.syncFixtures(fixturesData);
console.log(result);
// {
//   success: true,
//   matches_inserted: 38,
//   matches_updated: 0,
//   auto_calculations_triggered: true
// }
```

#### 2. Get Team Metrics

```javascript
const metrics = await window.backendSync.getTeamMetrics('Arsenal', 'Premier League');
console.log(metrics);
// {
//   success: true,
//   metrics: {
//     offensive_strength: 78.5,
//     defensive_strength: 72.3,
//     form_score: 80.0,
//     overall_strength: 75.2,
//     // ... more metrics
//   }
// }
```

#### 3. Get H2H Analysis

```javascript
const h2h = await window.backendSync.getH2H('Arsenal', 'Liverpool', 'Premier League');
console.log(h2h);
// {
//   success: true,
//   h2h_stats: {
//     matches_analyzed: 6,
//     team_a_wins: 2,
//     team_b_wins: 3,
//     draws: 1,
//     avg_total_goals: 2.8,
//     btts_frequency: 0.83,
//     // ... more stats
//   },
//   h2h_factor: 1.05
// }
```

#### 4. Generate Match Prediction

```javascript
const prediction = await window.backendSync.generateMatchPrediction(
    'Arsenal',
    'Liverpool', 
    'Premier League'
);
console.log(prediction);
// {
//   prediction: {
//     home_win: 0.45,
//     draw: 0.28,
//     away_win: 0.27,
//     btts: 0.72,
//     over_2_5: 0.68
//   },
//   home_metrics: { ... },
//   away_metrics: { ... },
//   h2h_analysis: { ... }
// }
```

#### 5. Sync All Data at Once

```javascript
const allData = {
    league: 'Premier League',
    season: '2025-2026',
    fixtures: { /* fixtures data */ },
    stats: { /* stats data */ },
    player_stats: { /* player data */ }
};

const result = await window.backendSync.syncAll(allData);
// Syncs everything and triggers all calculations automatically
```

### Integration Steps

1. **Update backend_sync.js** ✅ DONE
   - File has been updated with all new endpoints
   - Located at: `improved_extension/backend_sync.js`

2. **Test Connection**
   - Make sure backend is running: `python app.py`
   - Extension will automatically check connection
   - Look for "🟢 Backend Online" indicator

3. **Update Scraping Logic**
   - Modify scraper to use new sync endpoints
   - Instead of old `/api/data/sync`, use:
     - `/api/sync/fixtures` for fixtures
     - `/api/sync/stats` for squad stats
     - `/api/sync/player-stats` for player data

4. **Update UI**
   - Use new endpoints to get predictions
   - Display team metrics and H2H analysis
   - Show real-time calculation results

### Data Format Requirements

#### Fixtures Sync Format:
```javascript
{
    type: 'fixtures',
    league: 'Premier League',
    season: '2025-2026',
    tables: [
        {
            id: 'sched_YYYY-YYYY_X_Y',
            columns: ['gameweek', 'date', 'time', 'home_team', 'score', 'away_team', 'venue'],
            rows: [
                [gameweek, 'YYYY-MM-DD', 'HH:MM', 'Team A', 'X–Y', 'Team B', 'Stadium']
            ]
        }
    ]
}
```

#### Stats Sync Format:
```javascript
{
    type: 'stats',
    league: 'Premier League',
    season: '2025-2026',
    tables: [
        {
            id: 'stats_CATEGORY_for/against',
            category: 'standard|goalkeeping|shooting|playing_time|misc',
            stat_type: 'for|against',
            columns: ['team', 'games', 'goals', 'xg', ...],
            rows: [
                ['Team Name', 38, 75, 72.5, ...]
            ]
        }
    ]
}
```

### Auto-Calculations

The backend automatically triggers calculations after data sync:
- **After fixtures sync**: H2H stats are recalculated
- **After stats sync**: Team metrics are recalculated
- **After player stats sync**: Player aggregations are updated

No manual trigger needed!

### Error Handling

All endpoints return consistent format:
```javascript
{
    success: true/false,
    error: "Error message" (if success=false),
    // ... other data
}
```

Always check `result.success` before using data.

### Testing

Backend includes comprehensive test suite:
- Run: `python test_api.py`
- All 12 tests passing ✅
- Tests cover all endpoints with sample data

---

**Status:** ✅ Extension integration ready!  
**Backend Version:** 2.0.0 (Normalized Schema)  
**Last Updated:** February 10, 2026
