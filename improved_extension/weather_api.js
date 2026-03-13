/**
 * Weather API Collector for Chrome Extension
 * Collects weather forecasts from OpenWeatherMap API
 * 
 * Features:
 * - Fetches 5-day forecasts
 * - Maps teams to cities
 * - Finds closest forecast to match time
 * - Free tier: 1000 calls/day
 */

class WeatherCollector {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';

        // Stadium/Team city mapping
        this.teamCities = {
            // Premier League
            'Arsenal': 'London',
            'Chelsea': 'London',
            'Tottenham': 'London',
            'West Ham': 'London',
            'Crystal Palace': 'London',
            'Fulham': 'London',
            'Brentford': 'London',
            'Manchester City': 'Manchester',
            'Manchester United': 'Manchester',
            'Liverpool': 'Liverpool',
            'Everton': 'Liverpool',
            'Newcastle': 'Newcastle',
            'Aston Villa': 'Birmingham',
            'Wolves': 'Wolverhampton',
            'Leicester': 'Leicester',
            'Nottingham Forest': 'Nottingham',
            'Brighton': 'Brighton',
            'Bournemouth': 'Bournemouth',
            'Southampton': 'Southampton',

            // Bundesliga
            'Bayern Munich': 'Munich',
            'Dortmund': 'Dortmund',
            'RB Leipzig': 'Leipzig',
            'Leverkusen': 'Leverkusen',
            'Frankfurt': 'Frankfurt',
            'Wolfsburg': 'Wolfsburg',
            'Freiburg': 'Freiburg',
            'Union Berlin': 'Berlin',
            'Hertha': 'Berlin',

            // La Liga
            'Barcelona': 'Barcelona',
            'Real Madrid': 'Madrid',
            'Atletico': 'Madrid',
            'Getafe': 'Madrid',
            'Rayo Vallecano': 'Madrid',
            'Sevilla': 'Seville',
            'Valencia': 'Valencia',
            'Villarreal': 'Villarreal',
            'Athletic Club': 'Bilbao',
            'Sociedad': 'San Sebastian',

            // Serie A
            'Juventus': 'Turin',
            'Inter': 'Milan',
            'Milan': 'Milan',
            'Roma': 'Rome',
            'Lazio': 'Rome',
            'Napoli': 'Naples',
            'Atalanta': 'Bergamo',
            'Fiorentina': 'Florence',

            // Ligue 1
            'PSG': 'Paris',
            'Paris SG': 'Paris',
            'Marseille': 'Marseille',
            'Lyon': 'Lyon',
            'Monaco': 'Monaco',
            'Nice': 'Nice',
            'Lille': 'Lille',
            'Rennes': 'Rennes',

            // Add more as needed
        };
    }

    /**
     * Get weather forecast for a city
     */
    async getCityForecast(cityName) {
        const url = `${this.baseUrl}/forecast`;
        const params = new URLSearchParams({
            q: cityName,
            appid: this.apiKey,
            units: 'metric', // Celsius
            cnt: 40 // 5 days * 8 forecasts per day
        });

        try {
            const response = await fetch(`${url}?${params}`);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Invalid API key');
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.list || [];

        } catch (error) {
            console.error(`Weather API error for ${cityName}:`, error);
            throw error;
        }
    }

    /**
     * Get weather for a specific match
     */
    async getMatchWeather(homeTeam, matchDateTime) {
        // Get city from team name
        const city = this.getTeamCity(homeTeam);

        try {
            // Get forecast for city
            const forecasts = await this.getCityForecast(city);

            // Find closest forecast to match time
            const matchTime = new Date(matchDateTime).getTime();
            let closestForecast = null;
            let minDiff = Infinity;

            forecasts.forEach(forecast => {
                const forecastTime = forecast.dt * 1000;
                const diff = Math.abs(forecastTime - matchTime);

                if (diff < minDiff) {
                    minDiff = diff;
                    closestForecast = forecast;
                }
            });

            if (!closestForecast) {
                throw new Error('No forecast available for match time');
            }

            return {
                city: city,
                datetime: new Date(closestForecast.dt * 1000).toISOString(),
                temp: Math.round(closestForecast.main.temp),
                feels_like: Math.round(closestForecast.main.feels_like),
                temp_min: Math.round(closestForecast.main.temp_min),
                temp_max: Math.round(closestForecast.main.temp_max),
                humidity: closestForecast.main.humidity,
                weather: closestForecast.weather[0].main,
                description: closestForecast.weather[0].description,
                clouds: closestForecast.clouds.all,
                wind_speed: Math.round(closestForecast.wind.speed * 10) / 10,
                wind_deg: closestForecast.wind.deg,
                rain_3h: closestForecast.rain?.['3h'] || 0,
                snow_3h: closestForecast.snow?.['3h'] || 0,
                pop: Math.round((closestForecast.pop || 0) * 100) // Probability of precipitation
            };

        } catch (error) {
            console.error(`Failed to get weather for ${homeTeam}:`, error);
            return {
                city: city,
                error: error.message
            };
        }
    }

    /**
     * Get team's city
     */
    getTeamCity(teamName) {
        // Direct lookup
        if (this.teamCities[teamName]) {
            return this.teamCities[teamName];
        }

        // Try partial match
        for (const [team, city] of Object.entries(this.teamCities)) {
            if (teamName.includes(team) || team.includes(teamName)) {
                return city;
            }
        }

        // Fallback: use first word of team name
        const firstWord = teamName.split(' ')[0];
        return firstWord;
    }

    /**
     * Collect weather for multiple fixtures
     */
    async collectFixturesWeather(fixtures, onProgress = null) {
        const weatherData = [];
        let completed = 0;

        // Only process matches within next 5 days (API limit)
        const now = new Date();
        const fiveDaysFromNow = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000));

        for (const fixture of fixtures) {
            try {
                const matchDate = new Date(fixture.date + ' ' + (fixture.time || '15:00'));

                // Skip if too far in future or in past
                if (matchDate < now || matchDate > fiveDaysFromNow) {
                    continue;
                }

                const weather = await this.getMatchWeather(fixture.home, matchDate);

                weatherData.push({
                    Home: fixture.home,
                    Away: fixture.away,
                    Match_Date: fixture.date,
                    Match_Time: fixture.time || '15:00',
                    City: weather.city,
                    Temp_C: weather.temp,
                    Feels_Like_C: weather.feels_like,
                    Weather: weather.weather,
                    Description: weather.description,
                    Wind_Speed_ms: weather.wind_speed,
                    Rain_mm: weather.rain_3h,
                    Humidity: weather.humidity,
                    Clouds: weather.clouds,
                    Precipitation_Prob: weather.pop,
                    Error: weather.error || null
                });

                completed++;
                if (onProgress) {
                    onProgress({
                        current: completed,
                        total: fixtures.length,
                        match: `${fixture.home} vs ${fixture.away}`
                    });
                }

                // Small delay to respect API limits
                await this.delay(100);

            } catch (error) {
                console.error(`Error getting weather for fixture:`, error);
            }
        }

        return {
            matches: weatherData,
            count: weatherData.length
        };
    }

    /**
     * Validate API key
     */
    async validateApiKey() {
        try {
            await this.getCityForecast('London');
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
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
    window.WeatherCollector = WeatherCollector;
}
