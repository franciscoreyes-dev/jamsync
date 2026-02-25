export class AppError extends Error {
  constructor(public readonly code: string, public readonly statusCode: number) {
    super(code);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
