const fs = require("node:fs");
const path = require("node:path");

const functionsDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(functionsDir, "..");
const sourceDir = path.join(projectRoot, "public", "quizzes");
const targetDir = path.join(functionsDir, "quizzes");

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Quiz source directory does not exist: ${sourceDir}`);
}

fs.mkdirSync(targetDir, { recursive: true });

const sourceFiles = fs.readdirSync(sourceDir).filter((file) => file.endsWith(".json"));
const syncedFiles = new Set();

sourceFiles.forEach((file) => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  fs.copyFileSync(sourcePath, targetPath);
  syncedFiles.add(file);
});

fs.readdirSync(targetDir)
  .filter((file) => file.endsWith(".json") && !syncedFiles.has(file))
  .forEach((file) => {
    fs.unlinkSync(path.join(targetDir, file));
  });

console.log(`Synced ${syncedFiles.size} quiz file(s) into functions/quizzes.`);
