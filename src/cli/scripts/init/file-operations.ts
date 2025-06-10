import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration mapping source files to destination files.
 * Key: Source path relative to __dirname
 * Value: Destination path relative to current working directory
 */
const FILE_COPY_MAP: Record<string, string> = {
  '../../../../example/rimori.config.ts': './rimori/rimori.config.ts',
  '../../../../README.md': './rimori/readme.md',
};

/**
 * Copies necessary files and creates directories for the plugin setup.
 */
export function copyPluginFiles(): void {
  console.log('Copying plugin files...');

  for (const [srcRelativePath, destRelativePath] of Object.entries(FILE_COPY_MAP)) {
    const srcPath = path.resolve(__dirname, srcRelativePath);
    const destPath = path.resolve(destRelativePath);
    const destDir = path.dirname(destPath);

    // Check if source file exists
    if (!fs.existsSync(srcPath)) {
      console.log(`Warning: Source file not found: ${srcPath}`);
      continue;
    }

    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
      console.log(`Creating directory: ${destDir}`);
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Only copy if destination file doesn't exist
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${srcRelativePath} -> ${destRelativePath}`);
    } else {
      console.log(`File already exists, skipping: ${destRelativePath}`);
    }
  }

  console.log('Plugin file copying completed.');
} 