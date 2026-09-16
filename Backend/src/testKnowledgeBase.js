const {
  indexOrganization,
  indexProject,
  indexTask
} = require("./services/knowledgeBaseService");


async function test() {

  try {

    console.log("================================");
    console.log("KNOWLEDGE BASE TEST");
    console.log("================================");


    // Change these IDs to records
    // that actually exist in your CMS.

    const organizationId = 5;
    const projectId = 4;
    const taskId = 6;


    console.log(
      "Indexing organization..."
    );

    await indexOrganization(
      organizationId
    );


    console.log(
      "Organization indexed."
    );


    console.log(
      "Indexing project..."
    );

    await indexProject(
      projectId
    );


    console.log(
      "Project indexed."
    );


    console.log(
      "Indexing task..."
    );

    await indexTask(
      taskId
    );


    console.log(
      "Task indexed."
    );


    console.log("================================");
    console.log("SUCCESS");
    console.log("================================");

    process.exit(0);

  } catch (error) {

    console.error(
      "Knowledge base test failed:"
    );

    console.error(error);

    process.exit(1);
  }
}


test();