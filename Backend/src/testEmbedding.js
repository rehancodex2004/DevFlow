require("dotenv").config();

const {
  createEmbedding
} = require("./services/embeddingService");

async function test() {
  try {

    console.log("================================");
    console.log("EMBEDDING TEST");
    console.log("================================");

    const text =
      "CMS project task management system";

    console.log("Input:");
    console.log(text);

    const embedding =
      await createEmbedding(text);

    console.log("");
    console.log("SUCCESS!");
    console.log(
      "Total numbers:",
      embedding.length
    );

    console.log(
      "First 10 values:"
    );

    console.log(
      embedding.slice(0, 10)
    );

  } catch (error) {

    console.error("");
    console.error(
      "EMBEDDING TEST FAILED"
    );

    console.error(
      error.message
    );
  }
}

test();