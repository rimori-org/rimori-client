import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { Config } from './release.js';

/**
 * Read and send the rimori configuration to the release endpoint
 * @param config - Configuration object
 */
export async function sendConfiguration(config: Config): Promise<string> {
  const configPath = path.resolve('./rimori/rimori.config.ts');

  // Check if config file exists
  try {
    await fs.promises.access(configPath);
  } catch (e) {
    throw new Error('Could not find rimori.config.ts in ./rimori/ directory');
  }

  try {
    let configObject;

    // Use TypeScript compiler to transpile and load
    const configContent = await fs.promises.readFile(configPath, 'utf8');

    // Transpile TypeScript to JavaScript
    const result = ts.transpile(configContent, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
    });

    // Create a temporary file to import the transpiled code
    const tempFile = path.join(process.cwd(), 'temp_config.js');
    await fs.promises.writeFile(tempFile, result);

    try {
      // Use dynamic import to load the config
      const config = await import(`file://${tempFile}`);
      configObject = config.default || config;

      // Clean up temp file
      await fs.promises.unlink(tempFile);
    } catch (error) {
      // Clean up temp file even on error
      try {
        await fs.promises.unlink(tempFile);
      } catch (e) {}
      throw error;
    }

    if (!configObject) {
      throw new Error('Configuration object is empty or undefined');
    }

    console.log(`🚀 Sending configuration...`);

    const requestBody = {
      config: configObject,
      version: config.version,
      plugin_id: config.plugin_id,
      release_channel: config.release_channel,
      rimori_client_version: config.rimori_client_version,
    };

    try {
      const response = await fetch(`${config.domain}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log('Configuration response status:', response.status);
      console.log('Configuration response text:', responseText);

      const responseData = JSON.parse(responseText);
      if (response.ok) {
        console.log('✅ Configuration deployed successfully!');
        return responseData.release_id;
      } else {
        console.log('❌ Configuration failed!');
        console.log('Error:', responseData.error || 'Unknown error');
        console.log('Response data:', JSON.stringify(responseData, null, 2));
        throw new Error('Configuration upload failed');
      }
    } catch (e) {
      console.log('error', e);
      throw new Error('Error sending configuration');
    }
  } catch (error: any) {
    console.error('❌ Error sending configuration:', error.message);
    throw error;
  }
}

export async function releasePlugin(config: Config, release_id: string): Promise<void> {
  const response = await fetch(`${config.domain}/release/${release_id}/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ plugin_id: config.plugin_id }),
  });

  if (!response.ok) {
    console.log('Response:', await response.text());
    throw new Error('Failed to release plugin');
  }
  console.log('✅ Plugin released successfully');
}
