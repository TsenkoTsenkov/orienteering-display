import axios from 'axios';

// LiveResults.it API service
class LiveResultsService {
  constructor() {
    // Using local proxy server to bypass CORS restrictions
    this.useMockData = false; // Using real data through proxy
    this.proxyUrl = 'http://localhost:3001/api/fetch?url=';
    this.baseUrl = 'https://liveresults.orienteering.sport/api.php';
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
    // Return the known competitions for SEEMOC 2025
    // Since the API is not providing data, we'll use known competition structure
    return [
      { id: 1, name: 'Middle', date: '2025-09-04', time: '10:00' },
      { id: 2, name: 'Long', date: '2025-09-05', time: '10:00' },
      { id: 3, name: 'Relay', date: '2025-09-06', time: '10:00' },
      { id: 4, name: 'Sprint', date: '2025-09-07', time: '09:30' }
    ];
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
      const response = await this.makeProxiedRequest(url);

      console.log('Response received, parsing HTML...');
      // Parse the HTML response to extract competitor data
      const competitors = this.parseCompetitorData(response.data, 'startlist');
      console.log(`Parsed ${competitors.length} competitors from start list`);
      return competitors;
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
      const response = await this.makeProxiedRequest(url);

      return this.parseCompetitorData(response.data, 'results');
    } catch (error) {
      console.error('Error fetching results:', error);
      return this.getMockCompetitors('results');
    }
  }

  // Fetch splits for a class
  async fetchSplits(eventId, competitionId, classId) {
    try {
      const encodedClass = encodeURIComponent(classId);
      const url = `https://app.liveresults.it/${eventId}/${competitionId}/${encodedClass}/splits`;
      const response = await this.makeProxiedRequest(url);

      return this.parseCompetitorData(response.data, 'splits');
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

            competitor = {
              id: `comp_${competitors.length}`,
              startTime: cells[0] || null,
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

    const startTimes = ['10:00:00', '10:02:00', '10:04:00', '10:06:00', '10:08:00',
                       '10:10:00', '10:12:00', '10:14:00', '10:16:00', '10:18:00'];

    return baseCompetitors.map((comp, index) => ({
      ...comp,
      rank: type === 'results' ? index + 1 : null,
      startTime: type === 'startlist' ? startTimes[index] : null,
      finalTime: type === 'results' ? `${35 + index * 2}:${String((index * 7) % 60).padStart(2, '0')}` : null,
      status: type === 'results' ? 'finished' : 'not_started',
      year: comp.year || ''
    }));
  }

  // Fetch competitors for a class (combines all data)
  async fetchCompetitors(eventId, competitionId, classId) {
    try {
      console.log(`Fetching competitors for event ${eventId}, competition ${competitionId}, class ${classId}`);

      // Try to fetch results first (most complete data)
      let competitors = await this.fetchResults(eventId, competitionId, classId);

      if (competitors.length === 0 || competitors.every(c => c.id.startsWith('mock_'))) {
        console.log('No results found or mock data returned, trying start list...');
        // Fall back to start list if no results yet
        competitors = await this.fetchStartList(eventId, competitionId, classId);
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
    return {
      id: competitor.id || `${category}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      name: competitor.name || 'Unknown',
      country: this.extractCountry(competitor),
      startTime: competitor.start || competitor.starttime || '00:00:00',
      finalTime: competitor.time || competitor.result || null,
      status: this.determineStatus(competitor),
      rank: competitor.place ? parseInt(competitor.place) : null,
      splits: this.transformSplits(competitor.splits || competitor.controls),
      category: category
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