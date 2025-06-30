# Tavus API Troubleshooting Guide

## Overview
This guide addresses common issues with the Tavus API `/v2/personas` endpoint and agent display problems. Follow these steps systematically to identify and resolve issues.

## 1. Tavus API Endpoint Verification

### 1.1 Check API Authentication Credentials

**Step 1: Verify Environment Variables**
```bash
# Check if Tavus API key is set
echo $TAVUS_API_KEY
echo $NEXT_PUBLIC_TAVUS_API_KEY

# Expected format: tavus_api_key_xxxxxxxxxxxxxxxx
```

**Step 2: Test API Key Validity**
```bash
# Test with cURL
curl -X GET "https://tavusapi.com/v2/personas" \
  -H "x-api-key: YOUR_TAVUS_API_KEY" \
  -H "Content-Type: application/json"
```

**Expected Response (Success):**
```json
{
  "data": [
    {
      "persona_id": "persona_xxxxxxxx",
      "persona_name": "Default Sales Assistant",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Common Error Responses:**
```json
// 401 Unauthorized
{
  "error": "Invalid API key",
  "message": "The provided API key is invalid or expired"
}

// 403 Forbidden
{
  "error": "Access denied",
  "message": "Your subscription doesn't include access to this endpoint"
}

// 429 Rate Limited
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later"
}
```

### 1.2 Validate Request Headers and Parameters

**Required Headers:**
```javascript
const headers = {
  'x-api-key': process.env.TAVUS_API_KEY,
  'Content-Type': 'application/json',
  'User-Agent': 'DOMO-App/1.0'
};
```

**Test with Postman:**
1. Create new GET request to `https://tavusapi.com/v2/personas`
2. Add headers:
   - `x-api-key`: Your Tavus API key
   - `Content-Type`: application/json
3. Send request and check response

### 1.3 Confirm HTTP Method Usage

**Correct Implementation:**
```javascript
// ✅ Correct - GET method for retrieving personas
const response = await fetch('https://tavusapi.com/v2/personas', {
  method: 'GET',
  headers: {
    'x-api-key': process.env.TAVUS_API_KEY,
    'Content-Type': 'application/json'
  }
});
```

**Common Mistakes:**
```javascript
// ❌ Wrong - Using POST instead of GET
const response = await fetch('https://tavusapi.com/v2/personas', {
  method: 'POST', // Should be GET
  headers: headers
});
```

### 1.4 Test Endpoint Response

**Complete Test Script:**
```javascript
// test-tavus-api.js
async function testTavusAPI() {
  const apiKey = process.env.TAVUS_API_KEY;
  
  if (!apiKey) {
    console.error('❌ TAVUS_API_KEY not found in environment variables');
    return;
  }
  
  console.log('🔑 API Key found:', apiKey.substring(0, 20) + '...');
  
  try {
    const response = await fetch('https://tavusapi.com/v2/personas', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'DOMO-App/1.0'
      },
      timeout: 10000
    });
    
    console.log('📡 Response Status:', response.status);
    console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API Success:', data);
    
    if (data.data && data.data.length > 0) {
      console.log('👤 Available Personas:', data.data.length);
      data.data.forEach((persona, index) => {
        console.log(`  ${index + 1}. ${persona.persona_name} (${persona.status})`);
      });
    } else {
      console.warn('⚠️ No personas found in response');
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message);
    
    if (error.name === 'AbortError') {
      console.error('🕐 Request timed out');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('🌐 DNS resolution failed - check internet connection');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('🔒 Connection refused - check firewall/proxy settings');
    }
  }
}

// Run the test
testTavusAPI();
```

**Run the test:**
```bash
node test-tavus-api.js
```

## 2. Debug Tavus Agent Display Issues

### 2.1 Inspect Browser Console Logs

**Open Browser Developer Tools:**
1. Press F12 or right-click → Inspect
2. Go to Console tab
3. Look for JavaScript errors

**Common Error Patterns:**

```javascript
// ❌ TavusClient initialization error
Error: TavusClient is not defined
// Solution: Check if TavusClient is properly imported

// ❌ Missing environment variables
Error: TAVUS_API_KEY is undefined
// Solution: Verify .env file and restart dev server

// ❌ Network connectivity issues
TypeError: fetch failed
// Solution: Check internet connection and API endpoint

// ❌ CORS errors
Access to fetch at 'https://tavusapi.com' from origin 'http://localhost:3000' has been blocked by CORS policy
// Solution: Use server-side API routes instead of direct client calls
```

### 2.2 Verify Agent Initialization Code

**Check TavusClient Implementation:**
```javascript
// lib/tavusClient.ts - Verify this exists and is correct
import { TavusClient } from '@/lib/tavusClient';

// Check initialization
const tavus = new TavusClient();
console.log('Tavus client initialized:', tavus.isProperlyConfigured());

// Check configuration status
const config = tavus.getConfigurationStatus();
console.log('Tavus configuration:', config);
```

**Verify Component Integration:**
```javascript
// components/TavusVideoChat.tsx
useEffect(() => {
  console.log('🚀 Initializing Tavus session...');
  console.log('Demo ID:', demoId);
  console.log('Demo Data:', demoData);
  
  initializeTavusSession()
    .then(() => console.log('✅ Tavus session initialized'))
    .catch(error => console.error('❌ Tavus initialization failed:', error));
}, [demoId]);
```

### 2.3 Confirm Required Dependencies

**Check package.json:**
```json
{
  "dependencies": {
    "@tavus/react-sdk": "^1.0.0",
    "@tavus/node-sdk": "^1.0.0"
  }
}
```

**Install missing dependencies:**
```bash
npm install @tavus/react-sdk @tavus/node-sdk
# or
yarn add @tavus/react-sdk @tavus/node-sdk
```

