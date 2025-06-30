#!/usr/bin/env node

/**
 * Tavus Client Debug Script
 * 
 * This script helps debug TavusClient integration issues in the browser environment.
 * Run with: node scripts/debug-tavus-client.js
 */

require('dotenv').config();

class TavusClientDebugger {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.suggestions = [];
  }

  log(level, message, data = null) {
    const prefix = {
      'info': '📋',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'debug': '🔧'
    }[level] || '📋';
    
    console.log(`${prefix} ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  addIssue(message) {
    this.issues.push(message);
    this.log('error', message);
  }

  addWarning(message) {
    this.warnings.push(message);
    this.log('warning', message);
  }

  addSuggestion(message) {
    this.suggestions.push(message);
    this.log('info', `💡 ${message}`);
  }

  checkFileExists(filePath) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const fullPath = path.resolve(filePath);
      return fs.existsSync(fullPath);
    } catch (error) {
      return false;
    }
  }

  checkFileContent(filePath, requiredContent) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const fullPath = path.resolve(filePath);
      const content = fs.readFileSync(fullPath, 'utf8');
      
      if (Array.isArray(requiredContent)) {
        return requiredContent.every(item => content.includes(item));
      }
      
      return content.includes(requiredContent);
    } catch (error) {
      return false;
    }
  }

  async checkEnvironmentVariables() {
    this.log('info', 'Checking Environment Variables...');
    
    const requiredVars = [
      'TAVUS_API_KEY',
      'NEXT_PUBLIC_TAVUS_API_KEY'
    ];
    
    let hasApiKey = false;
    
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        this.log('success', `${varName} is set`);
        hasApiKey = true;
      } else {
        this.log('warning', `${varName} is not set`);
      }
    });
    
    if (!hasApiKey) {
      this.addIssue('No Tavus API key found in environment variables');
      this.addSuggestion('Add TAVUS_API_KEY to your .env file');
    }
    
    // Check .env file exists
    if (!this.checkFileExists('.env')) {
      this.addWarning('.env file not found in project root');
      this.addSuggestion('Create a .env file with your Tavus API key');
    }
  }

  async checkProjectStructure() {
    this.log('info', 'Checking Project Structure...');
    
    const requiredFiles = [
      'lib/tavusClient.ts',
      'components/TavusVideoAvatar.tsx',
      'components/TavusVideoChat.tsx'
    ];
    
    requiredFiles.forEach(filePath => {
      if (this.checkFileExists(filePath)) {
        this.log('success', `${filePath} exists`);
      } else {
        this.addIssue(`Missing required file: ${filePath}`);
      }
    });
    
    // Check package.json for dependencies
    if (this.checkFileExists('package.json')) {
      const packageJson = require('../package.json');
      
      const recommendedDeps = [
        '@tavus/react-sdk',
        '@tavus/node-sdk'
      ];
      
      recommendedDeps.forEach(dep => {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          this.log('success', `${dep} is installed`);
        } else {
          this.addWarning(`Recommended dependency ${dep} is not installed`);
          this.addSuggestion(`Install with: npm install ${dep}`);
        }
      });
    }
  }

  async checkTavusClientImplementation() {
    this.log('info', 'Checking TavusClient Implementation...');
    
    const tavusClientPath = 'lib/tavusClient.ts';
    
    if (!this.checkFileExists(tavusClientPath)) {
      this.addIssue('TavusClient file not found');
      return;
    }
    
    const requiredMethods = [
      'class TavusClient',
      'getPersonas',
      'getReplicas',
      'createConversation',
      'sendMessage'
    ];
    
    requiredMethods.forEach(method => {
      if (this.checkFileContent(tavusClientPath, method)) {
        this.log('success', `TavusClient has ${method}`);
      } else {
        this.addWarning(`TavusClient missing ${method}`);
      }
    });
    
    // Check for proper error handling
    const errorHandlingPatterns = [
      'try {',
      'catch',
      'throw new Error'
    ];
    
    if (this.checkFileContent(tavusClientPath, errorHandlingPatterns)) {
      this.log('success', 'TavusClient has error handling');
    } else {
      this.addWarning('TavusClient may lack proper error handling');
    }
  }

  async checkComponentImplementation() {
    this.log('info', 'Checking Component Implementation...');
    
    const components = [
      {
        path: 'components/TavusVideoAvatar.tsx',
        requiredElements: [
          'useEffect',
          'useState',
          'TavusClient',
          'conversationId',
          'replicaId'
        ]
      },
      {
        path: 'components/TavusVideoChat.tsx',
        requiredElements: [
          'TavusVideoAvatar',
          'initializeTavusSession',
          'sendMessage',
          'handleAIAction'
        ]
      }
    ];
    
    components.forEach(({ path, requiredElements }) => {
      if (!this.checkFileExists(path)) {
        this.addIssue(`Component file not found: ${path}`);
        return;
      }
      
      requiredElements.forEach(element => {
        if (this.checkFileContent(path, element)) {
          this.log('success', `${path} has ${element}`);
        } else {
          this.addWarning(`${path} missing ${element}`);
        }
      });
    });
  }

  async checkAPIRoutes() {
    this.log('info', 'Checking API Routes...');
    
    const apiRoutes = [
      'app/api/tavus/create-session/route.ts',
      'app/api/tavus/webhook/route.ts'
    ];
    
    apiRoutes.forEach(route => {
      if (this.checkFileExists(route)) {
        this.log('success', `API route exists: ${route}`);
        
        // Check for proper exports
        if (this.checkFileContent(route, ['export async function POST', 'NextResponse'])) {
          this.log('success', `${route} has proper Next.js API structure`);
        } else {
          this.addWarning(`${route} may have incorrect API structure`);
        }
      } else {
        this.addWarning(`API route not found: ${route}`);
      }
    });
  }

  async checkCommonIssues() {
    this.log('info', 'Checking for Common Issues...');
    
    // Check for CORS issues
    const corsPatterns = [
      'Access-Control-Allow-Origin',
      'CORS',
      'cors'
    ];
    
    let hasCorsHandling = false;
    
    ['app/api/tavus/create-session/route.ts', 'app/api/tavus/webhook/route.ts'].forEach(file => {
      if (this.checkFileExists(file) && this.checkFileContent(file, corsPatterns)) {
        hasCorsHandling = true;
      }
    });
    
    if (hasCorsHandling) {
      this.log('success', 'CORS handling detected in API routes');
    } else {
      this.addWarning('No CORS handling detected - may cause browser issues');
      this.addSuggestion('Add CORS headers to API routes');
    }
    
    // Check for proper TypeScript types
    const typeFiles = [
      'lib/tavusClient.ts',
      'components/TavusVideoAvatar.tsx',
      'components/TavusVideoChat.tsx'
    ];
    
    typeFiles.forEach(file => {
      if (this.checkFileExists(file)) {
        if (this.checkFileContent(file, ['interface ', 'type '])) {
          this.log('success', `${file} has TypeScript types`);
        } else {
          this.addWarning(`${file} may lack proper TypeScript types`);
        }
      }
    });
  }

  generateBrowserDebugScript() {
    return `
// Tavus Browser Debug Script
// Paste this into your browser console on the demo page

console.log('🔧 Starting Tavus Browser Debug...');

// Check if TavusClient is available
if (typeof window.TavusClient !== 'undefined') {
  console.log('✅ TavusClient is available globally');
} else {
  console.log('❌ TavusClient not found globally');
}

// Check for Tavus-related elements in DOM
const tavusElements = document.querySelectorAll('[class*="tavus"], [id*="tavus"]');
console.log(\`📋 Found \${tavusElements.length} Tavus-related DOM elements\`);

tavusElements.forEach((el, index) => {
  console.log(\`  \${index + 1}. \${el.tagName} - \${el.className || el.id}\`);
  
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.log(\`    ⚠️ Element has no dimensions: \${rect.width}x\${rect.height}\`);
  } else {
    console.log(\`    ✅ Element dimensions: \${rect.width}x\${rect.height}\`);
  }
});

// Check for React components
if (typeof React !== 'undefined') {
  console.log('✅ React is available');
} else {
  console.log('❌ React not found');
}

// Check for environment variables
const envVars = ['NEXT_PUBLIC_TAVUS_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL'];
envVars.forEach(varName => {
  if (process?.env?.[varName]) {
    console.log(\`✅ \${varName} is available\`);
  } else {
    console.log(\`❌ \${varName} not found\`);
  }
});

// Check for network errors
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('📡 Fetch request:', args[0]);
  return originalFetch.apply(this, args)
    .then(response => {
      console.log(\`📡 Fetch response: \${response.status} \${response.statusText}\`);
      return response;
    })
    .catch(error => {
      console.error('📡 Fetch error:', error);
      throw error;
    });
};

console.log('🔧 Tavus Browser Debug setup complete. Watch for fetch requests and check elements above.');
`;
  }

  async runAllChecks() {
    console.log('\n🔧 Starting Tavus Client Debug Checks...\n');
    
    await this.checkEnvironmentVariables();
    await this.checkProjectStructure();
    await this.checkTavusClientImplementation();
    await this.checkComponentImplementation();
    await this.checkAPIRoutes();
    await this.checkCommonIssues();
    
    // Generate summary
    console.log('\n📊 Debug Summary:');
    console.log('=================');
    
    if (this.issues.length > 0) {
      console.log('\n❌ Critical Issues Found:');
      this.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }
    
    if (this.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      this.suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`);
      });
    }
    
    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('\n🎉 No critical issues found! Your Tavus integration looks good.');
    }
    
    // Browser debug script
    console.log('\n🌐 Browser Debug Script:');
    console.log('Copy and paste this into your browser console:');
    console.log('```javascript');
    console.log(this.generateBrowserDebugScript());
    console.log('```');
    
    console.log('\n📚 For more help, see: docs/TAVUS_TROUBLESHOOTING.md\n');
  }
}

// Run checks if called directly
if (require.main === module) {
  const debugger = new TavusClientDebugger();
  debugger.runAllChecks().catch(console.error);
}

module.exports = TavusClientDebugger;