#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import { DEFAULT_ANON_KEY, DEFAULT_ENDPOINT } from '../../../utils/endpoint.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PluginSetupParams {
  pluginId?: string;
  token?: string;
  port?: number;
  isUpgrade?: boolean;
}

interface PackageJson {
  name?: string;
  r_id?: string;
  scripts: {
    dev?: string;
    [key: string]: string | undefined;
  };
  [key: string]: any;
}

interface DeveloperRegisterResponse {
  plugin_id: string;
  access_token: string;
}

interface UserCredentials {
  email: string;
  password: string;
}

/**
 * Prompts user for email and password credentials.
 * @returns Promise resolving to user credentials.
 */
async function askForCredentials(): Promise<UserCredentials> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter your email: ', (email) => {
      rl.question('Enter your password: ', (password) => {
        rl.close();
        resolve({ email: email.trim(), password: password.trim() });
      });
    });
  });
}

/**
 * Authenticates with Supabase using email and password.
 * @param param
 * @param param.email - User email address.
 * @param param.password - User password.
 * @returns Promise resolving to JWT access token.
 * @throws {Error} if authentication fails.
 */
async function authenticateWithSupabase({
  email,
  password,
}: UserCredentials): Promise<string> {
  console.log('🔐 Authenticating with Supabase...');

  // Initialize Supabase client (you may need to adjust the URL and key)
  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_ENDPOINT;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!data.session?.access_token) {
      throw new Error('No access token received from authentication');
    }

    console.log('✅ Supabase authentication successful!');
    return data.session.access_token;
  } catch (error) {
    throw new Error(`Supabase authentication failed: ${error}`);
  }
}

/**
 * Registers developer and gets plugin credentials from the backend.
 * @param jwtToken - JWT token from Supabase authentication.
 * @param port - Development port for the plugin.
 * @returns Promise resolving to plugin ID and access token.
 * @throws {Error} if registration request fails.
 */
async function registerDeveloper(jwtToken: string, port: number): Promise<DeveloperRegisterResponse> {
  console.log('🚀 Registering developer and creating plugin...');

  try {
    console.log('port', port, typeof port);
    const response = await fetch('http://localhost:2800/developer/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({ port }),
    });

    if (!response.ok) {
      console.error(await response.text());
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: DeveloperRegisterResponse = await response.json();

    if (!data.plugin_id || !data.access_token) {
      throw new Error('Invalid response: missing pluginId or access_token');
    }

    console.log('✅ Plugin registration successful!');
    console.log(`Plugin ID: ${data.plugin_id}`);

    return data;
  } catch (error) {
    console.error(error);
    throw new Error(`Developer registration failed: ${error}`);
  }
}

/**
 * Prompts user for development port with default value.
 * @returns Promise resolving to the selected port.
 */
async function askForPort(): Promise<number> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter development port (default: 3000): ', (answer) => {
      rl.close();
      const port = answer.trim() || '3000';

      // Validate port is a number
      const portNumber = parseInt(port, 10);
      if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
        console.error('Error: Port must be a valid number between 1 and 65535');
        process.exit(1);
      }

      resolve(portNumber);
    });
  });
}

/**
 * Gets the current version of @rimori/client from its package.json.
 * @returns The current version string with caret prefix.
 * @throws {Error} if rimori-client package.json cannot be read.
 */
function getRimoriClientVersion(): string {
  try {
    // Get the path to rimori-client package.json relative to this script
    const rimoriClientPackageJsonPath = path.resolve(__dirname, '../../../package.json');
    const rimoriClientPackageJson = JSON.parse(fs.readFileSync(rimoriClientPackageJsonPath, 'utf8'));
    return `^${rimoriClientPackageJson.version}`;
  } catch (error) {
    throw new Error(`Failed to read rimori-client version: ${error}`);
  }
}

/**
 * Sets up a new plugin to be used in the operator by updating its package.json.
 * @param param
 * @param param.pluginId - The unique plugin identifier (optional for upgrade mode).
 * @param param.token - The plugin authentication token (optional for upgrade mode).
 * @param param.port - The development port for the plugin (optional).
 * @param param.isUpgrade - Whether this is an upgrade operation.
 * @throws {Error} if plugin directory doesn't exist or package.json is missing.
 */
