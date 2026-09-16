// Import Node.js File System module.
// It is used to read files and folders.
const fs = require("fs");

// Import Node.js Path module.
// It helps create safe file/folder paths.
const path = require("path");

// Import PostgreSQL database connection/pool.
const pool = require("../config/database");


// ============================================================
// MIGRATION FUNCTION
// ============================================================

// This function runs all SQL migration files.
async function migrate() {

  // Create the path to the migrations folder.
  //
  // __dirname = current folder where this JS file exists.
  //
  // Example:
  // Backend/db/runMigrations.js
  //
  // Then this creates:
  // Backend/db/migrations
  const dir = path.join(__dirname, "migrations");


  // Read all files from the migrations folder.
  //
  // filter() keeps only files ending with .sql
  //
  // sort() sorts migration files by filename.
  //
  // Example:
  // 001_create_users.sql
  // 002_create_organizations.sql
  // 003_create_projects.sql
  // 004_create_tasks.sql
  //
  // They will run in this order.
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();


  // Loop through every migration file.
  for (const file of files) {

    // Read the SQL file as text.
    //
    // Example:
    // "CREATE TABLE users (...)"
    const sql = fs.readFileSync(
      path.join(dir, file),
      "utf8"
    );


    // Show which migration is currently running.
    console.log(`Running ${file}...`);


    // Send the SQL code to PostgreSQL.
    //
    // PostgreSQL executes whatever SQL
    // is written inside the migration file.
    await pool.query(sql);
  }


  // All migration files have completed successfully.
  console.log("Database migration completed.");


  // Close the PostgreSQL connection pool.
  await pool.end();
}


// ============================================================
// RUN MIGRATION
// ============================================================

// Start the migrate() function.
//
// If any error happens,
// catch() will handle that error.
migrate().catch(async (error) => {

  // Show migration error in terminal.
  console.error("Migration failed:", error);


  // Close database connection.
  await pool.end();


  // Exit Node.js with error code 1.
  //
  // 0 = success
  // 1 = error
  process.exit(1);
});