import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { Config } from './release';

/**
 * Read and send the database configuration to the release endpoint
 * @param config - Configuration object
 */
export default async function dbUpdate(config: Config, release_id: string): Promise<void> {
  const dbConfigPath = path.resolve('./rimori/db.config.ts');

  // Check if db config file exists
  try {
    await fs.promises.access(dbConfigPath);
  } catch (e) {
    console.warn('Could not find db.config.ts in ./rimori/ directory. Skipping database configuration upload.');
    return;
  }

  try {
    let dbConfigObject;

    // Use TypeScript compiler to transpile and load
    const dbConfigContent = await fs.promises.readFile(dbConfigPath, 'utf8');

    // Transpile TypeScript to JavaScript
    const result = ts.transpile(dbConfigContent, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
    });

    // Create a temporary file to import the transpiled code
    const tempFile = path.join(process.cwd(), 'temp_db_config.js');
    await fs.promises.writeFile(tempFile, result);

    try {
      // Use dynamic import to load the db config
      const dbConfig = await import(`file://${tempFile}`);
      dbConfigObject = Object.values(dbConfig);

      // Clean up temp file
      await fs.promises.unlink(tempFile);
    } catch (error) {
      // Clean up temp file even on error
      try {
        await fs.promises.unlink(tempFile);
      } catch (e) {}
      throw error;
    }

    if (!dbConfigObject) {
      throw new Error('Database configuration object is empty or undefined');
    }

    console.log(`🗄️ Sending database configuration...`);

    const requestBody = {
      db_config: dbConfigObject,
      version: config.version,
      release_channel: config.release_channel,
      plugin_id: config.plugin_id,
    };

    const response = await fetch(`${config.domain}/release/${release_id}/db`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(requestBody),
    }).catch((e) => {
      console.log('error', e);
      throw new Error('Error sending database configuration');
    });
    try {
      const responseText = await response.text().catch((e) => {
        console.log('error', e);
        throw new Error('Error sending database configuration');
      });

      const responseData = JSON.parse(responseText);
      if (response.ok) {
        console.log('✅ Database configuration deployed successfully!');
      } else {
        console.log('responseData', responseData);
        throw new Error(responseData.message);
      }
    } catch (e) {
      console.log('error', e);
      throw new Error('Error sending database configuration');
    }
  } catch (error: any) {
    console.error('❌ Error sending database configuration:', error.message);
    throw error;
  }
}
