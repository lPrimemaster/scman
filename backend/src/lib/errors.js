export class HttpError extends Error {
	constructor(statusCode, message, details) {
		super(message);
		this.statusCode = statusCode;
		// Extra fields sent along with the error message
		this.details = details;
	}
}

export const badRequest = (msg = 'Invalid request.') => new HttpError(400, msg);
export const forbidden = (msg = 'Forbidden.') => new HttpError(403, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);
export const conflict = (msg, details) => new HttpError(409, msg, details);
