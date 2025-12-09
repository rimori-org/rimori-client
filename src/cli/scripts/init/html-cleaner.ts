import * as fs from 'fs';
import * as path from 'path';

/**
 * Removes all meta tags from HTML content except viewport and charset.
 * @param htmlContent - The HTML content to process.
 * @returns The processed HTML content with unwanted meta tags removed.
 */
function removeUnwantedMetaTags(htmlContent: string): string {
  // Remove all meta tags except those with name="viewport" or charset attribute
  let cleanedContent = htmlContent.replace(/<meta\s+(?![^>]*(?:name\s*=\s*["']viewport["']|charset\s*=))[^>]*>/gi, '');

  // Remove empty lines left behind
  cleanedContent = cleanedContent.replace(/^\s*[\r\n]/gm, '');

  return cleanedContent;
}

/**
 * Processes HTML files to remove unwanted meta tags.
 */
export function cleanHtmlMetaTags(): void {
  const filePath = path.resolve('./index.html');

  if (!filePath.endsWith('.html')) {
    return;
  }

  if (!fs.existsSync(filePath)) {
    console.log(`Warning: HTML file not found: ${filePath}`);
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const cleanedContent = removeUnwantedMetaTags(content);

    if (content !== cleanedContent) {
      fs.writeFileSync(filePath, cleanedContent, 'utf8');
      console.log(`Cleaned meta tags in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing HTML file ${filePath}:`, error);
  }
}
