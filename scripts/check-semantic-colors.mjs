import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks = [
  {
    file: "src/components/ThemeToggle.tsx",
    disallowed: ["text-gray-", "bg-gray-", "border-gray-", "text-zinc-", "bg-zinc-", "border-zinc-"],
  },
  {
    file: "src/pages/Index.tsx",
    disallowed: ["text-gray-", "bg-gray-", "border-gray-", "text-zinc-", "bg-zinc-", "border-zinc-"],
  },
];

const errors = [];

for (const check of checks) {
  const fullPath = resolve(process.cwd(), check.file);
  const content = readFileSync(fullPath, "utf8");

  for (const token of check.disallowed) {
    if (content.includes(token)) {
      errors.push(`${check.file} contains disallowed color token "${token}". Use semantic theme tokens instead.`);
    }
  }
}

if (errors.length > 0) {
  console.error("Semantic color guard failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Semantic color guard passed.");
