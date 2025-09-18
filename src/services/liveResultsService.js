import axios from 'axios';

// LiveResults.it API service
class LiveResultsService {
  constructor() {
    // Using proxy server to bypass CORS restrictions
    this.useMockData = false; // Using real data through proxy

    // Determine the environment and set proxy URLs accordingly
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Local development - use local proxy server
      const localProxy = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';
      this.proxyUrl = `${localProxy}/api/fetch?url=`;
      this.scrapeUrl = `${localProxy}/api/scrape?url=`;
    } else if (window.location.hostname.includes('netlify')) {
      // Production on Netlify - use Netlify Functions
      this.proxyUrl = '/.netlify/functions/fetch?url=';
      this.scrapeUrl = '/.netlify/functions/scrape?url=';
    } else {
      // Other production environments (e.g., custom domain)
      // Assume Netlify functions are available
      this.proxyUrl = '/.netlify/functions/fetch?url=';
      this.scrapeUrl = '/.netlify/functions/scrape?url=';
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

  // Scrape SPA content with Puppeteer
  async scrapeSPAContent(url) {
    try {
      const scrapeUrl = `${this.scrapeUrl}${encodeURIComponent(url)}`;
      const response = await axios.get(scrapeUrl, { timeout: 35000 }); // Longer timeout for Puppeteer
      return response.data;
    } catch (error) {
      console.error('Scraping failed:', url, error.message);
      throw error;
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

            // Only include known competition types
            if (name.match(/^(Middle|Long|Relay|Sprint)$/i)) {
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

      // Fallback to default competitions if parsing failed
      console.log('No competitions found in HTML, using defaults');
      return [
        { id: 'middle', name: 'Middle', date: 'Sep 4, 2025', time: '10:00 AM' },
        { id: 'long', name: 'Long', date: 'Sep 5, 2025', time: '10:00 AM' },
        { id: 'relay', name: 'Relay', date: 'Sep 6, 2025', time: '10:00 AM' },
        { id: 'sprint', name: 'Sprint', date: 'Sep 7, 2025', time: '9:30 AM' }
      ];
    } catch (error) {
      console.error('Error fetching competitions:', error);
      // Fallback to default competitions with string IDs
      return [
        { id: 'middle', name: 'Middle', date: 'Sep 4, 2025', time: '10:00 AM' },
        { id: 'long', name: 'Long', date: 'Sep 5, 2025', time: '10:00 AM' },
        { id: 'relay', name: 'Relay', date: 'Sep 6, 2025', time: '10:00 AM' },
        { id: 'sprint', name: 'Sprint', date: 'Sep 7, 2025', time: '9:30 AM' }
      ];
    }
  }


  // Fetch classes for a competition
  async fetchClasses(eventId, competitionId) {
    // For app.liveresults.it, we know the categories are M21 SEEOC and W21 SEEOC
    // Since the API doesn't provide a list, we'll return these directly
    return [
      { id: 'M21 SEEOC', name: 'M21 SEEOC', className: 'Men 21' },
      { id: 'W21 SEEOC', name: 'W21 SEEOC', className: 'Women 21' },
      { id: 'M21E', name: 'M21E', className: 'Men Elite 21' },
      { id: 'W21E', name: 'W21E', className: 'Women Elite 21' }
    ];
  }

  // Fetch start list for a class
  async fetchStartList(eventId, competitionId, classId) {
    try {
      const encodedClass = encodeURIComponent(classId);
      const url = `https://app.liveresults.it/${eventId}/${competitionId}/${encodedClass}/startlist`;
      console.log('Fetching start list from:', url);

      // ALWAYS fetch fresh data - no caching for OBS compatibility
      const scrapedData = await this.scrapeSPAContent(url);
      console.log('Scraped data:', scrapedData.rowCount, 'rows found');

      if (scrapedData.competitors && scrapedData.competitors.length > 0) {
        // Parse scraped data - extract name properly
        const competitors = scrapedData.competitors.map((comp, index) => {
          // Clean up the name (remove duplicate country info)
          let name = comp.structured?.name || comp.cells?.[1] || 'Unknown';
          name = name.split('   ')[0].trim(); // Remove duplicate country info

          // Clean up start time - remove timezone information
          let startTime = comp.structured?.startTime || comp.cells?.[0] || null;
          if (startTime) {
            startTime = startTime.replace(/\s*(UTC|GMT)[+-]?\d*/gi, '').trim();
          }

          return {
            id: `comp_${index}`,
            startTime: startTime,
            name: name,
            club: comp.structured?.club || comp.cells?.[2] || '',
            country: this.extractCountryFromClub(comp.structured?.club || comp.cells?.[2] || ''),
            bib: comp.structured?.bib || comp.cells?.[4] || '',
            card: comp.structured?.card || comp.cells?.[5] || '',
            status: 'not_started',
            rank: null,
            finalTime: null
          };
        });
        console.log(`Parsed ${competitors.length} competitors from scraped data`);
        return competitors;
      }

      // Fallback to mock data if no data found
      console.log('No data found, using mock data');
      return this.getMockCompetitors('startlist');
    } catch (error) {
      console.error('Error fetching start list:', error);
      return this.getMockCompetitors('startlist');
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
        const competitors = scrapedData.competitors.map((comp, index) => {
          // Clean up the name (remove duplicate country info)
          let name = comp.structured?.name || comp.cells?.[1] || 'Unknown';
          name = name.split('   ')[0].trim();

          return {
            id: `comp_${index}`,
            rank: parseInt(comp.cells?.[0]) || index + 1,
            name: name,
            club: comp.structured?.club || comp.cells?.[2] || '',
            country: this.extractCountryFromClub(comp.structured?.club || comp.cells?.[2] || ''),
            finalTime: comp.cells?.[3] || comp.cells?.[4] || null,
            startTime: null, // Results don't have start time
            bib: comp.structured?.bib || comp.cells?.[5] || '',
            card: comp.structured?.card || comp.cells?.[6] || '',
            status: 'finished'
          };
        });
        console.log(`Parsed ${competitors.length} competitors from results`);
        return competitors;
      }

      console.log('No results data found, returning empty array');
      return []; // Return empty array so it falls back to start list
    } catch (error) {
      console.error('Error fetching results:', error);
      return []; // Return empty array so it falls back to start list
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
        const competitors = scrapedData.competitors.map((comp, index) => {
          // Clean up the name (remove duplicate country info)
          let name = comp.structured?.name || comp.cells?.[1] || 'Unknown';
          name = name.split('   ')[0].trim();

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
        return this.getMockCompetitors(type);
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
              name: cells[1] || 'Unknown',
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
              name: cells[1] || 'Unknown',
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
              name: nameMatch[1].trim(),
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
        return this.getMockCompetitors(type);
      }

      return competitors;
    } catch (error) {
      console.error('Error parsing competitor data:', error);
      return this.getMockCompetitors(type);
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

  extractCountryFromClub(club) {
    // Extract country code from club name like "NT Croatia" -> "CRO"
    const countryMap = {
      'Croatia': 'CRO',
      'Bulgaria': 'BUL',
      'Serbia': 'SRB',
      'Romania': 'ROU',
      'Moldova': 'MDA',
      'Turkey': 'TUR',
      'Turkiye': 'TUR',
      'Greece': 'GRE',
      'Slovenia': 'SLO',
      'Bosnia': 'BIH',
      'Macedonia': 'MKD',
      'Albania': 'ALB'
    };

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

  getMockCompetitors(type) {
    // Mock data based on the actual SEEMOC 2025 structure
    const baseCompetitors = [
      { id: 'mock_1', name: 'Gabriel Sljivanac', country: 'CRO', club: 'NT Croatia', bib: '1101', card: '8208231' },
      { id: 'mock_2', name: 'Stefan Yordanov', country: 'BUL', club: 'NT Bulgaria', bib: '1102', card: '8581023' },
      { id: 'mock_3', name: 'Aleksa Franjkovic', country: 'SRB', club: 'NT Serbia', bib: '1103', card: '8002494', year: '2001' },
      { id: 'mock_4', name: 'Josip Vujanic', country: 'CRO', club: 'NT Croatia', bib: '1104', card: '8183010' },
      { id: 'mock_5', name: 'Sergiu Fala', country: 'MDA', club: 'NT Moldova', bib: '1105', card: '8522822' },
      { id: 'mock_6', name: 'Lorand Vigh', country: 'ROU', club: 'NT Romania', bib: '1106', card: '8033157' },
      { id: 'mock_7', name: 'Sabin Demir', country: 'TUR', club: 'NT Turkiye', bib: '1107', card: '8503745' },
      { id: 'mock_8', name: 'Filip Vujanic', country: 'CRO', club: 'NT Croatia', bib: '1108', card: '8524116' },
      { id: 'mock_9', name: 'Mihai Andrei Tintar', country: 'ROU', club: 'NT Romania', bib: '1109', card: '8500521' },
      { id: 'mock_10', name: 'Koray Sahin', country: 'TUR', club: 'NT Turkiye', bib: '1110', card: '8519815' }
    ];

    // Generate realistic start times (2-minute intervals starting from 10:00)
    const generateStartTime = (index) => {
      const baseHour = 10;
      const baseMinute = 0;
      const intervalMinutes = 2;

      const totalMinutes = baseMinute + (index * intervalMinutes);
      const hours = baseHour + Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    };

    return baseCompetitors.map((comp, index) => ({
      ...comp,
      rank: type === 'results' ? index + 1 : null,
      startTime: type === 'startlist' || type === 'splits' ? generateStartTime(index) : null,
      finalTime: type === 'results' ? `${35 + index * 2}:${String((index * 7) % 60).padStart(2, '0')}` : null,
      status: type === 'results' ? 'finished' : 'not_started',
      year: comp.year || ''
    }));
  }

  // Fetch competitors for a class (combines all data)
  async fetchCompetitors(eventId, competitionId, classId) {
    try {
      console.log(`Fetching competitors for event ${eventId}, competition ${competitionId}, class ${classId}`);

      // First fetch the start list which has start times and card numbers
      let competitors = await this.fetchStartList(eventId, competitionId, classId);

      // Then try to fetch results to merge with final times if available
      const results = await this.fetchResults(eventId, competitionId, classId);

      if (results.length > 0) {
        // Merge results data with start list data
        competitors = competitors.map(comp => {
          const result = results.find(r => r.name === comp.name || r.bib === comp.bib);
          if (result) {
            return {
              ...comp,
              rank: result.rank,
              finalTime: result.finalTime,
              status: result.status
            };
          }
          return comp;
        });
      }

      // Try to fetch splits for additional timing data
      const splits = await this.fetchSplits(eventId, competitionId, classId);
      if (splits.length > 0) {
        // Merge split times with competitor data
        competitors = competitors.map(comp => {
          const splitData = splits.find(s => s.name === comp.name);
          if (splitData) {
            return { ...comp, splits: splitData.splits };
          }
          return comp;
        });
      }

      return competitors;
    } catch (error) {
      console.error('Error fetching competitors:', error);
      return [];
    }
  }

  // Find M21/W21 classes (including variations)
  findEliteClasses(classes) {
    // Prioritize M21 SEEOC and W21 SEEOC for this specific event
    let menClass = classes.find(c => c.name === 'M21 SEEOC');
    let womenClass = classes.find(c => c.name === 'W21 SEEOC');

    // Fall back to other M21/W21 variations if not found
    if (!menClass) {
      menClass = classes.find(c =>
        c.name?.includes('M21') ||
        (c.className?.includes('Men') && (c.className?.includes('21') || c.className?.includes('Elite')))
      );
    }

    if (!womenClass) {
      womenClass = classes.find(c =>
        c.name?.includes('W21') ||
        (c.className?.includes('Women') && (c.className?.includes('21') || c.className?.includes('Elite')))
      );
    }

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
      for (const comp of competitions) {
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

          // Fetch men competitors
          if (menClass) {
            const menCompetitors = await this.fetchCompetitors(eventId, comp.id, menClass.id);
            competitionData.men = menCompetitors.map((c, index) => this.transformCompetitor(c, 'Men', index));
          }

          // Fetch women competitors
          if (womenClass) {
            const womenCompetitors = await this.fetchCompetitors(eventId, comp.id, womenClass.id);
            competitionData.women = womenCompetitors.map((c, index) => this.transformCompetitor(c, 'Women', index));
          }
        } catch (err) {
          console.error(`Error fetching data for competition ${comp.name}:`, err);
        }

        eventData.competitions.push(competitionData);
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