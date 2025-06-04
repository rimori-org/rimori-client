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
import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { DEFAULT_ENDPOINT } from '../utils/endpoint.js';

// Read version from package.json
const packageJsonPath = path.resolve('./package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const VERSION = packageJson.version;

if (!VERSION) {
  throw new Error('Version not found in package.json');
}

const RIMORI_TOKEN = process.env.RIMORI_TOKEN;
if (!RIMORI_TOKEN) throw new Error('RIMORI_TOKEN is not set');
const RIMORI_PLUGIN = process.env.RIMORI_PLUGIN;
if (!RIMORI_PLUGIN) throw new Error('RIMORI_PLUGIN is not set');

/**
 * Upload all files from a directory and its subdirectories to the release function
 * @param releaseChannel - Release channel of the plugin
 */
async function uploadDirectory(releaseChannel: string): Promise<void> {
  const relativePath = './dist';
  try {
    const absolutePath = path.resolve(relativePath);
    console.log(`📁 Scanning directory: ${absolutePath}`);

    // Check if directory exists
    let stat;
    try {
      stat = await fs.promises.stat(absolutePath);
      if (!stat.isDirectory()) {
        throw new Error(`Path ${relativePath} is not a directory`);
      }
    } catch (error: any) {
      throw new Error(`Directory ${relativePath} does not exist: ${error.message}`);
    }

    const formData = new FormData();
    formData.append('version', VERSION);
    formData.append('release_channel', releaseChannel);
    formData.append('plugin_id', RIMORI_PLUGIN);
    formData.append('token', RIMORI_TOKEN);

    let fileCount = 0;
    // Recursively walk the directory
    async function walkDir(dir: string) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          const relativeFilePath = path.relative(absolutePath, fullPath);
          const fileKey = `file_${relativeFilePath.replace(/[\\/]/g, '___')}`;
          console.log(`📄 Preparing file for upload: ${relativeFilePath}`);

          const fileContent = await fs.promises.readFile(fullPath);
          formData.append(fileKey, fileContent, {
            filename: relativeFilePath,
            contentType: getContentType(fullPath),
          });
          fileCount++;
        }
      }
    }
    await walkDir(absolutePath);

    if (fileCount === 0) {
      console.log('❌ No files found to upload');
      return;
    }

    console.log(`🚀 Uploading ${fileCount} files...`);
    console.log(`Plugin ID: ${RIMORI_PLUGIN}`);
    console.log(`Release Channel: ${releaseChannel}`);
    console.log(`Version: ${VERSION}`);

    const response = await fetch(`${DEFAULT_ENDPOINT}/functions/v1/release`, {
      method: 'POST',
      body: formData as any,
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);

    try {
      const responseData = JSON.parse(responseText);
      if (response.ok) {
        console.log('✅ Upload successful!');
        console.log(`📊 Files released: ${fileCount}`);
      } else {
        console.log('❌ Upload failed!');
        console.log('Error:', responseData.error || 'Unknown error');
        console.log('Response data:', JSON.stringify(responseData, null, 2));
      }
    } catch (e) {
      console.log('Raw response:', responseText);
    }
  } catch (error: any) {
    console.error('❌ Error during upload:', error.message);
  } finally {
    console.log('🔄 Upload completed');
    process.exit(0);
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    md: 'text/markdown',
    txt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
  };
  const contentType = contentTypes[ext || ''];
  if (!contentType) throw new Error(`Unsupported file type: ${ext}`);
  return contentType;
}

const args = process.argv.slice(2);
const [releaseChannel] = args;
if (!releaseChannel) {
  console.error('Usage: rimori-release <release_channel>');
  process.exit(1);
}

uploadDirectory(releaseChannel);