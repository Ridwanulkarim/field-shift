// One error type for "this request cannot be satisfied". The error handler in
// app.js turns it into the standard JSON shape:
//   { "error": { "code": "...", "message": "...", "details": [...] } }

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// 422: the request was well-formed JSON but its content is not acceptable.
// `details` is an array of { field, message }.
export function validationError(details) {
  return new HttpError(422, 'VALIDATION_ERROR', 'The request is not valid.', details);
}

// 404: something the request names does not exist.
export function notFound(code, message) {
  return new HttpError(404, code, message);
}

// 503: a needed dependency (the database) is not available.
export function unavailable(message) {
  return new HttpError(503, 'SERVICE_UNAVAILABLE', message);
}
