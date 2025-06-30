/**
 * Tavus API Version Check Script
 * 
 * This script verifies the Tavus API version and validates available endpoints
 * by trying both v1 and v2 paths.
 */

require('dotenv').config();
const fetch = require('node-fetch');

// Configuration
const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TAVUS_API_BASE_URL_V1 = 'https://tavusapi.com/v1';
const TAVUS_API_BASE_URL_V2 = 'https://tavusapi.com/v2';
const TAVUS_DIRECT_URL = 'https://tavusapi.com'; // No version

/**
 * Check multiple version endpoints
 */
async function checkApiVersion() {
  console.log('=== Tavus API Version Check ===\n');

  if (!TAVUS_API_KEY) {
    console.error('❌ TAVUS_API_KEY is not set in environment variables');
    process.exit(1);
  }
  
  // Array of endpoints to try
  const endpoints = [
    { name: 'Root (no version)', url: TAVUS_DIRECT_URL },
    { name: 'v1', url: TAVUS_API_BASE_URL_V1 },
    { name: 'v2', url: TAVUS_API_BASE_URL_V2 },
  ];
  
  // For each base URL, try these paths
  const pathsToTry = [
    { path: '/', name: 'Root' },
    { path: '/health', name: 'Health' },
    { path: '/personas', name: 'Personas' },
    { path: '/replicas', name: 'Replicas' },
    { path: '/conversations', name: 'Conversations' }
  ];
  
  const results = {
    successful: [],
    failed: []
  };

  // Try each combination
  for (const endpoint of endpoints) {
    console.log(`\n===== Testing ${endpoint.name} endpoints =====`);
    
    for (const pathInfo of pathsToTry) {
      try {
        const fullUrl = `${endpoint.url}${pathInfo.path}`;
        console.log(`\nTrying: ${pathInfo.name} (${fullUrl})`);
        
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': TAVUS_API_KEY
          },
          // Add a timeout to prevent hanging requests
          timeout: 10000
        });
        
        const status = response.status;
        console.log(`Response status: ${status}`);
        
        let responseBody = '';
        try {
          // Attempt to parse JSON response
          const jsonResponse = await response.json();
          responseBody = JSON.stringify(jsonResponse, null, 2).substring(0, 500); // Limit length
          
          if (status >= 200 && status < 300) {
            console.log('✅ SUCCESS! Endpoint responded with valid JSON');
            results.successful.push({
              endpoint: endpoint.name,
              path: pathInfo.path,
              status,
              response: responseBody
            });
          } else {
            console.log('❌ FAILURE! Status code indicates error');
            results.failed.push({
              endpoint: endpoint.name,
              path: pathInfo.path,
              status,
              response: responseBody
            });
          }
          
        } catch (parseError) {
          // If not JSON, get as text
          responseBody = await response.text();
          responseBody = responseBody.substring(0, 500); // Limit length
          
          console.log('❌ FAILURE! Response is not valid JSON');
          console.log('Response (truncated):', responseBody);
          
          results.failed.push({
            endpoint: endpoint.name,
            path: pathInfo.path,
            status,
            error: 'Invalid JSON response',
            response: responseBody
          });
        }
      } catch (error) {
        console.error(`❌ Network error for ${endpoint.name}${pathInfo.path}: ${error.message}`);
        
        results.failed.push({
          endpoint: endpoint.name,
          path: pathInfo.path,
          error: error.message
        });
      }
    }
  }

  return results;
}

// Main function
async function main() {
  console.log('Starting API version check...');
  const results = await checkApiVersion();
  
  console.log('\n===== SUMMARY =====');
  
  if (results.successful.length > 0) {
    console.log('\n✅ SUCCESSFUL ENDPOINTS:');
    results.successful.forEach((result, index) => {
      console.log(`${index + 1}. ${result.endpoint}${result.path} (Status: ${result.status})`);
    });
    
    // Provide the best working endpoint to use
    const bestEndpoint = results.successful[0];
    console.log('\n🌟 RECOMMENDED API CONFIGURATION:');
    console.log(`Base URL: ${bestEndpoint.endpoint === 'v1' ? TAVUS_API_BASE_URL_V1 : 
                          bestEndpoint.endpoint === 'v2' ? TAVUS_API_BASE_URL_V2 : 
                          TAVUS_DIRECT_URL}`);
    console.log('Authentication: Authorization header with API key (no Bearer prefix)');
  } else {
    console.log('\n❌ NO SUCCESSFUL ENDPOINTS FOUND');
  }
  
  console.log('\n❌ FAILED ENDPOINTS:');
  results.failed.forEach((result, index) => {
    console.log(`${index + 1}. ${result.endpoint}${result.path} (${result.status || result.error})`);
  });
  
  console.log('\nAPI VERSION CHECK COMPLETE');
}

// Run the checks
main()
  .then(() => {
    console.log('\nVersion check process completed');
  })
  .catch((error) => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  });
