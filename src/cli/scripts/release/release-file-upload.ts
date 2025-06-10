import fs from 'fs';
import path from 'path';
import { Config } from './release.js';

/**
 * Upload all files from a directory and its subdirectories to the release function
 * @param config - Configuration object
 */
export async function uploadDirectory(config: Config, release_id: string): Promise<void> {
  const relativePath = './dist';

  console.log(`📁 Preparing to upload files from ${relativePath}...`);

  // Check if dist directory exists
  try {
    await fs.promises.access(relativePath);
  } catch (e) {
    throw new Error(`Directory ${relativePath} does not exist. Make sure to build your plugin first.`);
  }
  // Get all files recursively
  const files = await getAllFiles(relativePath);

  if (files.length === 0) {
    console.log('⚠️ No files found to upload');
    return;
  }

  console.log(`🚀 Uploading ${files.length} files...`);

  // Create FormData
  const formData = new FormData();

  // Add version and release channel data
  formData.append('version', config.version);
  formData.append('release_channel', config.release_channel);
  formData.append('plugin_id', config.plugin_id);

  // Create path mapping with IDs as keys
  const pathMapping: Record<string, string> = {};

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    try {
      const fileContent = await fs.promises.readFile(filePath);
      const relativePath = path.relative('./dist', filePath);
      const contentType = getContentType(filePath);

      // Generate unique ID for this file
      const fileId = `file_${i}`;

      // Add to path mapping using ID as key
      pathMapping[fileId] = relativePath;

      // Create a Blob with the file content and content type
      const blob = new Blob([fileContent], { type: contentType });

      // Add file to FormData with ID_filename format
      const fileName = `${fileId}_${path.basename(filePath)}`;
      formData.append('files', blob, fileName);
    } catch (error: any) {
      console.error(`❌ Error reading file ${filePath}:`, error.message);
      throw error;
    }
  }

  // Add path mapping to FormData
  formData.append('path_mapping', JSON.stringify(pathMapping));

  // Upload to the release endpoint
  const response = await fetch(`${config.domain}/release/${release_id}/files`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.token}` },
    body: formData,
  });

  if (response.ok) {
    console.log('✅ Files uploaded successfully!');
  } else {
    const errorText = await response.text();
    console.log('❌ File upload failed!');
    console.log('Response:', errorText);
    throw new Error(`File upload failed with status ${response.status}`);
  }
}

/**
 * Recursively get all files from a directory
 */
async function getAllFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function traverse(currentPath: string) {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await traverse(dirPath);
  return files;
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
    webp: 'image/webp',
  };
  const contentType = contentTypes[ext || ''];
  if (!contentType) throw new Error(`Unsupported file type: ${ext}`);
  return contentType;
}