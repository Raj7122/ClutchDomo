// Direct schema application using Supabase's REST API and fetch
require('dotenv').config();
const fs = require('fs');

// Read SQL schema
const schemaSQL = fs.readFileSync('./apply-tavus-schema.sql', 'utf8');

// Function to execute SQL against Supabase
async function executeSQLOnSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    process.exit(1);
  }

  try {
    // Split SQL into individual statements for better error handling
    const statements = schemaSQL
      .replace(/\r\n/g, '\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    // Execute each statement separately
    for (const sql of statements) {
      console.log(`\nExecuting: ${sql.substring(0, 60)}...`);
      
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'params=single-object'
        },
        body: JSON.stringify({
          command: 'RAW',
          sql: sql + ';'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error executing SQL (${response.status}): ${errorText}`);
        
        // If it's a table already exists error, we can continue
        if (errorText.includes('already exists')) {
          console.log('Table already exists, continuing...');
          continue;
        }
      } else {
        const result = await response.json();
        console.log('Success:', result);
      }
    }
    
    console.log('\nSchema application complete!');
    console.log('The tavus_sessions table should now be available');
  } catch (error) {
    console.error('Failed to execute SQL:', error);
  }
}

// Execute the SQL
executeSQLOnSupabase();
