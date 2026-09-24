const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const { Pool } = require("pg");

const requiredDatabaseVariables = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
const missingDatabaseVariables = requiredDatabaseVariables.filter(
  (variable) => !process.env[variable],
);

if (missingDatabaseVariables.length) {
  throw new Error(
    `Missing database environment variables: ${missingDatabaseVariables.join(", ")}. ` +
    "Create Backend/.env from Backend/.env.example.",
  );
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

module.exports = pool;