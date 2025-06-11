import { createClient } from '@supabase/supabase-js';
import path from 'path';
import * as readline from 'readline';
import { DEFAULT_ANON_KEY, DEFAULT_ENDPOINT } from '../../../utils/endpoint.js';

export interface UserCredentials {
  email: string;
  password: string;
}

export interface DeveloperRegisterResponse {
  plugin_id: string;
  access_token: string;
}

/**
 * Prompts user for email and password credentials.
 * @returns Promise resolving to user credentials.
 */
export async function askForCredentials(): Promise<UserCredentials> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter your email: ', (email) => {
      rl.close();

      // Create a new interface for password input with muted output
      const passwordRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });

      process.stdout.write('Enter your password: ');

      // Set up stdin for raw input
      process.stdin.setRawMode(true);
      process.stdin.resume();

      let password = '';

      const onData = (buffer: Buffer) => {
        const char = buffer.toString('utf8');

        if (char === '\r' || char === '\n') {
          // Enter pressed
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          passwordRl.close();
          resolve({ email: email.trim(), password: password.trim() });
        } else if (char === '\u0003') {
          // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          process.exit(0);
        } else if (char === '\u007f' || char === '\b') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) {
          // Printable characters
          password += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    });
  });
}

/**
 * Prompts user for development port with default value.
 * @returns Promise resolving to the selected port.
 */
export async function askForPort(): Promise<number> {
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
 * Authenticates with Supabase using email and password.
 * @param param
 * @param param.email - User email address.
 * @param param.password - User password.
 * @returns Promise resolving to JWT access token.
 * @throws {Error} if authentication fails.
 */
export async function authenticateWithSupabase({
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
export async function registerDeveloper(jwtToken: string, port: number): Promise<DeveloperRegisterResponse> {
  console.log('🚀 Registering developer and creating plugin...');

  try {
    console.log('port', port, typeof port);
    const currentFolderName = path.basename(process.cwd());
    const body: any = { port, pluginName: currentFolderName };

    const response = await fetch('http://localhost:2800/developer/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(body),
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