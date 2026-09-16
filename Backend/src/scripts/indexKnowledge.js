// Run with: npm run knowledge:index
require("dotenv").config();

const pool = require("../config/database");
const { indexAllKnowledge } = require("../services/knowledgeBaseService");

indexAllKnowledge()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("Knowledge indexing failed:", error);
    await pool.end();
    process.exit(1);
  });
