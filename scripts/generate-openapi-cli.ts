import { writeOpenApiDocument, OUTPUT_FILE } from './generate-openapi.ts';

try {
  writeOpenApiDocument();
  console.log(`Generated ${OUTPUT_FILE}`);
} catch (err) {
  console.error(`Failed to generate ${OUTPUT_FILE}:`, err);
  process.exit(1);
}
