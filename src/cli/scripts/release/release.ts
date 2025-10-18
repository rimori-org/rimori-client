#!/usr/bin/env node

/**
 * Usage:
 *   rimori-release <release_channel>
 *
 * Environment variables required:
 *   RIMORI_TOKEN      - Your Rimori token
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
if (!RIMORI_TOKEN) throw new Error('RIMORI_TOKEN is not set');
if (!pluginId) throw new Error('The plugin id (r_id) is not set in package.json');

const [releaseChannel] = process.argv.slice(2);
if (!releaseChannel) {
  console.error('Usage: rimori-release <release_channel>');
  process.exit(1);
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
 * Detect available translation languages from public/locales directory
 */
async function detectTranslationLanguages(): Promise<string[]> {
  const localesPath = './public/locales';
  
  try {
    await fs.promises.access(localesPath);
  } catch (e) {
    console.log('⚠️ No locales directory found, no translations available');
    return [];
  }

  try {
    const files = await fs.promises.readdir(localesPath);
    
    // Filter out local- files and only include .json files
    const translationFiles = files.filter(file => 
      file.endsWith('.json') && 
      !file.startsWith('local-')
    );

    if (translationFiles.length === 0) {
      console.log('⚠️ No translation files found (excluding local- files)');
      return [];
    }

    // Extract language codes from filenames (e.g., en.json -> en)
    const languages = translationFiles.map(file => file.replace('.json', ''));
    
    console.log(`🌐 Found ${languages.length} translation languages: ${languages.join(', ')}`);
    return languages;
  } catch (error: any) {
    console.error(`❌ Error reading locales directory:`, error.message);
    return [];
  }
}

/**
 * Main release process
 */
async function releaseProcess(): Promise<void> {
  try {
    console.log(`🚀 Releasing ${config.plugin_id} to ${config.release_channel}...`);
    
    // Detect available translation languages
    const availableLanguages = await detectTranslationLanguages();
    
    // Add languages to config
    const configWithLanguages = {
      ...config,
      provided_languages: availableLanguages.length > 0 ? availableLanguages.join(',') : null,
    };
    
    // First send the configuration
    const release_id = await sendConfiguration(configWithLanguages);

    await dbUpdate(config, release_id);

    // Then upload the files
    await uploadDirectory(config, release_id);

    // Then release the plugin
    await releasePlugin(config, release_id);
    
    // Inform user about translation processing
    if (availableLanguages.length > 0) {
      console.log('🌐 Translation processing: Your translations are being processed asynchronously.');
      console.log('   The system will automatically detect if your English content has changed');
      console.log('   and process translations accordingly. You can check the status later.');
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
    process.exit(1);
  }
}

releaseProcess();
