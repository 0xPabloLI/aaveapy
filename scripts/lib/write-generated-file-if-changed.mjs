import fs from 'fs';

export function writeGeneratedFileIfChanged(filePath, nextContent) {
  const currentContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (currentContent === nextContent) {
    return false;
  }

  fs.writeFileSync(filePath, nextContent, 'utf8');
  return true;
}
