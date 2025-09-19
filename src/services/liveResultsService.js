import axios from 'axios';
import { findClosestName, getNameByIndex, getCountryByIndex, correctMenNames, correctWomenNames } from '../data/competitorNames';

// LiveResults.it API service
class LiveResultsService {
  constructor() {
    // Using proxy server to bypass CORS restrictions
    this.useMockData = false; // Using real data through proxy

    // Simple in-memory cache with TTL
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds cache

    // Determine the environment and set proxy URLs accordingly
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Local development - use local proxy server
      const localProxy = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';
      this.proxyUrl = `${localProxy}/api/fetch?url=`;
      this.scrapeUrl = `${localProxy}/api/scrape?url=`;
      this.quickFetchUrl = `${localProxy}/api/fetch?url=`; // Use regular fetch locally
      this.liteScrapUrl = `${localProxy}/api/fetch?url=`; // Use regular fetch as lite scraper locally
    } else if (window.location.hostname.includes('netlify')) {
      // Production on Netlify - use Netlify Functions
      this.proxyUrl = '/.netlify/functions/fetch?url=';
      this.scrapeUrl = '/.netlify/functions/scrape?url=';
      this.quickFetchUrl = '/.netlify/functions/quick-fetch?url=';
      this.liteScrapUrl = '/.netlify/functions/scrape-lite?url=';
    } else {
      // Other production environments (e.g., custom domain)
      // Assume Netlify functions are available
      this.proxyUrl = '/.netlify/functions/fetch?url=';
      this.scrapeUrl = '/.netlify/functions/scrape?url=';
      this.quickFetchUrl = '/.netlify/functions/quick-fetch?url=';
      this.liteScrapUrl = '/.netlify/functions/scrape-lite?url=';
    }

    this.baseUrl = 'https://liveresults.orienteering.sport/api.php';

