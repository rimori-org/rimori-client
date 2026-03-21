import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { Config } from './release';

/**
 * Read and send the prompts configuration to the release endpoint.
 * Mirrors the pattern of release-db-update.ts.
 * @param config - Configuration object
 * @param release_id - The release ID
 */
export default async function promptsUpload(config: Config, release_id: string): Promise<void> {
  const promptsConfigPath = path.resolve('./rimori/prompts.config.ts');

  // Check if prompts config file exists — optional, skip if not present
  try {
    await fs.promises.access(promptsConfigPath);
  } catch (e) {
    return; // No prompts.config.ts — silently skip
  }

  try {
    // Use TypeScript compiler to transpile and load
    const promptsContent = await fs.promises.readFile(promptsConfigPath, 'utf8');

    // Transpile TypeScript to JavaScript
    const result = ts.transpile(promptsContent, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
    });

    // Create a temporary file to import the transpiled code
    const tempFile = path.join(process.cwd(), 'temp_prompts_config.js');
    await fs.promises.writeFile(tempFile, result);

    let prompts: any[];
    try {
      const promptsModule = await import(`file://${tempFile}`);
      // Collect all named exports as individual prompt definitions
      prompts = Object.values(promptsModule);
      await fs.promises.unlink(tempFile);
    } catch (error) {
      try {
        await fs.promises.unlink(tempFile);
      } catch (e) {}
      throw error;
    }

    if (!Array.isArray(prompts) || prompts.length === 0) {
      console.warn('⚠️ prompts.config.ts has no exports. Skipping.');
      return;
    }

    console.log(`📝 Sending ${prompts.length} prompt definitions...`);

    const requestBody = {
      prompts,
      version: config.version,
      release_channel: config.release_channel,
      plugin_id: config.plugin_id,
    };

    const response = await fetch(`${config.domain}/release/${release_id}/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Prompts uploaded: ${data.prompt_names?.join(', ') ?? 'ok'}`);
    } else {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(`Failed to upload prompts: ${text}`);
    }
  } catch (error: any) {
    console.error('❌ Error uploading prompts:', error.message);
    throw error;
  }
}
