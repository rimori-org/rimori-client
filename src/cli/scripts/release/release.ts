#!/usr/bin/env node

/**
 * Usage:
 *   rimori-release <release_channel>
 *
 * Environment variables required:
 *   RIMORI_TOKEN   - Your Rimori token
 *   RIMORI_PLUGIN  - Your plugin ID
 *
 * Make sure to install dependencies:
 *   npm install node-fetch form-data ts-node typescript
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dbUpdate from './release-db-update.js';
import promptsUpload from './release-prompts-upload.js';
import { uploadDirectory } from './release-file-upload.js';
import { releasePlugin, sendConfiguration } from './release-config-upload.js';

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve('./package.json'), 'utf8'));
const { version, r_id: pluginId } = packageJson;
const RIMORI_TOKEN = process.env.RIMORI_TOKEN;

if (!RIMORI_TOKEN) {
  console.error('Error: RIMORI_TOKEN is not set');
  process.exit(1);
}
if (!pluginId) {
  console.error('Error: The plugin id (r_id) is not set in package.json');
  process.exit(1);
}

const cliArgs = process.argv.slice(2);
const devSync = cliArgs.includes('--dev-sync');
const releaseChannel = cliArgs.find((a) => !a.startsWith('--'));
if (!releaseChannel) {
  console.error('Usage: rimori-release <release_channel> [--dev-sync]');
  process.exit(1);
}
if (devSync && releaseChannel !== 'alpha') {
  console.error('--dev-sync is only allowed with the alpha channel');
  process.exit(1);
}

const config = {
  version,
  release_channel: releaseChannel,
  plugin_id: pluginId,
  token: RIMORI_TOKEN,
  domain: process.env.RIMORI_BACKEND_URL || 'https://api.rimori.se',
  rimori_client_version: packageJson.dependencies['@rimori/client'].replace('^', ''),
  dev_sync: devSync,
};

export type Config = typeof config;

/**
 * Main release process
 */
async function releaseProcess(): Promise<void> {
  try {
    if (config.dev_sync) {
      console.log(`⚡ Dev-sync ${config.plugin_id} → existing alpha release`);
    } else {
      console.log(`🚀 Releasing ${config.plugin_id} to ${config.release_channel}...`);
    }
    console.log(`📡 Deploying to: ${config.domain}`);

    // First send the configuration
    const release_id = await sendConfiguration(config);

    // Upload prompts (if prompts.config.ts exists)
    await promptsUpload(config, release_id);

    await dbUpdate(config, release_id);

    // Dev-sync only pushes metadata — skip bundle upload and finalize.
    if (config.dev_sync) {
      console.log('✅ Dev-sync complete');
      return;
    }

    // Then upload the files
    await uploadDirectory(config, release_id);

    // Then release the plugin
    await releasePlugin(config, release_id);

    // Inform user about translation processing
    console.log(
      '🌐 Hint: The plugin is released but it might take some time until all translations are being processed.',
    );
  } catch (error: any) {
    console.log('❌ Error:', error.message);
    process.exit(1);
  }
}

releaseProcess();
