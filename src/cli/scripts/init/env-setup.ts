import * as fs from 'fs';
import * as path from 'path';

/**
 * Creates or updates the .env file with the plugin token.
 * @param token - The plugin authentication token.
 */
export function setupEnvFile(token: string): void {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    const envContent = `RIMORI_TOKEN=${token}\n`;
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('Created .env file with RIMORI_TOKEN');
  } else {
    console.log('.env file already exists, skipping creation');
  }
}

/**
 * Updates .gitignore to exclude .env files.
 */
export function updateGitignore(): void {
  const gitignorePath = path.resolve('.gitignore');
  let gitignoreContent = '';
  let needsUpdate = false;

  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    // Check if .env is already in .gitignore
    if (!gitignoreContent.includes('.env')) {
      needsUpdate = true;
    }
  } else {
    needsUpdate = true;
  }

  if (needsUpdate) {
    gitignoreContent += '\n.env\npublic/web-worker.js\n';
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
    console.log('Added .env to .gitignore');
  } else {
    console.log('.env already in .gitignore, skipping update');
  }
}
