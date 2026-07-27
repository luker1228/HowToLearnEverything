import { runLesson01 } from "./lessons/step1/01-types.ts";
import { runLesson02 } from "./lessons/step1/02-agent-loop.ts";
import { runLesson03 } from "./lessons/step1/03-tool-use.ts";
import { runLesson04 } from "./lessons/step1/04-permission.ts";

async function main() {
  console.log("TypeScript + Node.js learning workspace");
  console.log("Run `npm run lesson:01` for TypeScript basics.");
  console.log("Run `npm run lesson:02` for the s01 Agent Loop lesson.");
  console.log("Run `npm run lesson:03` for the s02 Tool Use lesson.");
  console.log("Run `npm run lesson:04` for the s03 Permission lesson.");
  console.log("");
  runLesson01();
  console.log("");
  await runLesson02();
  console.log("");
  await runLesson03();
  console.log("");
  await runLesson04();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
