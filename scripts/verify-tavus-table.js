// Script to verify the tavus_sessions table in Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with admin credentials
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyTavusSessionsTable() {
  console.log('=== Verifying tavus_sessions table ===');
  
  try {
    // First approach: Try to get the structure via introspection
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_definition', { table_name: 'tavus_sessions' })
      .single();
    
    if (tableError && tableError.message !== 'No rows returned') {
      console.log('Error fetching table definition via RPC:', tableError.message);
      console.log('Trying alternative method...');
    } else if (tableInfo) {
      console.log('✅ Table exists with structure:');
      console.log(tableInfo);
    }
    
    // Second approach: Just query the table to see if it exists
    const { data, error } = await supabase
      .from('tavus_sessions')
      .select('id, demo_id, tavus_conversation_id')
      .limit(5);
    
    if (error) {
      console.error('❌ Error querying tavus_sessions table:', error.message);
      if (error.code === 'PGRST104') {
        console.error('The table does not exist in the database');
      }
      return false;
    }
    
    console.log('✅ tavus_sessions table exists and is queryable');
    console.log(`Retrieved ${data.length} session records`);
    
    // Check if table has the expected columns
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'tavus_sessions');
      
    if (columnsError) {
      console.error('❌ Error fetching column information:', columnsError.message);
    } else {
      console.log('✅ Table has the following columns:');
      columns.forEach(col => {
        console.log(`- ${col.column_name} (${col.data_type})`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

// Execute the verification
verifyTavusSessionsTable()
  .then(success => {
    if (success) {
      console.log('\n✅ tavus_sessions table is ready for use');
    } else {
      console.log('\n❌ Issues found with tavus_sessions table');
    }
  });
