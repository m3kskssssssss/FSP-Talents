/** Domain errors thrown by services and mapped to HTTP statuses by the route wrapper. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (msg = "Требуется вход") => new AppError(401, "unauthorized", msg);
export const forbidden = (msg = "Недостаточно прав") => new AppError(403, "forbidden", msg);
export const notFound = (msg = "Не найдено") => new AppError(404, "not_found", msg);
export const conflict = (msg: string, details?: unknown) => new AppError(409, "conflict", msg, details);
export const unprocessable = (msg: string, details?: unknown) =>
  new AppError(422, "validation_error", msg, details);
export const tooMany = (msg = "Слишком много запросов, попробуйте позже") =>
  new AppError(429, "rate_limited", msg);
