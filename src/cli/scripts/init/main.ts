#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import {
  askForCredentials,
  askForPort,
  authenticateWithSupabase,
  registerDeveloper,
} from './dev-registration.js';
import { setupEnvFile, updateGitignore } from './env-setup.js';
import { copyPluginFiles } from './file-operations.js';
import { cleanHtmlMetaTags } from './html-cleaner.js';
import { updatePackageJson, type PackageJson } from './package-setup.js';
import { transformAppRouter } from './router-transformer.js';
import { updateTailwindConfig } from './tailwind-config.js';
import { updateViteConfigBase } from './vite-config.js';
import 'dotenv/config';

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

    let pluginId: string = '';

    if (isUpgrade) {
      // For upgrade mode, only ask for port and setup plugin
      console.log('🔄 Upgrade mode: Skipping authentication and plugin registration...');
      console.log('');

      // Get plugin ID from existing package.json
      try {
        const packageJsonPath = path.resolve('./package.json');
        const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        pluginId = packageJson.r_id || '';
      } catch (error) {
        console.warn('Warning: Could not read plugin ID from package.json');
      }

      // Ask for development port
      const port = await askForPort();
      console.log('');

      // Update package.json in upgrade mode
      updatePackageJson({
        port,
        isUpgrade: true,
      });

      // Copy files
      copyPluginFiles();

      // Update gitignore
      updateGitignore();

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
      pluginId = plugin_id;
      console.log('');

      // Step 5: Update package.json
      updatePackageJson({
        pluginId: plugin_id,
        port,
        isUpgrade: false,
      });

      // Step 6: Setup environment file
      setupEnvFile(access_token);

      // Step 7: Copy necessary files
      copyPluginFiles();

      // Step 8: Update gitignore
      updateGitignore();
    }

    // Setup vite config base
    try {
      console.log('Updating vite config base...');
      updateViteConfigBase();
      console.log('✅ Vite config base updated');
    } catch (error) {
      console.warn(`Warning: Could not update vite.config.ts base property: ${error instanceof Error ? error.message : error}`);
    }

    // Clean meta tags from index.html after vite adaptation
    cleanHtmlMetaTags();
    console.log('✅ Meta tags cleaned from index.html');

    // Update Tailwind CSS configuration
    updateTailwindConfig();

    // Transform App.tsx to use PluginProvider with HashRouter
    if (pluginId) {
      try {
        transformAppRouter(pluginId);
      } catch (error) {
        console.warn(`Warning: Could not transform App.tsx router: ${error instanceof Error ? error.message : error}`);
      }
    } else {
      console.warn('Warning: Plugin ID not available, skipping router transformation');
    }

    console.log('');
    console.log('✅ Plugin ' + (isUpgrade ? 'upgrade' : 'setup') + ' completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Check out ./rimori/readme.md for more information about how to make the most out of the plugin.');
    console.log('2. Adapt the ./rimori/rimori.config.ts file to your needs.');
    console.log('3. Under ./public/docs/ you can find the documentation for an example flashcard plugin to get started easier.');
    console.log('4. Start development with: yarn dev');
    console.log('');
    console.log(`The plugin should now be accessible at: http://localhost:${3000}`);
    console.log('');
    console.log('If you want to release the plugin, simply run: "yarn release:<alpha|beta|stable>" (details are available in ./rimori/readme.md)');

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
