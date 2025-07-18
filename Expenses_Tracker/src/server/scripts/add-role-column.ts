/**
 * Script to add role column to users table using direct SQL
 */

import { Client } from 'pg';

async function addRoleColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Check if role column already exists
    console.log('🔍 Checking if role column exists...');
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role';
    `;
    
    const checkResult = await client.query(checkColumnQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Role column already exists');
      return;
    }

    // Add role column with default value
    console.log('➕ Adding role column to users table...');
    const alterTableQuery = `
      ALTER TABLE users 
      ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user';
    `;
    
    await client.query(alterTableQuery);
    console.log('✅ Role column added successfully');

    // Verify the column was added
    console.log('🔍 Verifying column was added...');
    const verifyResult = await client.query(checkColumnQuery);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful - role column exists');
    } else {
      console.log('❌ Verification failed - role column not found');
    }

    // Show current table structure
    console.log('📋 Current users table structure:');
    const describeQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;
    
    const describeResult = await client.query(describeQuery);
    console.table(describeResult.rows);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
addRoleColumn()
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });