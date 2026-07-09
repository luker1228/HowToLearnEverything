const {
  goalInit,
  goalShow,
  pointAdd,
  pointList,
  pointShow,
  rebuildIndex,
  reviewCheck,
  reviewDone,
  stats,
  studyDone,
  studyStart,
  validateGoal,
} = require("./learn.ts") as typeof import("./learn");
const { CliError } = require("./errors.ts") as typeof import("./errors");

type ParsedArgs = {
  positionals: string[];
  options: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }

  return { positionals, options };
}

function requireOption(options: Record<string, string | boolean>, key: string): string {
  const value = options[key];
  if (typeof value !== "string") {
    throw new CliError(`--${key} is required`, 2);
  }
  return value;
}

function printHelp(): void {
  console.log(`learn

Usage:
  learn goal init <goal>
  learn goal show <goal>
  learn point add <goal> <path>
  learn point list <goal> [--domain <domain>] [--status <status>]
  learn point show <goal> <pointId>
  learn study start <goal> <pointId>
  learn study done <goal> <pointId> --mastery <0-5>
  learn review check <goal>
  learn review done <goal> <pointId> --grade again|hard|good|easy [--note <text>]
  learn index rebuild <goal>
  learn validate <goal>
  learn stats <goal>
`);
}

function main() {
  const argv = process.argv.slice(2);
  const { positionals, options } = parseArgs(argv);

  if (positionals.length === 0 || options.help || positionals[0] === "--help") {
    printHelp();
    return;
  }

  const [command, action, arg1, arg2] = positionals;

  if (command === "goal" && action === "init" && arg1) {
    goalInit(arg1);
    return;
  }
  if (command === "goal" && action === "show" && arg1) {
    goalShow(arg1);
    return;
  }
  if (command === "point" && action === "add" && arg1 && arg2) {
    pointAdd(arg1, arg2);
    return;
  }
  if (command === "point" && action === "list" && arg1) {
    pointList(arg1, {
      domain: typeof options.domain === "string" ? options.domain : undefined,
      status: typeof options.status === "string" ? options.status : undefined,
    });
    return;
  }
  if (command === "point" && action === "show" && arg1 && arg2) {
    pointShow(arg1, arg2);
    return;
  }
  if (command === "study" && action === "start" && arg1 && arg2) {
    studyStart(arg1, arg2);
    return;
  }
  if (command === "study" && action === "done" && arg1 && arg2) {
    const mastery = Number(requireOption(options, "mastery"));
    if (!Number.isInteger(mastery)) {
      throw new CliError("--mastery must be an integer", 2);
    }
    studyDone(arg1, arg2, mastery);
    return;
  }
  if (command === "review" && action === "check" && arg1) {
    reviewCheck(arg1);
    return;
  }
  if (command === "review" && action === "done" && arg1 && arg2) {
    const grade = requireOption(options, "grade");
    if (grade !== "again" && grade !== "hard" && grade !== "good" && grade !== "easy") {
      throw new CliError("--grade must be again|hard|good|easy", 2);
    }
    reviewDone(arg1, arg2, grade, typeof options.note === "string" ? options.note : undefined);
    return;
  }
  if (command === "index" && action === "rebuild" && arg1) {
    rebuildIndex(arg1);
    return;
  }
  if (command === "validate" && action) {
    validateGoal(action);
    return;
  }
  if (command === "stats" && action) {
    stats(action);
    return;
  }

  throw new CliError("invalid command. run `learn --help`", 2);
}

try {
  main();
} catch (error) {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  throw error;
}