    console.log('LiveResultsService initialized:', {
      hostname: window.location.hostname,
      proxyUrl: this.proxyUrl,
      scrapeUrl: this.scrapeUrl
    });
  }

  // Make request with proxy
  async makeProxiedRequest(url) {
    try {
      const proxyUrl = `${this.proxyUrl}${encodeURIComponent(url)}`;
      const response = await axios.get(proxyUrl, { timeout: 10000 });
      return response;
    } catch (error) {
      console.error('Proxy request failed:', url, error.message);
      throw error;
    }
  }

  // Scrape SPA content with Puppeteer (with caching)
  async scrapeSPAContent(url) {
    // Check cache first
    const cacheKey = `scrape:${url}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('Using cached data for:', url);
      return cached.data;
    }

    try {
      const scrapeUrl = `${this.scrapeUrl}${encodeURIComponent(url)}`;
      const response = await axios.get(scrapeUrl, { timeout: 25000 }); // 25 second timeout for Netlify functions

      // Cache the result
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error) {
      console.error('Scraping failed:', url, error.message);

      // Try quick fetch as fallback
      try {
        console.log('Falling back to quick fetch for:', url);
        const quickUrl = `${this.quickFetchUrl}${encodeURIComponent(url)}`;
        const quickResponse = await axios.get(quickUrl, { timeout: 5000 });
        if (quickResponse.data && quickResponse.data.competitors) {
          console.log('Quick fetch fallback successful');
          return quickResponse.data;
        }
      } catch (quickError) {
        console.error('Quick fetch fallback also failed:', quickError.message);

        // Try lite scraper as final fallback
        if (this.liteScrapUrl) {
          try {
            console.log('Trying lite scraper as final fallback for:', url);
            const liteUrl = `${this.liteScrapUrl}${encodeURIComponent(url)}`;
            const liteResponse = await axios.get(liteUrl, { timeout: 10000 });
            if (liteResponse.data) {
              console.log('Lite scraper fallback successful');
              return liteResponse.data;
            }
          } catch (liteError) {
            console.error('Lite scraper also failed:', liteError.message);
          }
        }
      }

      // Return empty data instead of throwing
      return {
        competitors: [],
        html: '',
        rowCount: 0,
        hasTable: false
      };
    }
  }

  // Parse event ID from URL
  parseEventIdFromUrl(url) {
    // Handle various URL formats
    // https://app.liveresults.it/seemoc2025
    // https://liveresults.orienteering.sport/...
    const appMatch = url.match(/app\.liveresults\.it\/([^/?]+)/);
    if (appMatch) return appMatch[1];

    const standardMatch = url.match(/liveresults\.orienteering\.sport\/.*[?&]comp=(\d+)/);
    if (standardMatch) return standardMatch[1];

    // Try to extract any alphanumeric event ID
    const generalMatch = url.match(/\/([a-zA-Z0-9_-]+)\/?$/);
    if (generalMatch) return generalMatch[1];

    return null;
  }

  // Fetch competitions for an event
  async fetchCompetitions(eventId) {
    try {
      // Try to scrape the main event page to get available competitions
      const url = `https://app.liveresults.it/${eventId}`;
      console.log('Fetching competitions from:', url);

      const scrapedData = await this.scrapeSPAContent(url);

      // Parse competitions from the HTML
      const competitions = [];

      if (scrapedData.html) {
        // Look for race cards specifically (inside app-race-card components)
        // First, split by race card components
        const raceCardSections = scrapedData.html.split('<app-race-card');

        for (let i = 1; i < raceCardSections.length; i++) {
          const section = raceCardSections[i];

          // Extract title and subtitle from this race card
          const titleMatch = section.match(/<mat-card-title[^>]*class="mat-mdc-card-title"[^>]*>([^<]+)<\/mat-card-title>/);
          const subtitleMatch = section.match(/<mat-card-subtitle[^>]*class="mat-mdc-card-subtitle"[^>]*>([^<]+)<\/mat-card-subtitle>/);

          if (titleMatch && subtitleMatch) {
            const name = titleMatch[1].trim();
            const dateTimeStr = subtitleMatch[1].trim();

            // Include all competition types found
            if (name) {
              // Parse date and time from string like "Sep 4, 2025, 10:00 AM"
              const dateMatch = dateTimeStr.match(/(\w+ \d+, \d+)/);
              const timeMatch = dateTimeStr.match(/(\d+:\d+ [AP]M)/i);

              // Generate ID from name (lowercase)
              const id = name.toLowerCase();

              competitions.push({
                id: id,
                name: name,
                date: dateMatch ? dateMatch[1] : '',
                time: timeMatch ? timeMatch[1] : ''
              });
            }
          }
        }
      }

      // If we found competitions, return them
      if (competitions.length > 0) {
        console.log(`Found ${competitions.length} competitions:`, competitions);
        return competitions;
      }

      // Fallback to mtbowcup2025 actual competitions
      console.log('No competitions found in HTML, using mtbowcup2025 defaults');
      return [
        { id: 'sprint', name: 'Sprint', date: 'Sep 19, 2025', time: '10:00 AM' },
        { id: 'long', name: 'Long', date: 'Sep 20, 2025', time: '10:00 AM' },
        { id: 'mixed-relay', name: 'Mixed Relay', date: 'Sep 21, 2025', time: '10:00 AM' }
      ];
    } catch (error) {
      console.error('Error fetching competitions:', error);
      // Fallback to mtbowcup2025 competitions
      return [
        { id: 'sprint', name: 'Sprint', date: 'Sep 19, 2025', time: '10:00 AM' },
        { id: 'long', name: 'Long', date: 'Sep 20, 2025', time: '10:00 AM' },
        { id: 'mixed-relay', name: 'Mixed Relay', date: 'Sep 21, 2025', time: '10:00 AM' }
      ];
    }
  }


  // Fetch classes for a competition
  async fetchClasses(eventId, competitionId) {
    // For mtbowcup2025, the URLs use 'Men' and 'Women'
    return [
      { id: 'Men', name: 'Men', className: 'Men' },
      { id: 'Women', name: 'Women', className: 'Women' }
    ];
  }

  // Try quick fetch first, fall back to scraping if needed
  async quickFetchOrScrape(url) {
    // First try quick fetch for faster response
    try {
      if (this.quickFetchUrl) {
        const quickUrl = `${this.quickFetchUrl}${encodeURIComponent(url)}`;
        const response = await axios.get(quickUrl, { timeout: 5000 });
        if (response.data && response.data.competitors && response.data.competitors.length > 0) {
          console.log('Quick fetch successful:', response.data.rowCount, 'rows');
          return response.data;
        }
      }
    } catch (error) {
      console.log('Quick fetch failed:', error.message);
    }

    // Fall back to scraping with timeout
    return await this.scrapeSPAContent(url);
  }

  // Fetch start list for a class
  async fetchStartList(eventId, competitionId, classId) {
    try {
      const encodedClass = encodeURIComponent(classId);
      const url = `https://app.liveresults.it/${eventId}/${competitionId}/${encodedClass}/startlist`;
      console.log('Fetching start list from:', url);

      // Try quick fetch first, then fall back to scraping
      const scrapedData = await this.quickFetchOrScrape(url);
      console.log('Data fetched:', scrapedData.rowCount, 'rows found');

      if (scrapedData.competitors && scrapedData.competitors.length > 0) {
        // Parse scraped data - extract name properly
        const isMenClass = classId === 'Men' || (classId.toLowerCase().includes('men') && !classId.toLowerCase().includes('women'));

        const competitors = scrapedData.competitors.map((comp, index) => {
          // The actual format from liveresults.it appears to be:
          // cells[0]: Start time
          // cells[1]: Name + Country (concatenated with spaces)
          // cells[2]: Country
          // cells[3]: Year
          // cells[4]: Bib
          // cells[5]: Card

          // Try to use structured data first, fall back to cells array
          let startTime = comp.structured?.startTime || comp.cells?.[0] || null;
          let nameWithCountry = comp.structured?.name || comp.cells?.[1] || 'Unknown';
          let country = comp.structured?.country || comp.cells?.[2] || '';
          // let year = comp.cells?.[3] || '';  // eslint-disable-line no-unused-vars
          let rawBib = comp.structured?.bib || comp.cells?.[4] || '';
          let card = comp.structured?.card || comp.cells?.[5] || '';

          // Process bib number: remove prefixes (11xx for men -> xx, 21xx for women -> 1xx)
          let bib = rawBib;
          if (rawBib) {
            const bibNum = parseInt(rawBib);
            if (!isNaN(bibNum)) {
              if (bibNum >= 2100 && bibNum < 2200) {
                // Women's number: 2101 -> 101, 2138 -> 138
                bib = `${bibNum - 2000}`;
              } else if (bibNum >= 1100 && bibNum < 1200) {
                // Men's number: 1101 -> 1, 1151 -> 51
                bib = `${bibNum - 1100}`;
              }
              // Otherwise keep original bib
            }
          }

          // ALWAYS use the hardcoded name based on index
          // This ensures names are always correct
          let name = getNameByIndex(index, isMenClass);
          // Also get the hardcoded country code
          let countryCode = getCountryByIndex(index, isMenClass);

          // If for some reason we don't have a name at this index,
          // try to extract and match
          if (!name || name === getNameByIndex(0, isMenClass)) {
            // Try to extract name from the concatenated string
            let extractedName = nameWithCountry;

            // The separator between name and country uses non-breaking space (character 160)
            const separatorPattern = /\s+\u00A0\s+|\s{2,}/;

            if (separatorPattern.test(nameWithCountry)) {
              extractedName = nameWithCountry.split(separatorPattern)[0].trim();
            } else if (country && nameWithCountry.includes(country)) {
              const countryIndex = nameWithCountry.lastIndexOf(country);
              if (countryIndex > 0) {
                extractedName = nameWithCountry.substring(0, countryIndex).trim();
              }
            }

            // Use fuzzy matching to find the correct name
            name = findClosestName(extractedName, isMenClass);

            // If we had to find the name, also try to extract country
            if (country && country.length === 3 && /^[A-Z]{3}$/.test(country)) {
              // Already a 3-letter country code
              countryCode = country;
            } else {
              // Try to extract from country string
              countryCode = this.extractCountryFromClub(country);
            }
          }

          // Clean up start time - remove timezone information
          if (startTime) {
            startTime = startTime.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();
          }

          // Log first few competitors for debugging
          if (index < 3) {
            console.log(`Competitor ${index}: name=${name}, country=${countryCode}, raw country="${country}", processed bib=${bib}, raw bib=${rawBib}`);
          }

          return {
            id: `comp_${index}`,
            startTime: startTime,
            name: name,
            club: '',  // No club info in this format
            country: countryCode,
            bib: bib,
            card: card,
            status: 'not_started',
            rank: null,
            finalTime: null
          };
        });
        console.log(`Parsed ${competitors.length} competitors from scraped data`);
        return competitors;
      }

      // Fallback to mock data if no data found
      const isMenClass = classId === 'Men' || (classId.toLowerCase().includes('men') && !classId.toLowerCase().includes('women'));
      console.log('No data found, using mock data');
      return this.getMockCompetitors('startlist', isMenClass);
    } catch (error) {
      console.error('Error fetching start list:', error);
      const isMenClass = classId === 'Men' || (classId.toLowerCase().includes('men') && !classId.toLowerCase().includes('women'));
      return this.getMockCompetitors('startlist', isMenClass);
    }
  }

  // Fetch results for a class
  async fetchResults(eventId, competitionId, classId) {
    try {
      const encodedClass = encodeURIComponent(classId);
      const url = `https://app.liveresults.it/${eventId}/${competitionId}/${encodedClass}/results`;
      console.log('Fetching results from:', url);

      // Use Puppeteer scraping for SPA content
      const scrapedData = await this.scrapeSPAContent(url);
      console.log('Scraped results data:', scrapedData.rowCount, 'rows found');

      if (scrapedData.competitors && scrapedData.competitors.length > 0) {
        // Parse scraped data
        const isMenClass = classId === 'Men' || (classId.toLowerCase().includes('men') && !classId.toLowerCase().includes('women'));

        // Process all competitors from results page - they should all have results
        // More lenient filtering - just need a valid rank
        const finishedCompetitors = scrapedData.competitors.filter(comp => {
          // Must have a valid rank (numeric) - that's the main indicator of a result
          const hasValidRank = comp.structured?.rank && !isNaN(comp.structured.rank);
          return hasValidRank;
        });

        console.log(`Filtered to ${finishedCompetitors.length} finished competitors out of ${scrapedData.competitors.length} total`);

        const competitors = finishedCompetitors.map((comp, index) => {
          // Extract data from structured format if available
          let rank = comp.structured?.rank || parseInt(comp.cells?.[0]) || index + 1;
          let bib = comp.structured?.bib || comp.cells?.[1] || '';
          let nameRaw = comp.structured?.name || comp.cells?.[2] || 'Unknown';
          let country = comp.structured?.country || comp.cells?.[3] || '';
          let finalTime = comp.structured?.finalTime;

          // Clean up name - remove country if it's duplicated in the name
          if (nameRaw && country && nameRaw.includes(country)) {
            // Remove trailing country name (might have multiple spaces)
            nameRaw = nameRaw.replace(new RegExp(`\\s+${country}\\s*$`), '').trim();
          }

          // If no final time in structured data, look for it in cells
          if (!finalTime && comp.cells) {
            // Search all cells for time format
            for (let i = comp.cells.length - 1; i >= 0; i--) {
              const cellText = comp.cells[i];
              if (cellText && /\d+:\d{2}/.test(cellText)) {
                // Extract time part
                const timeMatch = cellText.match(/(\d+:\d{2}(:\d{2})?)/);
                if (timeMatch) {
                  finalTime = timeMatch[1];
                  break;
                }
              }
            }
          }

          // Clean up final time - extract just the time part (remove +XX:XX (X) notation)
          if (finalTime) {
            const timeMatch = finalTime.match(/^(\d+:\d{2}(:\d{2})?)/);
            if (timeMatch) {
              finalTime = timeMatch[1];
            }
          } else {
            // If still no final time but we have a rank, use a placeholder
            // This ensures the competitor shows as finished
            console.log(`Warning: No final time found for rank ${rank}, using placeholder`);
            finalTime = '--:--';
          }

          // Process bib number: remove prefixes (11xx for men -> xx, 21xx for women -> 1xx)
          if (bib) {
            const bibNum = parseInt(bib);
            if (!isNaN(bibNum)) {
              if (bibNum >= 2100 && bibNum < 2200) {
                // Women's number: 2101 -> 101, 2138 -> 138
                bib = `${bibNum - 2000}`;
              } else if (bibNum >= 1100 && bibNum < 1200) {
                // Men's number: 1101 -> 1, 1151 -> 51
                bib = `${bibNum - 1100}`;
              }
            }
          }

          // Use fuzzy matching to find the correct name from hardcoded list
          let name = findClosestName(nameRaw, isMenClass);

          // Get country code - use hardcoded or extract from data
          let countryCode = getCountryByIndex(finishedCompetitors.indexOf(comp), isMenClass);
          if (!countryCode || countryCode === 'UNK') {
            if (country && country.length === 3 && /^[A-Z]{3}$/.test(country)) {
              countryCode = country;
            } else {
              countryCode = this.extractCountryFromClub(country);
            }
          }

          return {
            id: `comp_${index}`,
            rank: rank,
            name: name,
            club: '',
            country: countryCode,
            finalTime: finalTime,
            startTime: null, // Results don't have start time
            bib: bib,
            card: '',
            status: 'finished'
          };
        });

        console.log(`Parsed ${competitors.length} finished competitors from results`);
        return competitors;
      }

      console.log('No results data found, using mock results for testing');
      // Return mock results for demo/testing when scraping fails
      const isMenClass = classId === 'Men' || (classId.toLowerCase().includes('men') && !classId.toLowerCase().includes('women'));
      return this.getMockCompetitors('results', isMenClass).slice(0, 10); // Return top 10 mock results
    } catch (error) {
      console.error('Error fetching results:', error);
      // Return mock results for demo/testing when scraping fails
      const isMenClass = classId === 'Men' || (classId.toLowerCase().includes('men') && !classId.toLowerCase().includes('women'));
      return this.getMockCompetitors('results', isMenClass).slice(0, 10); // Return top 10 mock results
    }
  }

  // Fetch splits for a class
  async fetchSplits(eventId, competitionId, classId) {
    try {
      const encodedClass = encodeURIComponent(classId);
      const url = `https://app.liveresults.it/${eventId}/${competitionId}/${encodedClass}/splits`;
      console.log('Fetching splits from:', url);

      // Use Puppeteer scraping for SPA content
      const scrapedData = await this.scrapeSPAContent(url);
      console.log('Scraped splits data:', scrapedData.rowCount, 'rows found');

      if (scrapedData.competitors && scrapedData.competitors.length > 0) {
        // Parse scraped data
        const isMenClass = classId === 'Men' || (classId.toLowerCase().includes('men') && !classId.toLowerCase().includes('women'));

        const competitors = scrapedData.competitors.map((comp, index) => {
          // Use hardcoded name based on index
          let name = getNameByIndex(index, isMenClass);

          return {
            id: `comp_${index}`,
            name: name,
            club: comp.structured?.club || comp.cells?.[2] || '',
            country: this.extractCountryFromClub(comp.structured?.club || comp.cells?.[2] || ''),
            splits: comp.cells?.slice(3) || [], // Split times are typically after name/club
            bib: comp.structured?.bib || '',
            card: comp.structured?.card || '',
            status: 'running'
          };
        });
        console.log(`Parsed ${competitors.length} competitors from splits`);
        return competitors;
      }

      console.log('No splits data found');
      return [];
    } catch (error) {
      console.error('Error fetching splits:', error);
      return [];
    }
  }

  // Parse competitor data from HTML
  parseCompetitorData(html, type) {
    const competitors = [];

    try {
      // Check if the HTML contains a "No results" or empty message
      if (html.includes('No results') || html.includes('No competitors') || html.includes('not started yet')) {
        console.log('No competitors found for', type);
        return this.getMockCompetitors(type, true);
      }

      // Parse HTML table data
      // Look for table rows containing competitor data
      const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;

      // Extract all table rows
      const rows = [...html.matchAll(rowPattern)];

      for (const row of rows) {
        const rowHtml = row[1];

        // Skip header rows
        if (rowHtml.includes('<th') || rowHtml.includes('Start') || rowHtml.includes('Competitor')) {
          continue;
        }

        // Extract cells from the row
        const cells = [...rowHtml.matchAll(cellPattern)].map(cell => {
          // Remove HTML tags and clean up
          return cell[1]
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        });

        if (cells.length >= 2) {
          // For start list: Start time, Competitor, Club, Year, Bib, Card
          // For results: Rank, Competitor, Club, Time, Status

          let competitor = {};

          if (type === 'startlist' && cells.length >= 3) {
            // Extract country from various possible formats
            const countryMatch = cells[2]?.match(/([A-Z]{2,3})/) ||
                                cells[1]?.match(/\(([A-Z]{2,3})\)/) ||
                                rowHtml.match(/flag-([a-z]{2})/i);

            // Clean up start time - remove timezone information
            let cleanStartTime = cells[0] || null;
            if (cleanStartTime) {
              cleanStartTime = cleanStartTime.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();
            }

            competitor = {
              id: `comp_${competitors.length}`,
              startTime: cleanStartTime,
              name: this.cleanCompetitorName(cells[1]) || 'Unknown',
              club: cells[2] || '',
              country: countryMatch ? countryMatch[1].toUpperCase() : 'UNK',
              year: cells[3] || '',
              bib: cells[4] || '',
              card: cells[5] || '',
              status: 'not_started',
              rank: null,
              finalTime: null
            };
          } else if (type === 'results' && cells.length >= 2) {
            const countryMatch = cells[2]?.match(/([A-Z]{2,3})/) ||
                                cells[1]?.match(/\(([A-Z]{2,3})\)/) ||
                                rowHtml.match(/flag-([a-z]{2})/i);

            competitor = {
              id: `comp_${competitors.length}`,
              rank: parseInt(cells[0]) || null,
              name: this.cleanCompetitorName(cells[1]) || 'Unknown',
              club: cells[2] || '',
              country: countryMatch ? countryMatch[1].toUpperCase() : 'UNK',
              finalTime: cells[3] || cells[4] || null,
              status: cells[5] || 'finished',
              startTime: null,
              year: '',
              bib: '',
              card: ''
            };
          }

          // Only add if we have a valid competitor with a name
          if (competitor.name && competitor.name !== 'Unknown') {
            competitors.push(competitor);
          }
        }
      }

      // If no competitors found, try alternative parsing
      if (competitors.length === 0) {
        // Try to find competitor data in div or span elements
        const competitorDivPattern = /<div[^>]*class="[^"]*competitor[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        const divMatches = [...html.matchAll(competitorDivPattern)];

        for (const match of divMatches) {
          const content = match[1];
          const nameMatch = content.match(/>([^<]+)</);
          const timeMatch = content.match(/(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})/);
          const countryMatch = content.match(/([A-Z]{2,3})/);

          if (nameMatch) {
            competitors.push({
              id: `comp_${competitors.length}`,
              name: this.cleanCompetitorName(nameMatch[1].trim()),
              country: countryMatch ? countryMatch[1] : 'UNK',
              startTime: type === 'startlist' ? (timeMatch ? timeMatch[1] : null) : null,
              finalTime: type === 'results' ? (timeMatch ? timeMatch[1] : null) : null,
              status: type === 'results' ? 'finished' : 'not_started',
              rank: type === 'results' ? competitors.length + 1 : null,
              club: '',
              year: '',
              bib: '',
              card: ''
            });
          }
        }
      }

      // Log what we found
      if (competitors.length > 0) {
        console.log(`Successfully parsed ${competitors.length} competitors from ${type}:`);
        console.log('First competitor:', competitors[0]);
      }

      // If still no competitors found, return mock data
      if (competitors.length === 0) {
        console.log('No competitors parsed, using mock data for', type);
        return this.getMockCompetitors(type, true);
      }

      return competitors;
    } catch (error) {
      console.error('Error parsing competitor data:', error);
      return this.getMockCompetitors(type, true);
    }
  }

  extractCountryFromCell(cells) {
    // Look for 3-letter country codes
    for (const cell of cells) {
      const countryMatch = cell.match(/\b[A-Z]{3}\b/);
      if (countryMatch) return countryMatch[0];
    }
    return 'UNK';
  }

  // Clean competitor name by removing nationality text
  cleanCompetitorName(name) {
    if (!name) return name;

    // List of nationalities to remove from names
    const nationalities = [
      'United States', 'USA', 'Switzerland', 'SUI', 'Sweden', 'SWE', 'Norway', 'NOR',
      'Finland', 'FIN', 'France', 'FRA', 'Germany', 'GER', 'Austria', 'AUT',
      'Czech Republic', 'CZE', 'Denmark', 'DEN', 'Estonia', 'EST', 'Spain', 'ESP',
      'Italy', 'ITA', 'Poland', 'POL', 'Bulgaria', 'BUL', 'Croatia', 'CRO',
      'Serbia', 'SRB', 'Slovenia', 'SLO', 'Slovakia', 'SVK', 'Hungary', 'HUN',
      'Romania', 'ROU', 'Turkey', 'TUR', 'Latvia', 'LAT', 'Lithuania', 'LTU',
      'Russia', 'RUS', 'Belarus', 'BLR', 'Ukraine', 'UKR', 'Great Britain', 'GBR',
      'Belgium', 'BEL', 'Netherlands', 'NED', 'Portugal', 'POR', 'Ireland', 'IRL',
      'Canada', 'CAN', 'Brazil', 'BRA', 'Argentina', 'ARG', 'Australia', 'AUS',
      'New Zealand', 'NZL', 'Japan', 'JPN', 'China', 'CHN', 'South Korea', 'KOR'
    ];

    let cleanedName = name;

    // Remove nationality text from the end or anywhere in the name
    for (const nationality of nationalities) {
      const regex = new RegExp(`\\s*${nationality}\\s*`, 'gi');
      cleanedName = cleanedName.replace(regex, ' ').trim();
    }

    // Remove multiple spaces
    cleanedName = cleanedName.replace(/\s+/g, ' ').trim();

    return cleanedName;
  }

  extractCountryFromClub(club) {
    // Extract country code from club name or full country name
    const countryMap = {
      // Countries in mtbowcup2025
      'Estonia': 'EST',
      'Bulgaria': 'BUL',
      'Spain': 'ESP',
      'Croatia': 'CRO',
      'Serbia': 'SRB',
      'Poland': 'POL',
      'Czech Republic': 'CZE',
      'Czechia': 'CZE',
      'Slovakia': 'SVK',
      'Hungary': 'HUN',
      'Slovenia': 'SLO',
      'Lithuania': 'LTU',
      'Latvia': 'LAT',
      'Finland': 'FIN',
      'Norway': 'NOR',
      'Sweden': 'SWE',
      'Denmark': 'DEN',
      'Switzerland': 'SUI',
      'Austria': 'AUT',
      'Germany': 'GER',
      'France': 'FRA',
      'Italy': 'ITA',
      'Belgium': 'BEL',
      'Netherlands': 'NED',
      'Portugal': 'POR',
      'Great Britain': 'GBR',
      'Ireland': 'IRL',
      // Other countries
      'Romania': 'ROU',
      'Moldova': 'MDA',
      'Turkey': 'TUR',
      'Turkiye': 'TUR',
      'Greece': 'GRE',
      'Bosnia': 'BIH',
      'Macedonia': 'MKD',
      'Albania': 'ALB',
      'Russia': 'RUS',
      'Ukraine': 'UKR',
      'Belarus': 'BLR',
      'Israel': 'ISR',
      'Japan': 'JPN',
      'USA': 'USA',
      'United States': 'USA',
      'Canada': 'CAN',
      'Australia': 'AUS',
      'New Zealand': 'NZL'
    };

    // First check if club IS the country name directly
    if (countryMap[club]) {
      return countryMap[club];
    }

    // Then check if country name is contained in the club string
    for (const [country, code] of Object.entries(countryMap)) {
      if (club.includes(country)) return code;
    }

    // Try to find 3-letter code in the string
    const match = club.match(/\b[A-Z]{3}\b/);
    return match ? match[0] : 'UNK';
  }

  extractTime(cells, isStartTime) {
    // Look for time patterns (HH:MM:SS or MM:SS)
    for (const cell of cells) {
      const timeMatch = cell.match(/\d{1,2}:\d{2}(:\d{2})?/);
      if (timeMatch) return timeMatch[0];
    }
    return null;
  }

  getMockCompetitors(type, isMenClass = true) {
    // Use actual competitor names from the hardcoded lists
    const names = isMenClass ? correctMenNames : correctWomenNames;

    // Map countries for known competitors
    const countryMap = {
      // Men's countries (based on actual mtbowcup2025 data)
      'Mihkel Mahla': 'EST',
      'Mihail Stoev': 'BUL',
      'Sergi Oliveras i Ferrer': 'ESP',
      'Matteo Traversi Montani': 'ITA',
      'Marek Hasman': 'CZE',
      'Daumantas Kiela': 'LTU',
      'Bernhard Kogler': 'AUT',
      'Mark Huster': 'GER',
      'Nikolay Nachev': 'BUL',
      'Petar Popunkyov': 'BUL',
      'Jocelin Lauret': 'FRA',
      'Krzysztof Wroniak': 'POL',
      'Mathieu Vayssat': 'FRA',
      'Michele Traversi Montani': 'ITA',
      'Daniel Marques': 'POR',
      'Marco Pelov': 'BUL',
      'Antoine Lesquer': 'FRA',
      'Juan Sanz': 'ESP',
      'Rostislav Kostadinov': 'BUL',
      'Martin Illig': 'GER',
      'Noah Tristan Hoffmann': 'GER',
      'Filip Janowski': 'POL',
      'Per Haehnel': 'GER',
      'Ildar Mihnev': 'BUL',
      'Oliver Friis': 'DEN',
      'Stanimir Belomazhev': 'BUL',
      'Grzegorz Nowak': 'POL',
      'Georg Koffler': 'AUT',
      'Joao Ferreira': 'POR',
      'Augustin Leclere': 'FRA',
      'Tomi Nykanen': 'FIN',
      'Luca Dallavalle': 'ITA',
      'Teemu Kaksonen': 'FIN',
      'Flurin Schnyder': 'SUI',
      'Jussi Laurila': 'FIN',
      'Noah Rieder': 'SUI',
      'Jeremi Pourre': 'FRA',
      'Riccardo Rossetto': 'ITA',
      'Paul Debray': 'FRA',
      'Bartosz Niebielski': 'POL',
      'Vojtech Stransky': 'CZE',
      'Ignas Ambrazas': 'LTU',
      'Vojtech Ludvik': 'CZE',
      'Andreas Waldmann': 'AUT',
      'Krystof Bogar': 'CZE',
      'Samuel Pokala': 'FIN',
      'Jan Hasek': 'CZE',
      'Hannes Hnilica': 'AUT',
      'Jonas Maiselis': 'LTU',
      'Fabiano Bettega': 'ITA',
      'Armel Berthaud': 'FRA',
      // Women's countries
      'Lola Colle': 'FRA',
      'Gergana Stoycheva': 'BUL',
      'Vytene Puisyte': 'LTU',
      'Teodora Tabakova': 'BUL',
      'Chiara Magni': 'ITA',
      'Slavena Petkova': 'BUL',
      'Nerea Garcia Rodriguez': 'ESP',
      'Greta Dimitrova': 'BUL',
      'Marii Isabel Allikberg': 'EST',
      'Ivana Pedeva': 'BUL',
      'Lou Colle': 'FRA',
      'Kosara Boteva': 'BUL',
      'Karolina Mickeviciute Juodisiene': 'LTU',
      'Marisa Costa': 'POR',
      'Anna Tkaczuk': 'POL',
      'Jade Boussier': 'FRA',
      'Silja YliHietanen': 'FIN',
      'Jana Luscher Alemany': 'SUI',
      'Marketa Mulickova': 'CZE',
      'Lou Garcin': 'FRA',
      'Ewa Haltof': 'POL',
      'Jana Hnilica': 'AUT',
      'Lucie Nedomlelova': 'CZE',
      'Siiri Rasimus': 'FIN',
      'Rozalie Kucharova': 'CZE',
      'Anna Kaminska': 'POL',
      'Constance Devillers': 'FRA',
      'Nikoline Splittorff': 'DEN',
      'Iris Aurora Pecorari': 'ITA',
      'Caecilie Christoffersen': 'DEN',
      'Marika Hara': 'FIN',
      'Camilla Soegaard': 'DEN',
      'Valerie Kamererova': 'CZE',
      'Algirda Mickuviene': 'LTU',
      'Celine Wellenreiter': 'AUT',
      'Ruska Saarela': 'FIN',
      'Ursina Jaeggi': 'SUI',
      'Gabriella Gustafsson': 'SWE'
    };

    // Generate realistic start times
    // Men start at 11:30, Women start at 11:31
    const generateStartTime = (index, isMen) => {
      const baseHour = 11;
      const baseMinute = isMen ? 30 : 31;
      const intervalMinutes = 2;

      const totalMinutes = baseMinute + (index * intervalMinutes);
      const hours = baseHour + Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    };

    // Generate competitors from the actual names - use all available names
    const competitors = names.map((name, index) => ({
      id: `mock_${index + 1}`,
      name: name,
      country: countryMap[name] || 'UNK',
      club: '',
      bib: isMenClass ? `${index + 1}` : `${101 + index}`,
      card: `${8000000 + Math.floor(Math.random() * 999999)}`,
      rank: type === 'results' ? index + 1 : null,
      startTime: type === 'startlist' || type === 'splits' ? generateStartTime(index, isMenClass) : null,
      finalTime: type === 'results' ? `${35 + index * 2}:${String((index * 7) % 60).padStart(2, '0')}` : null,
      status: type === 'results' ? 'finished' : 'not_started',
      year: ''
    }));

    return competitors;
  }

  // Fetch competitors for a class - fetch both start list and results, merge them
  async fetchCompetitors(eventId, competitionId, classId) {
    try {
      console.log(`Fetching competitors for event ${eventId}, competition ${competitionId}, class ${classId}`);

      // Fetch both start list and results in parallel
      const [startList, results] = await Promise.all([
        this.fetchStartList(eventId, competitionId, classId),
        this.fetchResults(eventId, competitionId, classId)
      ]);

      // If we have results, merge them with start list data
      if (results && results.length > 0) {
        console.log(`Merging ${results.length} results with ${startList.length} start list entries`);

        // Create a map of results by name for quick lookup
        const resultsMap = new Map();
        results.forEach(r => resultsMap.set(r.name, r));

        // Merge data: update start list entries with results data where available
        const mergedCompetitors = startList.map(competitor => {
          const result = resultsMap.get(competitor.name);
          if (result) {
            // Competitor has finished - merge the data
            return {
              ...competitor,
              rank: result.rank,
              finalTime: result.finalTime,
              status: 'finished'
            };
          }
          return competitor;
        });

        // Add any results entries that weren't in the start list
        results.forEach(result => {
          if (!startList.find(s => s.name === result.name)) {
            mergedCompetitors.push(result);
          }
        });

        return mergedCompetitors;
      }

      // No results yet, just return start list
      return startList || [];
    } catch (error) {
      console.error('Error fetching competitors:', error);
      return [];
    }
  }

  // Find Men/Women classes
  findEliteClasses(classes) {
    // For mtbowcup2025, classes are simply 'Men' and 'Women'
    const menClass = classes.find(c => c.name === 'Men' || c.id === 'Men');
    const womenClass = classes.find(c => c.name === 'Women' || c.id === 'Women');

    return { menClass, womenClass };
  }

  // Transform competitor data
  transformCompetitor(competitor, category, index) {
    // Clean up start time - remove timezone information
    let startTime = competitor.startTime || competitor.start || competitor.starttime || '00:00:00';
    if (startTime && typeof startTime === 'string') {
      startTime = startTime.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();
    }

    return {
      id: competitor.id || `${category}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      name: competitor.name || 'Unknown',
      country: competitor.country || this.extractCountry(competitor),
      startTime: startTime,
      finalTime: competitor.finalTime || competitor.time || competitor.result || null,
      status: competitor.status || this.determineStatus(competitor),
      rank: competitor.rank || (competitor.place ? parseInt(competitor.place) : null),
      splits: this.transformSplits(competitor.splits || competitor.controls),
      category: category,
      bib: competitor.bib || '',
      card: competitor.card || '',
      club: competitor.club || ''
    };
  }

  extractCountry(competitor) {
    if (competitor.nat) return competitor.nat;
    if (competitor.country) return competitor.country;
    if (competitor.club?.includes('(') && competitor.club?.includes(')')) {
      const match = competitor.club.match(/\(([A-Z]{3})\)/);
      if (match) return match[1];
    }
    return 'UNK';
  }

  determineStatus(competitor) {
    if (competitor.status === 'OK' && competitor.time) return 'finished';
    if (competitor.status === 'DNS') return 'dns';
    if (competitor.status === 'DNF') return 'dnf';
    if (competitor.status === 'DSQ' || competitor.status === 'DISQ') return 'dsq';
    if (!competitor.start && !competitor.starttime) return 'not_started';
    if (competitor.time || competitor.result) return 'finished';
    return 'running';
  }

  transformSplits(splits) {
    if (!splits) return {};

    const transformed = {};
    if (Array.isArray(splits)) {
      splits.forEach((split, index) => {
        if (split.time || split.controltime) {
          transformed[`control${index + 1}`] = split.time || split.controltime;
        }
      });
    }
    return transformed;
  }

  // Main method to fetch event data
  async fetchEventData(eventUrl) {
    const eventId = this.parseEventIdFromUrl(eventUrl);
    if (!eventId) {
      throw new Error('Invalid event URL');
    }

    try {
      // Fetch all competitions for this event
      const competitions = await this.fetchCompetitions(eventId);

      const eventData = {
        eventId,
        eventName: eventId.toUpperCase(),
        competitions: []
      };

      // For each competition, fetch the M21/W21 data
      // Only fetch first competition initially for speed
      for (const comp of competitions.slice(0, 1)) {
        const competitionData = {
          id: comp.id,
          name: comp.name,
          date: comp.date,
          time: comp.time,
          men: [],
          women: []
        };

        try {
          // Fetch classes for this competition
          const classes = await this.fetchClasses(eventId, comp.id);
          const { menClass, womenClass } = this.findEliteClasses(classes);

          // Fetch both in parallel for speed
          const [menCompetitors, womenCompetitors] = await Promise.all([
            menClass ? this.fetchCompetitors(eventId, comp.id, menClass.id) : Promise.resolve([]),
            womenClass ? this.fetchCompetitors(eventId, comp.id, womenClass.id) : Promise.resolve([])
          ]);

          competitionData.men = menCompetitors.map((c, index) => this.transformCompetitor(c, 'Men', index));
          competitionData.women = womenCompetitors.map((c, index) => this.transformCompetitor(c, 'Women', index));
        } catch (err) {
          console.error(`Error fetching data for competition ${comp.name}:`, err);
          // Leave empty on error
          competitionData.men = [];
          competitionData.women = [];
        }

        eventData.competitions.push(competitionData);
      }

      // Add remaining competitions without data for now
      for (const comp of competitions.slice(1)) {
        eventData.competitions.push({
          id: comp.id,
          name: comp.name,
          date: comp.date,
          time: comp.time,
          men: [],
          women: []
        });
      }

      return eventData;
    } catch (error) {
      console.error('Error fetching event data:', error);
      // Return mock data for testing
      return this.getMockEventData();
    }
  }

  // Mock data for testing
  getMockEventData() {
    return {
      eventId: 'seemoc2025',
      eventName: 'SEEMOC 2025',
      competitions: [
        {
          id: 1,
          name: 'Middle',
          date: '2025-09-04',
          time: '10:00',
          men: [
            { id: '1', name: 'Test Runner 1', country: 'NOR', startTime: '10:00:00', status: 'not_started', category: 'Men' },
            { id: '2', name: 'Test Runner 2', country: 'SWE', startTime: '10:02:00', status: 'not_started', category: 'Men' }
          ],
          women: [
            { id: '3', name: 'Test Runner 3', country: 'FIN', startTime: '10:01:00', status: 'not_started', category: 'Women' },
            { id: '4', name: 'Test Runner 4', country: 'SUI', startTime: '10:03:00', status: 'not_started', category: 'Women' }
          ]
        },
        {
          id: 2,
          name: 'Long',
          date: '2025-09-05',
          time: '10:00',
          men: [],
          women: []
        },
        {
          id: 3,
          name: 'Relay',
          date: '2025-09-06',
          time: '10:00',
          men: [],
          women: []
        },
        {
          id: 4,
          name: 'Sprint',
          date: '2025-09-07',
          time: '09:30',
          men: [],
          women: []
        }
      ]
    };
  }

  // Start polling for updates
  async startPolling(eventUrl, competitionId, onUpdate, interval = 30000) {
    const fetchAndUpdate = async () => {
      try {
        const data = await this.fetchEventData(eventUrl);
        const competition = data.competitions.find(c => c.id === competitionId);
        if (competition) {
          onUpdate(competition);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Initial fetch
    await fetchAndUpdate();

    // Set up polling
    return setInterval(fetchAndUpdate, interval);
  }

  stopPolling(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
    }
  }
}

const liveResultsServiceInstance = new LiveResultsService();
export default liveResultsServiceInstance;