import * as fs from 'fs';
import * as path from 'path';

/**
 * Updates the tailwind.config.ts file to set darkMode to "class" and add the Rimori client package to content.
 */
export function updateTailwindConfig(): void {
  console.log('Updating Tailwind CSS configuration...');

  const tailwindConfigPath = path.resolve('./tailwind.config.ts');

  if (!fs.existsSync(tailwindConfigPath)) {
    console.log('Warning: tailwind.config.ts not found, skipping Tailwind CSS update');
    return;
  }

  try {
    const configContent = fs.readFileSync(tailwindConfigPath, 'utf8');

    let updatedContent = configContent;

    // Set darkMode to "class" if it exists, otherwise add it
    if (updatedContent.includes('darkMode:')) {
      updatedContent = updatedContent.replace(
        /darkMode:\s*\[?"[^"]*"?\]?,?/g,
        'darkMode: ["class"],'
      );
    } else {
      // Add darkMode after the opening brace
      updatedContent = updatedContent.replace(
        /export default \{/,
        'export default {\n  darkMode: ["class"],'
      );
    }

    // Add Rimori client package to content array if not already present
    if (!updatedContent.includes('node_modules/@rimori/client')) {
      // Find the content array and add the Rimori client path
      if (updatedContent.includes('content:')) {
        // More precise regex to handle the content array properly
        updatedContent = updatedContent.replace(
          /(content:\s*\[)([\s\S]*?)(\])/,
          (match, start, content, end) => {
            // Clean up any existing double commas first
            let cleanContent = content.replace(/,\s*,/g, ',');

            // Remove trailing comma and whitespace
            cleanContent = cleanContent.replace(/,\s*$/, '');

            // Add the new path with proper formatting
            const newPath = '"node_modules/@rimori/client/dist/components/**/*.{js,jsx}"';

            // If content is not empty, add comma before new entry
            if (cleanContent.trim()) {
              return `${start}${cleanContent},\n    ${newPath}\n  ${end}`;
            } else {
              return `${start}\n    ${newPath}\n  ${end}`;
            }
          }
        );
      } else {
        // Add content array if it doesn't exist
        updatedContent = updatedContent.replace(
          /darkMode: \["class"\],/,
          'darkMode: ["class"],\n  content: [\n    "./src/**/*.{js,jsx,ts,tsx}",\n    "node_modules/@rimori/client/dist/components/**/*.{js,jsx}"\n  ],'
        );
      }
    }

    fs.writeFileSync(tailwindConfigPath, updatedContent, 'utf8');
    console.log('✅ Tailwind CSS configuration updated');
  } catch (error) {
    console.warn(`Warning: Could not update tailwind.config.ts: ${error instanceof Error ? error.message : error}`);
  }
} 