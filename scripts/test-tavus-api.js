#!/usr/bin/env node

/**
 * Tavus API Test Script
 * 
 * This script tests the Tavus API endpoints and provides detailed debugging information.
 * Run with: node scripts/test-tavus-api.js
 */

require('dotenv').config();

const TAVUS_BASE_URL = 'https://tavusapi.com/v2';
const SANDBOX_URL = 'https://sandbox.tavusapi.com/v2';

class TavusAPITester {
  constructor() {
    this.apiKey = process.env.TAVUS_API_KEY || process.env.NEXT_PUBLIC_TAVUS_API_KEY;
    this.environment = process.env.TAVUS_ENVIRONMENT || 'production';
    this.baseUrl = this.environment === 'production' ? TAVUS_BASE_URL : SANDBOX_URL;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'debug': '🔧'
    }[level] || '📋';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async testEnvironmentSetup() {
    this.log('info', 'Testing Environment Setup...');
    
    // Check API key
    if (!this.apiKey) {
      this.log('error', 'TAVUS_API_KEY not found in environment variables');
      this.log('info', 'Please set TAVUS_API_KEY in your .env file');
      return false;
    }
    
    this.log('success', `API Key found: ${this.apiKey.substring(0, 20)}...`);
    this.log('info', `Environment: ${this.environment}`);
    this.log('info', `Base URL: ${this.baseUrl}`);
    
    // Validate API key format
    if (!this.apiKey.startsWith('tavus_api_key_')) {
      this.log('warning', 'API key format may be incorrect. Expected format: tavus_api_key_...');
    }
    
    return true;
  }

  async testNetworkConnectivity() {
    this.log('info', 'Testing Network Connectivity...');
    
    try {
      // Test basic connectivity to Tavus
      const response = await fetch(this.baseUrl.replace('/v2', ''), {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      
      this.log('success', `Network connectivity OK (Status: ${response.status})`);
      return true;
    } catch (error) {
      this.log('error', 'Network connectivity failed', {
        error: error.message,
        type: error.name
      });
      
      if (error.name === 'AbortError') {
        this.log('error', 'Request timed out - check internet connection');
      } else if (error.message.includes('ENOTFOUND')) {
        this.log('error', 'DNS resolution failed - check DNS settings');
      } else if (error.message.includes('ECONNREFUSED')) {
        this.log('error', 'Connection refused - check firewall/proxy settings');
      }
      
      return false;
    }
  }

  async testPersonasEndpoint() {
    this.log('info', 'Testing /v2/personas endpoint...');
    
    const url = `${this.baseUrl}/personas`;
    const headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'DOMO-App-Test/1.0'
    };
    
    this.log('debug', 'Request details', {
      url,
      method: 'GET',
      headers: {
        ...headers,
        'x-api-key': headers['x-api-key'].substring(0, 20) + '...'
      }
    });
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000)
      });
      
      this.log('info', `Response received (Status: ${response.status})`);
      
      // Log response headers
      const responseHeaders = Object.fromEntries(response.headers.entries());
      this.log('debug', 'Response headers', responseHeaders);
      
      if (!response.ok) {
        const errorText = await response.text();
        this.log('error', `API Error: ${response.status} ${response.statusText}`, {
          body: errorText
        });
        
        // Provide specific error guidance
        switch (response.status) {
          case 401:
            this.log('error', 'Authentication failed - check your API key');
            break;
          case 403:
            this.log('error', 'Access forbidden - check your subscription/permissions');
            break;
          case 429:
            this.log('error', 'Rate limit exceeded - wait before retrying');
            break;
          case 500:
            this.log('error', 'Server error - try again later or contact support');
            break;
          default:
            this.log('error', 'Unexpected error - check API documentation');
        }
        
        return false;
      }
      
      const data = await response.json();
      this.log('success', 'Personas endpoint test successful');
      
      if (data.data && Array.isArray(data.data)) {
        this.log('info', `Found ${data.data.length} personas`);
        
        data.data.forEach((persona, index) => {
          this.log('info', `  ${index + 1}. ${persona.persona_name || 'Unnamed'} (${persona.status || 'unknown status'})`);
        });
        
        if (data.data.length === 0) {
          this.log('warning', 'No personas found - you may need to create one first');
        }
      } else {
        this.log('warning', 'Unexpected response format', data);
      }
      
      return true;
      
    } catch (error) {
      this.log('error', 'Request failed', {
        error: error.message,
        type: error.name
      });
      
      if (error.name === 'AbortError') {
        this.log('error', 'Request timed out - API may be slow or unreachable');
      }
      
      return false;
    }
  }

  async testReplicasEndpoint() {
    this.log('info', 'Testing /v2/replicas endpoint...');
    
    const url = `${this.baseUrl}/replicas`;
    const headers = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'DOMO-App-Test/1.0'
    };
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        this.log('warning', `Replicas endpoint failed: ${response.status}`, errorText);
        return false;
      }
      
      const data = await response.json();
      this.log('success', 'Replicas endpoint test successful');
      
      if (data.data && Array.isArray(data.data)) {
        this.log('info', `Found ${data.data.length} replicas`);
        
        data.data.forEach((replica, index) => {
          this.log('info', `  ${index + 1}. ${replica.replica_name || 'Unnamed'} (${replica.status || 'unknown status'})`);
        });
      }
      
      return true;
      
    } catch (error) {
      this.log('warning', 'Replicas endpoint test failed', error.message);
      return false;
    }
  }

  async testHealthEndpoint() {
    this.log('info', 'Testing health endpoint...');
    
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        this.log('success', 'Health check passed', data);
        return true;
      } else {
        this.log('warning', `Health check failed: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.log('warning', 'Health endpoint not available', error.message);
      return false;
    }
  }

  async runAllTests() {
    console.log('\n🚀 Starting Tavus API Tests...\n');
    
    const results = {
      environment: await this.testEnvironmentSetup(),
      network: false,
      personas: false,
      replicas: false,
      health: false
    };
    
    if (results.environment) {
      results.network = await this.testNetworkConnectivity();
      
      if (results.network) {
        results.personas = await this.testPersonasEndpoint();
        results.replicas = await this.testReplicasEndpoint();
        results.health = await this.testHealthEndpoint();
      }
    }
    
    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.charAt(0).toUpperCase() + test.slice(1)} Test`);
    });
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n📈 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (results.personas) {
      console.log('\n🎉 Tavus API is working correctly!');
      console.log('You can now use Tavus in your application.');
    } else {
      console.log('\n🔧 Issues detected. Please review the errors above.');
      console.log('Common solutions:');
      console.log('1. Check your API key in the Tavus dashboard');
      console.log('2. Verify your internet connection');
      console.log('3. Check if you have the correct subscription plan');
      console.log('4. Contact Tavus support if issues persist');
    }
    
    console.log('\n📚 For more help, see: docs/TAVUS_TROUBLESHOOTING.md\n');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new TavusAPITester();
  tester.runAllTests().catch(console.error);
}

module.exports = TavusAPITester;