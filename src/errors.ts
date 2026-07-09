class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

function invariant(condition: unknown, message: string, exitCode = 1): asserts condition {
  if (!condition) {
    throw new CliError(message, exitCode);
  }
}

module.exports = { CliError, invariant };
