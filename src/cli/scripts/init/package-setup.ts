import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface PackageJson {
  name?: string;
  r_id?: string;
  scripts: {
    dev?: string;
    [key: string]: string | undefined;
  };
  dependencies?: {
    [key: string]: string;
  };
  [key: string]: any;
}

export interface PackageSetupParams {
  pluginId?: string;
  port?: number;
  isUpgrade?: boolean;
}

/**
 * Gets the current version of @rimori/client from its package.json.
 * @returns The current version string with caret prefix.
 * @throws {Error} if rimori-client package.json cannot be read.
 */
export function getRimoriClientVersion(): string {
  try {
    // Get the path to rimori-client package.json relative to this script
    // From dist/cli/scripts/init/ we need to go up 4 levels to reach the root
    const rimoriClientPackageJsonPath = path.resolve(__dirname, '../../../../package.json');
    const rimoriClientPackageJson = JSON.parse(fs.readFileSync(rimoriClientPackageJsonPath, 'utf8'));
    return `^${rimoriClientPackageJson.version}`;
  } catch (error) {
    throw new Error(`Failed to read rimori-client version: ${error}`);
  }
}

/**
 * Updates the plugin's package.json with necessary configuration.
 * @param param
 * @param param.pluginId - The unique plugin identifier (optional for upgrade mode).
 * @param param.port - The development port for the plugin (optional).
 * @param param.isUpgrade - Whether this is an upgrade operation.
 * @throws {Error} if plugin directory doesn't exist or package.json is missing.
 */
export function updatePackageJson({
  pluginId,
  port,
  isUpgrade = false,
}: PackageSetupParams): void {
  // Get the plugin repo name from the current directory
  const pluginRepoName = path.basename(process.cwd());
  console.log(`Setting up plugin: ${pluginRepoName}`);
  if (pluginId) {
    console.log(`Plugin ID: ${pluginId}`);
  }
  if (port) {
    console.log(`Port: ${port}`);
  }

  // Check if package.json exists in plugin directory
  const packageJsonPath = path.resolve('./package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found! Are you in the root directory of the plugin?`);
  }

  // Read and parse the existing package.json
  let packageJson: PackageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read or parse package.json: ${error}`);
  }

  console.log('Updating package.json...');
  console.log('pluginId', pluginId);

  // Get the current rimori-client version
  const rimoriClientVersion = getRimoriClientVersion();

  // Update the package.json object
  packageJson.name = pluginRepoName;
  if (pluginId) {
    packageJson.r_id = pluginId;
  }
  packageJson.scripts = {
    ...packageJson.scripts,
    "dev": `vite --port ${port || 3000}`,
    "build": "yarn run check && vite build",
    "check": "tsc --project tsconfig.app.json --noEmit --pretty",
    "release:alpha": "yarn build && yarn rimori-release alpha",
    "release:beta": "yarn build && yarn rimori-release beta",
    "release:stable": "yarn build && yarn rimori-release stable",
    "dev:worker": "VITE_MINIFY=false vite build --watch --config worker/vite.config.ts",
    "build:worker": "vite build --config worker/vite.config.ts",
  };
  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@rimori/client": rimoriClientVersion,
  };

  // Write the updated package.json back to file
  try {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('✅ Successfully updated package.json');
  } catch (error) {
    throw new Error(`Failed to update package.json: ${error}`);
  }
} 