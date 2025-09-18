# SportIdent Center API Integration Guide

## Overview

This document provides the correct method for connecting to SportIdent Center's live data API based on extensive research and testing.

## Key Findings

### ❌ What DOESN'T Work
- **WebSocket connections**: SportIdent Center API does not support WebSocket endpoints
- **Authorization Bearer tokens**: API uses custom authentication header
- **Standard base URLs**: Using `center.sportident.com` directly may not work

### ✅ What WORKS

#### Authentication
- **Header**: `apikey: your-api-key-here`
- **NOT**: `Authorization: Bearer your-api-key`
- **NOT**: `X-API-Key: your-api-key`

#### Base URL
- **Primary**: `https://center-origin.sportident.com`
- **Alternative**: `https://center.sportident.com` (also works)

#### Endpoint Structure
```
GET /api/rest/v1/public/events/{eventId}/punches
```

#### Complete Example
```bash
curl 'https://center-origin.sportident.com/api/rest/v1/public/events/19580/punches?afterId=0&projection=simple&limit=1000' \
  -H 'apikey: 5faf6cc9-b2d4-97b7-e5ad-fedfb0e13679' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json;charset=UTF-8'
```

## Live Data Polling Strategy

SportIdent uses **HTTP polling** instead of real-time connections:

1. **Start**: Set `afterId=0` for first request
2. **Poll**: Make requests every 10 seconds (recommended interval)
3. **Increment**: Use highest punch ID from response as next `afterId`
4. **Repeat**: Continue polling with updated `afterId`

### Parameters
- `afterId`: Start with 0, then use highest ID from previous response
- `projection`: Set to "simple" for basic data
- `limit`: Maximum 1000 records per request

## Data Structure

### Punch Record Example
```json
{
  "id": 6157905,
  "modem": "9000190",
  "card": 8740147,
  "time": 1750411436058,
  "code": 37,
  "mode": "BcControl",
  "receptionTime": 1750400637000
}
```

### Field Descriptions
- `id`: Unique punch identifier (use for `afterId` parameter)
- `modem`: SportIdent modem/station serial number
- `card`: Competitor's SI card number
- `time`: Punch timestamp (milliseconds since epoch)
- `code`: Control point code
- `mode`: Punch mode (BcControl, Unknown, etc.)
- `receptionTime`: When data was received by center (milliseconds since epoch)

## Implementation

### Node.js Example
```javascript
const axios = require('axios');

async function fetchPunches(apiKey, eventId, afterId = 0) {
  const response = await axios.get(
    `https://center-origin.sportident.com/api/rest/v1/public/events/${eventId}/punches`,
    {
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json;charset=UTF-8'
      },
      params: {
        afterId: afterId,
        projection: 'simple',
        limit: 1000
      }
    }
  );

  return response.data;
}
```

### Polling Loop
```javascript
let lastPunchId = 0;

setInterval(async () => {
  try {
    const punches = await fetchPunches(apiKey, eventId, lastPunchId);

    if (punches.length > 0) {
      // Process new punches
      punches.forEach(punch => {
        console.log('New punch:', punch);
        // Update highest ID for next poll
        if (punch.id > lastPunchId) {
          lastPunchId = punch.id;
        }
      });
    }
  } catch (error) {
    console.error('Polling error:', error.message);
  }
}, 10000); // Poll every 10 seconds
```

## Error Handling

### Common HTTP Status Codes
- **200**: Success - data retrieved
- **401**: Unauthorized - check API key
- **403**: Forbidden - no access to event
- **404**: Not found - check event ID or endpoint

### Troubleshooting
1. **401 Unauthorized**: Verify API key is correct and active
2. **403 Forbidden**: Check if API key has access to the specific event
3. **404 Not Found**: Verify event ID exists and endpoint URL is correct

## Testing

Use the included test script to verify your connection:

```bash
node test-sportident-api.js
```

This script will:
- Test the correct endpoint and authentication
- Show sample data structure
- Try alternative endpoints if needed
- Provide detailed error information

## Server Implementation

The SportIdent server (`sportident-server/server.js`) implements:
- Automatic polling every 10 seconds
- Incremental data fetching using `afterId`
- REST API endpoints for accessing received data
- Real-time event storage and retrieval

### Available Endpoints
- `GET /api/sportident/status` - Server and connection status
- `GET /api/sportident/events` - All received events
- `GET /api/sportident/punches` - Punch events only
- `GET /health` - Health check

## Credentials Used

- **Event ID**: 19580
- **API Key**: 5faf6cc9-b2d4-97b7-e5ad-fedfb0e13679
- **Event URL**: https://center.sportident.com/admin/events/19580/punches

## References

- [SportIdent Center REST API Documentation](https://docs.sportident.com/developers/center-rest-api)
- [SportIdent Live Data Guide](https://docs.sportident.com/user-guide/en/live.html)