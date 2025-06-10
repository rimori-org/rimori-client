import * as fs from 'fs';
import * as path from 'path';

/**
 * Updates the vite.config.ts file to set the base property.
 * @param param
 * @param param.basePath - The base path to set in vite config (defaults to './')
 * @param param.configPath - Path to the vite.config.ts file (defaults to './vite.config.ts')
 * @throws {Error} if vite.config.ts file is not found or cannot be modified.
 */
export function updateViteConfigBase({
  basePath = './',
  configPath = './vite.config.ts'
}: {
  basePath?: string;
  configPath?: string;
} = {}): void {
  const viteConfigPath = path.resolve(configPath);

  if (!fs.existsSync(viteConfigPath)) {
    throw new Error(`vite.config.ts not found at ${viteConfigPath}`);
  }

  let configContent = fs.readFileSync(viteConfigPath, 'utf8');

  // Check if base property already exists
  const baseRegex = /base:\s*['"][^'"]*['"],?\s*/;
  const hasBase = baseRegex.test(configContent);

  if (hasBase) {
    // Update existing base property
    configContent = configContent.replace(baseRegex, `base: '${basePath}',`);
    console.log(`Updated existing base property in vite.config.ts to '${basePath}'`);
  } else {
    // Add base property before server config
    const serverRegex = /(\s*)(server:\s*\{)/;
    const serverMatch = configContent.match(serverRegex);

    if (serverMatch) {
      const indentation = serverMatch[1] || '  '; // Use existing indentation or default to 2 spaces
      const replacement = `${indentation}base: '${basePath}',${indentation}${serverMatch[2]}`;
      configContent = configContent.replace(serverRegex, replacement);
      console.log(`Added base property to vite.config.ts with value '${basePath}'`);
    } else {
      throw new Error('Could not find server config in vite.config.ts to add base property before it');
    }
  }

  fs.writeFileSync(viteConfigPath, configContent, 'utf8');
}

/**
 * Reads the current base value from vite.config.ts.
 * @param param
 * @param param.configPath - Path to the vite.config.ts file (defaults to './vite.config.ts')
 * @returns The current base value or null if not found.
 */
export function getCurrentViteBase({
  configPath = './vite.config.ts'
}: {
  configPath?: string;
} = {}): string | null {
  const viteConfigPath = path.resolve(configPath);

  if (!fs.existsSync(viteConfigPath)) {
    return null;
  }

  const configContent = fs.readFileSync(viteConfigPath, 'utf8');
  const baseMatch = configContent.match(/base:\s*['"]([^'"]*)['"]/);

  return baseMatch ? baseMatch[1] : null;
} 