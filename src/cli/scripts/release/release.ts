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

const [releaseChannel] = process.argv.slice(2);
if (!releaseChannel) {
  console.error('Usage: rimori-release <release_channel>');
  process.exit(1);
}

if (process.env.RIMORI_BACKEND_URL) {
  console.info('Using backend url:', process.env.RIMORI_BACKEND_URL);
}

const config = {
  version,
  release_channel: releaseChannel,
  plugin_id: pluginId,
  token: RIMORI_TOKEN,
  domain: process.env.RIMORI_BACKEND_URL || 'https://api.rimori.se',
  rimori_client_version: packageJson.dependencies['@rimori/client'].replace('^', ''),
};

export type Config = typeof config;

/**
 * Main release process
 */
async function releaseProcess(): Promise<void> {
  try {
    console.log(`🚀 Releasing ${config.plugin_id} to ${config.release_channel}...`);

    // First send the configuration
    const release_id = await sendConfiguration(config);

    await dbUpdate(config, release_id);

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
