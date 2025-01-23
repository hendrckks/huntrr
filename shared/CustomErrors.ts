export class CustomError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "CustomError";
  }
}

export class ValidationError extends CustomError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string) {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class PermissionError extends CustomError {
  constructor(message: string) {
    super("PERMISSION_DENIED", message);
    this.name = "PermissionError";
  }
}