**Verify imports:**
```javascript
// Check if these imports work without errors
import { TavusClient } from '@/lib/tavusClient';
import TavusVideoAvatar from '@/components/TavusVideoAvatar';
import TavusVideoChat from '@/components/TavusVideoChat';
```

### 2.4 Check Agent Container Element

**Verify DOM Structure:**
```javascript
// Check if container exists
const container = document.getElementById('tavus-container');
console.log('Tavus container found:', !!container);

// Check container dimensions
if (container) {
  const rect = container.getBoundingClientRect();
  console.log('Container dimensions:', {
    width: rect.width,
    height: rect.height,
    visible: rect.width > 0 && rect.height > 0
  });
}
```

**Common DOM Issues:**
```css
/* ❌ Container has no dimensions */
.tavus-container {
  width: 0;
  height: 0;
}

/* ✅ Proper container styling */
.tavus-container {
  width: 100%;
  height: 400px;
  min-height: 300px;
}
```

## 3. Comprehensive Debugging Checklist

### 3.1 Environment Setup
- [ ] TAVUS_API_KEY is set in .env file
- [ ] .env file is in project root
- [ ] Development server restarted after adding env vars
- [ ] API key format is correct (starts with tavus_api_key_)
- [ ] No extra spaces or quotes in env file

### 3.2 Network Connectivity
- [ ] Internet connection is working
- [ ] Can access https://tavusapi.com in browser
- [ ] No corporate firewall blocking API calls
- [ ] No proxy configuration issues
- [ ] DNS resolution working for tavusapi.com

### 3.3 Code Implementation
- [ ] TavusClient class exists in lib/tavusClient.ts
- [ ] All required imports are present
- [ ] No TypeScript compilation errors
- [ ] Component is properly mounted in DOM
- [ ] Event handlers are attached correctly

### 3.4 API Integration
- [ ] Using correct HTTP method (GET for /personas)
- [ ] Headers include x-api-key
- [ ] Content-Type is application/json
- [ ] Request timeout is reasonable (10-30 seconds)
- [ ] Error handling is implemented

## 4. Advanced Debugging Techniques

### 4.1 Network Traffic Analysis

**Using Browser DevTools:**
1. Open DevTools → Network tab
2. Filter by XHR/Fetch
3. Trigger Tavus API call
4. Check request/response details

**Look for:**
- Request URL is correct
- Headers are properly set
- Response status and body
- Timing information

### 4.2 Tavus Client Debug Mode

**Enable verbose logging:**
```javascript
// Add to TavusClient constructor
class TavusClient {
  constructor(apiKey, options = {}) {
    this.debug = options.debug || process.env.NODE_ENV === 'development';
    
    if (this.debug) {
      console.log('🔧 TavusClient Debug Mode Enabled');
      console.log('🔑 API Key:', apiKey ? 'Present' : 'Missing');
      console.log('🌍 Environment:', process.env.NODE_ENV);
    }
  }
  
  async makeRequest(endpoint, options = {}) {
    if (this.debug) {
      console.log('📡 Tavus API Request:', endpoint, options);
    }
    
    try {
      const response = await fetch(url, options);
      
      if (this.debug) {
        console.log('📡 Tavus API Response:', response.status, response.statusText);
      }
      
      return response;
    } catch (error) {
      if (this.debug) {
        console.error('❌ Tavus API Error:', error);
      }
      throw error;
    }
  }
}
```

### 4.3 Component State Debugging

**Add debug component:**
```javascript
// components/TavusDebugPanel.tsx
export function TavusDebugPanel({ tavusSession, isConnected, error }) {
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div className="fixed bottom-4 left-4 bg-black text-white p-4 rounded text-xs max-w-sm">
      <h4 className="font-bold mb-2">Tavus Debug Info</h4>
      <div>Connected: {isConnected ? '✅' : '❌'}</div>
      <div>Session ID: {tavusSession?.conversation_id || 'None'}</div>
      <div>Replica ID: {tavusSession?.replica_id || 'None'}</div>
      <div>Status: {tavusSession?.status || 'Unknown'}</div>
      {error && <div className="text-red-400">Error: {error}</div>}
    </div>
  );
}
```

## 5. Common Solutions

### 5.1 API Key Issues
```bash
# Regenerate API key in Tavus dashboard
# Update .env file
# Restart development server
npm run dev
```

### 5.2 CORS Issues
```javascript
// Use server-side API route instead of direct client calls
// pages/api/tavus/personas.js
export default async function handler(req, res) {
  const response = await fetch('https://tavusapi.com/v2/personas', {
    headers: {
      'x-api-key': process.env.TAVUS_API_KEY
    }
  });
  
  const data = await response.json();
  res.json(data);
}
```

### 5.3 Component Not Rendering
```javascript
// Check component mounting
useEffect(() => {
  console.log('Component mounted');
  return () => console.log('Component unmounted');
}, []);

// Check props
useEffect(() => {
  console.log('Props changed:', { demoId, demoData });
}, [demoId, demoData]);
```

## 6. Getting Help

If issues persist after following this guide:

1. **Check Tavus Documentation**: https://docs.tavusapi.com
2. **Contact Tavus Support**: support@tavus.io
3. **Check API Status**: https://status.tavusapi.com
4. **Review Rate Limits**: Ensure you're not exceeding API limits

## 7. Prevention Tips

1. **Always use environment variables** for API keys
2. **Implement proper error handling** for all API calls
3. **Add timeout handling** for network requests
4. **Use server-side API routes** to avoid CORS issues
5. **Monitor API usage** to stay within rate limits
6. **Keep dependencies updated** to latest stable versions

---

**Last Updated**: December 2024
**Version**: 1.0