const axios = require('axios');

async function testScrape() {
  try {
    console.log('Testing scrape...');
    const response = await axios.get('http://localhost:3001/api/scrape?url=' + encodeURIComponent('https://app.liveresults.it/mtbowcup2025/sprint/Men/startlist'));

    if (response.data && response.data.competitors) {
      console.log('Total competitors:', response.data.competitors.length);
      console.log('\nFirst 5 competitors raw data:');
      response.data.competitors.slice(0, 5).forEach((comp, i) => {
        console.log(`\nCompetitor ${i + 1}:`);
        console.log('Cells:', comp.cells);
        console.log('Structured:', comp.structured);
      });

      // Check specific names
      console.log('\n\nChecking specific names:');
      const checkNames = ['Paul Debray', 'Stanimir Belomazhev', 'Vojtech Stransky', 'Gergana Stoycheva'];

      response.data.competitors.forEach((comp, i) => {
        const name = comp.cells?.[2] || comp.cells?.[1] || comp.structured?.name || '';
        checkNames.forEach(checkName => {
          if (name.toLowerCase().includes(checkName.split(' ')[1].toLowerCase())) {
            console.log(`\nFound ${checkName} candidate at index ${i}:`);
            console.log('Raw cells:', comp.cells);
            console.log('Extracted name from cells[2]:', comp.cells?.[2]);
          }
        });
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testScrape();