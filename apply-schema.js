// Script to apply Tavus Sessions schema to Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

// Create Supabase client with service role key for full admin access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Read the SQL file
const sql = fs.readFileSync(path.join(__dirname, 'apply-tavus-schema.sql'), 'utf8');

async function applySchema() {
  console.log('Applying tavus_sessions schema...');
  
  try {
    // Split SQL into individual statements
    const statements = sql
      .replace(/\r\n/g, '\n')
      .split(';')
      .filter(statement => statement.trim() !== '');
      
    // Execute each statement separately
    for (const statement of statements) {
      console.log(`Executing statement: ${statement.substring(0, 50)}...`);
      
      const { data, error } = await supabase.rpc('pgmoon.query', {
        query: statement.trim() + ';'
      });
      
      if (error) {
        console.error(`Error executing statement: ${error.message}`);
        
        // Attempt direct query as fallback
        const { error: directError } = await supabase.from('_postgres').rpc('query', {
          query_text: statement.trim() + ';' 
        });
        
        if (directError) {
          // Try one more approach using the REST API directly
          const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              sql: statement.trim() + ';'
            })
          });
          
          if (!response.ok) {
            console.error(`Failed to execute statement via REST API: ${response.statusText}`);
          } else {
            console.log('Statement executed via REST API');
          }
        }
      } else {
        console.log('Statement executed successfully');
      }
    }
    
    console.log('Schema application completed');
  } catch (error) {
    console.error('Failed to apply schema:', error);
  }
}

// Run the schema application
applySchema();
