// ======================================================
// SUCCESS RESPONSE - 200 OK
// ======================================================

// This function is used when the request is successful.
//
// 200 means:
// "The request was successful."
//
// res     → Express response object
// data    → Data we want to send to frontend
// message → Success message
function ok(res, data, message = "Success") {

  // Send HTTP status 200.
  //
  // json() sends a JSON response to the frontend.
  return res.status(200).json({
    success: true,
    data,
    message
  });
}


// ======================================================
// CREATED RESPONSE - 201 CREATED
// ======================================================

// This function is used when something new
// has been successfully created.
//
// Example:
// Creating a new user
// Creating a new organization
// Creating a new project
//
// 201 means:
// "A new resource was successfully created."
function created(res, data, message = "Created successfully") {

  // Send HTTP status 201.
  //
  // Return the newly created data
  // along with a success message.
  return res.status(201).json({
    success: true,
    data,
    message
  });
}


// ======================================================
// ERROR RESPONSE
// ======================================================

// This function is used when something goes wrong.
//
// status  → HTTP error status code
// message → Error message to send to frontend
//
// Examples:
// 400 → Bad Request
// 401 → Authentication required
// 403 → Permission denied
// 404 → Not Found
// 500 → Server Error
function fail(res, status, message) {

  // Send the provided error status
  // and error message to the frontend.
  return res.status(status).json({
    success: false,
    message
  });
}


// ======================================================
// EXPORT FUNCTIONS
// ======================================================

// Export these functions so they can be used
// in other files, such as controllers.
module.exports = {
  ok,
  created,
  fail
};