function setupPlugin({
  pluginId,
  token,
  port,
  isUpgrade = false,
}: PluginSetupParams): void {
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
    "release:stable": "yarn build && yarn rimori-release stable"
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

  // Create a new directory for the plugin
  const rimoriDir = path.resolve('./rimori');
  const configSrcPath = path.resolve(__dirname, 'node_modules/@rimori/client/example/rimori.config.ts');
  const configDestPath = path.resolve(rimoriDir, 'rimori.config.ts');

  // Only copy if destination file doesn't exist
  if (!fs.existsSync(configDestPath)) {
    fs.mkdirSync(rimoriDir);
    fs.copyFileSync(configSrcPath, configDestPath);
    console.log(`Created rimori directory: ${rimoriDir}`);
  } else {
    console.log(`Rimori config already present, skipping initialization.`);
  }

  // copy the readme.md file to the rimori directory
  const readmeSrcPath = path.resolve(__dirname, '../../../README.md');
  const readmeDestPath = path.resolve(rimoriDir, 'readme.md');
  fs.copyFileSync(readmeSrcPath, readmeDestPath);

  // Create .env file if it doesn't exist and token is provided
  if (token) {
    const envPath = path.resolve('.env');
    if (!fs.existsSync(envPath)) {
      const envContent = `RIMORI_TOKEN=${token}\n`;
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('Created .env file with RIMORI_TOKEN');
    } else {
      console.log('.env file already exists, skipping creation');
    }
  }

  // Update .gitignore to exclude .env files
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
    const envEntry = gitignoreContent.endsWith('\n') || gitignoreContent === '' ? '.env\n' : '\n.env\n';
    gitignoreContent += envEntry;
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
    console.log('Added .env to .gitignore');
  } else {
    console.log('.env already in .gitignore, skipping update');
  }

  console.log('');
  console.log('✅ Plugin ' + (isUpgrade ? 'upgrade' : 'setup') + ' completed successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Check out ./rimori/readme.md for more information about how to make the most out of the plugin.');
  console.log('2. Adapt the ./rimori/rimori.config.ts file to your needs.');
  console.log('3. Start development with: yarn dev');
  console.log('');
  console.log(`The plugin should now be accessible at: http://localhost:${port || 3000}`);
  console.log('');
  console.log('If you want to release the plugin, simply run: "yarn release:<alpha|beta|stable>" (details are available in ./rimori/readme.md)');
}

/**
 * Main function that handles the complete plugin setup flow.
 */
async function main(): Promise<void> {
  try {
    // Check for --upgrade flag
    const isUpgrade = process.argv.includes('--upgrade');

    if (isUpgrade) {
      console.log('🔄 Starting Rimori Plugin Upgrade...');
    } else {
      console.log('🎯 Starting Rimori Plugin Setup...');
    }
    console.log('');

    // Check if plugin is already initialized (skip for upgrade mode)
    if (!isUpgrade) {
      const packageJsonPath = path.resolve('./package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (packageJson.r_id) {
            console.log('❌ Plugin is already initialized!');
            console.log(`Plugin ID: ${packageJson.r_id}`);
            console.log('');
            console.log('If you want to reinitialize the plugin, please remove the "r_id" field from package.json first.');
            console.log('Or use the --upgrade flag to upgrade the plugin configuration without changing the plugin ID.');
            process.exit(0);
          }
        } catch (error) {
          console.warn('Warning: Could not read package.json, continuing with setup...');
        }
      }
    }

    if (isUpgrade) {
      // For upgrade mode, only ask for port and setup plugin
      console.log('🔄 Upgrade mode: Skipping authentication and plugin registration...');
      console.log('');

      // Ask for development port
      const port = await askForPort();
      console.log('');

      // Setup the plugin in upgrade mode
      setupPlugin({
        port,
        isUpgrade: true,
      });
    } else {
      // Step 1: Get user credentials
      const credentials = await askForCredentials();
      console.log('');

      // Step 2: Authenticate with Supabase
      const jwtToken = await authenticateWithSupabase(credentials);
      console.log('');

      // Step 3: Ask for development port
      const port = await askForPort();
      console.log('');

      // Step 4: Register developer and get plugin credentials
      const { plugin_id, access_token } = await registerDeveloper(jwtToken, port);
      console.log('');

      // Step 5: Setup the plugin
      setupPlugin({
        pluginId: plugin_id,
        token: access_token,
        port,
        isUpgrade: false,
      });
    }

  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
    console.error('');
    console.error('Make sure that:');
    console.error('1. Your Supabase credentials are correct');
    console.error('2. You have internet connection for authentication');
    process.exit(1);
  }
}

main();
