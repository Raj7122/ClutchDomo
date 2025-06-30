/**
 * Tavus API Health Check Script
 * 
 * This script verifies basic connectivity with the Tavus API health endpoint
 * to determine if the API is operational.
 */

require('dotenv').config();
const fetch = require('node-fetch');

// Configuration
const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TAVUS_API_BASE_URL = 'https://tavusapi.com/v2';

/**
 * Check Tavus API health
 */
async function checkTavusHealth() {
  console.log('=== Tavus API Health Check ===\n');
  console.log('Using API base URL:', TAVUS_API_BASE_URL);

  if (!TAVUS_API_KEY) {
    console.error('❌ TAVUS_API_KEY is not set in environment variables');
    process.exit(1);
  }

  // Retry with exponential backoff
  let retryCount = 0;
  const maxRetries = 3;
  let lastError = null;

  while (retryCount <= maxRetries) {
    try {
      // Add retry delay with exponential backoff (except for first attempt)
      if (retryCount > 0) {
        const delayMs = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying in ${delayMs/1000} seconds (attempt ${retryCount}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      console.log(`\n[Attempt ${retryCount+1}/${maxRetries+1}] Testing Tavus API health endpoint...`);
      
      const healthResponse = await fetch(`${TAVUS_API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': TAVUS_API_KEY
        },
        // Add a timeout to prevent hanging requests
        timeout: 10000
      });
      
      const healthStatus = healthResponse.status;
      console.log(`Response status: ${healthStatus}`);
      
      let responseBody;
      try {
        // Try to parse as JSON first
        responseBody = await healthResponse.json();
      } catch (e) {
        // If not JSON, get as text
        responseBody = await healthResponse.text();
      }
      
      if (healthStatus >= 200 && healthStatus < 300) {
        console.log('✅ Tavus API health check passed!');
        console.log('Response:', typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody, null, 2));
        return true;
      } else {
        console.error(`❌ Health check failed with status ${healthStatus}`);
        console.error('Response:', typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody, null, 2));
        lastError = `HTTP ${healthStatus}: ${typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)}`;
      }
    } catch (error) {
      console.error(`❌ Network error during health check: ${error.message}`);
      lastError = error.message;
    }
    
    retryCount++;
  }
  
  console.error(`\n❌ All ${maxRetries+1} health check attempts failed. Last error: ${lastError}`);
  return false;
}

// Additional check for API base URL consistency
function validateEnvironmentVariables() {
  console.log('\n[Environment Check] Validating configuration...');
  
  // Check if the TAVUS_API_KEY is properly set in both regular and NEXT_PUBLIC vars
  const publicApiKey = process.env.NEXT_PUBLIC_TAVUS_API_KEY;
  if (TAVUS_API_KEY !== publicApiKey) {
    console.warn('⚠️ Warning: TAVUS_API_KEY and NEXT_PUBLIC_TAVUS_API_KEY are different!');
    console.log(`TAVUS_API_KEY: ${TAVUS_API_KEY?.substring(0, 8)}...`);
    console.log(`NEXT_PUBLIC_TAVUS_API_KEY: ${publicApiKey?.substring(0, 8)}...`);
  } else {
    console.log('✅ API key consistency check passed');
  }
}

// Main function
async function main() {
  validateEnvironmentVariables();
  
  const isHealthy = await checkTavusHealth();
  
  if (isHealthy) {
    console.log('\n=== SUMMARY ===');
    console.log('✅ Tavus API appears to be operational');
    console.log('✅ API key authentication is properly configured');
    console.log('\nIf you are still experiencing issues with specific endpoints, the service may:');
    console.log('1. Have endpoint-specific restrictions or requirements');
    console.log('2. Be experiencing partial service disruptions');
    console.log('3. Have rate limits or other restrictions on your API key');
    console.log('\nRecommendation: Try again in a few minutes or contact Tavus support');
  } else {
    console.log('\n=== SUMMARY ===');
    console.log('❌ Tavus API health check failed after multiple attempts');
    console.log('\nPossible reasons:');
    console.log('1. Tavus API is experiencing outage or maintenance');
    console.log('2. Network connectivity issues to Tavus servers');
    console.log('3. API key permissions are insufficient');
    console.log('\nRecommendation: Verify API status with Tavus support');
  }
}

// Run the checks
main()
  .then(() => {
    console.log('\nHealth check process completed');
  })
  .catch((error) => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  });
