/**
 * Tavus API Verification Script
 * 
 * This script properly tests Tavus API endpoints using the correct x-api-key
 * authentication method and handles response bodies correctly to avoid
 * "body used already" errors.
 */

require('dotenv').config();

// Configuration
const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TAVUS_API_BASE = 'https://tavusapi.com/v2';

/**
 * Test a Tavus API endpoint with proper error handling
 * 
 * @param {string} url - The endpoint URL to test
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {object} body - Request body for POST/PUT requests
 * @returns {Promise<object|null>} The response data or null if failed
 */
async function testTavusEndpoint(url, method = 'GET', body = null) {
  console.log(`\n[${method}] Testing ${url}...`);
  
  try {
    const options = {
      method,
      headers: {
        'x-api-key': TAVUS_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    // Read the response data exactly once
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      // Parse as JSON
      try {
        responseData = await response.json();
        console.log('Response data (JSON):', JSON.stringify(responseData, null, 2).substring(0, 300));
      } catch (jsonError) {
        const textData = await response.text();
        console.log('Invalid JSON response:', textData.substring(0, 300));
        responseData = textData;
      }
    } else {
      // Get as text
      responseData = await response.text();
      console.log('Response data (text):', responseData.substring(0, 300));
    }
    
    // Determine success based on status code
    if (response.ok) {
      console.log('✅ Success!');
      return { success: true, data: responseData, status: response.status };
    } else {
      console.log('❌ Failed with status code:', response.status);
      return { success: false, error: responseData, status: response.status };
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run a series of API tests
 */
async function runApiTests() {
  console.log('=== Tavus API Verification Test ===');
  console.log('Using base URL:', TAVUS_API_BASE);
  
  if (!TAVUS_API_KEY) {
    console.error('❌ TAVUS_API_KEY is missing from environment variables');
    process.exit(1);
  }
  
  // Test 1: Get replicas (simple GET test)
  console.log('\n===== Test 1: List Replicas =====');
  const replicasResult = await testTavusEndpoint(`${TAVUS_API_BASE}/replicas`);
  
  // Test 2: Get personas
  console.log('\n===== Test 2: List Personas =====');
  const personasResult = await testTavusEndpoint(`${TAVUS_API_BASE}/personas`);
  
  // Test 3: Create conversation (POST test with correct payload)
  // Only run this if we successfully got replicas or personas
  let conversationResult = null;
  if (replicasResult.success && replicasResult.data && replicasResult.data.data) {
    const replicas = replicasResult.data.data;
    if (replicas.length > 0) {
      console.log('\n===== Test 3: Create Conversation =====');
      
      // Get the first replica ID
      const replicaId = replicas[0].id || replicas[0].replica_id;
      
      // Create the proper payload according to Tavus API documentation
      const conversationPayload = {
        replica_id: replicaId,
        conversation_name: `API-Test-${Date.now()}`
      };
      
      // If we have personas, include a persona_id
      if (personasResult.success && personasResult.data && personasResult.data.data 
          && personasResult.data.data.length > 0) {
        const personaId = personasResult.data.data[0].id || personasResult.data.data[0].persona_id;
        conversationPayload.persona_id = personaId;
        console.log('Including persona_id in payload:', personaId);
      }
      
      console.log('Using payload:', JSON.stringify(conversationPayload, null, 2));
      
      conversationResult = await testTavusEndpoint(
        `${TAVUS_API_BASE}/conversations`, 
        'POST', 
        conversationPayload
      );
    }
  }
  
  // Summary
  console.log('\n===== TEST RESULTS SUMMARY =====');
  console.log('Replicas API:', replicasResult.success ? '✅ SUCCESS' : '❌ FAILED');
  console.log('Personas API:', personasResult.success ? '✅ SUCCESS' : '❌ FAILED');
  
  if (conversationResult) {
    console.log('Create Conversation:', conversationResult.success ? '✅ SUCCESS' : '❌ FAILED');
  } else {
    console.log('Create Conversation: ⚠️ NOT TESTED');
  }
  
  // Provide guidance based on test results
  if (replicasResult.success || personasResult.success) {
    console.log('\n✅ API CONNECTION VERIFIED!');
    console.log('You can now use the Tavus API in your application.');
  } else {
    console.log('\n❌ API CONNECTION FAILED!');
    console.log('Please check:');
    console.log('1. Your API key is correct');
    console.log('2. You have proper network connectivity');
    console.log('3. The Tavus API service is operational');
  }
}

// Run all tests
runApiTests()
  .then(() => {
    console.log('\nVerification complete!');
  })
  .catch((error) => {
    console.error('\nUnexpected error during verification:', error.message);
    process.exit(1);
  });
