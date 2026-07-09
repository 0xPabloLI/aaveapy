import { writeOpenApiDocument, OUTPUT_FILE } from './generate-openapi.ts';

writeOpenApiDocument();
console.log(`Generated ${OUTPUT_FILE}`);
