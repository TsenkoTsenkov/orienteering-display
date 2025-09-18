#!/usr/bin/env node

/**
 * Test script for SportIdent Center API connection
 * Tests the correct API endpoint and authentication method
 */

const axios = require('axios');

// Your credentials
const API_KEY = '5faf6cc9-b2d4-97b7-e5ad-fedfb0e13679';
const EVENT_ID = '19580';

async function testSportIdentAPI() {
  console.log('🧪 Testing SportIdent Center API Connection');
  console.log('==========================================');
  console.log(`Event ID: ${EVENT_ID}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
  console.log('');

  // Correct endpoint based on research
  const baseUrl = 'https://center-origin.sportident.com';
  const endpoint = `/api/rest/v1/public/events/${EVENT_ID}/punches`;
  const fullUrl = `${baseUrl}${endpoint}`;

  console.log(`Testing endpoint: ${fullUrl}`);
  console.log('');

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        // Correct authentication method for SportIdent
        'apikey': API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json;charset=UTF-8'
      },
      params: {
        afterId: 0,
        projection: 'simple',
        limit: 10
      },
      timeout: 15000 // 15 second timeout
    });

    console.log('✅ SUCCESS! Connection established');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Data type: ${Array.isArray(response.data) ? 'Array' : typeof response.data}`);

    if (Array.isArray(response.data)) {
      console.log(`Records received: ${response.data.length}`);

      if (response.data.length > 0) {
        console.log('\nSample record:');
        console.log(JSON.stringify(response.data[0], null, 2));

        // Show structure of all records
        console.log('\nRecord structure summary:');
        response.data.slice(0, 3).forEach((record, index) => {
          console.log(`Record ${index + 1}: ${Object.keys(record).join(', ')}`);
        });
      } else {
        console.log('No punch records found (this is normal if event is not active)');
      }
    } else {
      console.log('Response data:');
      console.log(JSON.stringify(response.data, null, 2));
    }

    // Check response headers for additional info
    if (response.headers['x-total-count']) {
      console.log(`\nTotal records available: ${response.headers['x-total-count']}`);
    }

  } catch (error) {
    console.log('❌ CONNECTION FAILED');
    console.log('');

    if (error.response) {
      console.log(`HTTP Status: ${error.response.status} ${error.response.statusText}`);
      console.log('Response headers:', Object.keys(error.response.headers));
      console.log('Response data:', error.response.data);

      if (error.response.status === 401) {
        console.log('\n🔑 Authentication Error:');
        console.log('- Check if your API key is correct');
        console.log('- Verify the API key is active in SportIdent Center');
        console.log('- Ensure you have access to this event');
      } else if (error.response.status === 404) {
        console.log('\n🔍 Not Found Error:');
        console.log('- Check if the event ID is correct');
        console.log('- Verify the endpoint URL is correct');
        console.log('- Event might not exist or be accessible');
      } else if (error.response.status === 403) {
        console.log('\n🚫 Forbidden Error:');
        console.log('- Your API key may not have permission to access this event');
        console.log('- Check event permissions in SportIdent Center');
      }
    } else if (error.request) {
      console.log('Network Error:', error.message);
      console.log('- Check your internet connection');
      console.log('- The API server might be down');
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Alternative endpoints to test if the main one fails
async function testAlternativeEndpoints() {
  console.log('\n🔄 Testing alternative endpoints...');

  const alternatives = [
    'https://center.sportident.com/api/rest/v1/public/events/' + EVENT_ID + '/punches',
    'https://center-origin.sportident.com/api/rest/v1/events/' + EVENT_ID + '/punches',
    'https://center.sportident.com/api/v1/events/' + EVENT_ID + '/punches'
  ];

  for (const url of alternatives) {
    console.log(`\nTrying: ${url}`);

    try {
      const response = await axios.get(url, {
        headers: {
          'apikey': API_KEY,
          'Accept': 'application/json'
        },
        params: { afterId: 0, limit: 1 },
        timeout: 10000
      });

      console.log(`✅ Success with alternative endpoint!`);
      console.log(`Status: ${response.status}`);
      return url;

    } catch (error) {
      console.log(`❌ Failed: ${error.response ? error.response.status : error.message}`);
    }
  }

  return null;
}

// Run the test
async function main() {
  await testSportIdentAPI();

  // If main endpoint failed, try alternatives
  console.log('\n' + '='.repeat(50));
  await testAlternativeEndpoints();

  console.log('\n📋 Summary:');
  console.log('- SportIdent Center API uses HTTP polling, not WebSockets');
  console.log('- Correct base URL: https://center-origin.sportident.com');
  console.log('- Authentication: apikey header (not Authorization Bearer)');
  console.log('- Endpoint: /api/rest/v1/public/events/{eventId}/punches');
  console.log('- Poll every 10 seconds using afterId parameter');
}

main().catch(console.error);