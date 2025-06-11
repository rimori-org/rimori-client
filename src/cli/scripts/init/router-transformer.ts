import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface representing a detected route component
 */
interface RouteComponent {
  /** Component name as used in JSX */
  componentName: string;
  /** Original import statement */
  importStatement: string;
  /** Import path */
  importPath: string;
  /** Whether it's a default import */
  isDefaultImport: boolean;
}

/**
 * Transform App.tsx to use PluginProvider with HashRouter instead of BrowserRouter.
 * Also converts route components to lazy loading with Suspense.
 * @param pluginId - The plugin ID to use in PluginProvider
 */
export function transformAppRouter(pluginId: string): void {
  const appTsxPath = path.resolve('./src/App.tsx');

  if (!fs.existsSync(appTsxPath)) {
    console.warn('Warning: App.tsx not found, skipping router transformation');
    return;
  }

  let content = fs.readFileSync(appTsxPath, 'utf8');

  // Check if PluginProvider is already applied
  if (content.includes('PluginProvider')) {
    console.log('✅ PluginProvider already applied, skipping router transformation');
    return;
  }

  // Check if BrowserRouter exists
  if (!content.includes('BrowserRouter')) {
    console.log('✅ BrowserRouter not found, skipping router transformation');
    return;
  }

  console.log('🔄 Transforming App.tsx to use PluginProvider with HashRouter...');

  // Step 1: Detect and extract route components
  const routeComponents = detectRouteComponents(content);

  if (routeComponents.length > 0) {
    console.log(`🔄 Found ${routeComponents.length} route components, converting to lazy loading...`);

    // Step 2: Transform imports to lazy loading
    content = transformToLazyImports(content, routeComponents);

    // Step 3: Add Suspense wrapper around Routes
    content = addSuspenseWrapper(content);
  }

  // Step 4: Transform router imports and JSX (existing functionality)
  content = transformImports(content);
  content = transformJSX(content, pluginId);

  // Write the transformed content back
  fs.writeFileSync(appTsxPath, content, 'utf8');
  console.log('✅ App.tsx transformed successfully with lazy loading');
}

/**
 * Detects route components in the JSX by parsing Route elements.
 * Looks for patterns like: <Route path="/" element={<ComponentName />} />
 * @param content - The file content to analyze
 * @returns Array of detected route components with their import information
 */
function detectRouteComponents(content: string): RouteComponent[] {
  const routeComponents: RouteComponent[] = [];

  // Regex to match Route elements with component references
  // Matches: <Route ... element={<ComponentName .../>} ... />
  const routeRegex = /<Route[^>]*element=\{\s*<(\w+)[^}]*\}[^>]*\/?>/g;

  let match;
  const componentNames = new Set<string>();

  // Extract all unique component names from routes
  while ((match = routeRegex.exec(content)) !== null) {
    const componentName = match[1];
    componentNames.add(componentName);
  }

  // For each component, find its corresponding import statement
  componentNames.forEach(componentName => {
    const importInfo = findImportForComponent(content, componentName);
    if (importInfo) {
      routeComponents.push({
        componentName,
        importStatement: importInfo.importStatement,
        importPath: importInfo.importPath,
        isDefaultImport: importInfo.isDefaultImport
      });
    }
  });

  return routeComponents;
}

/**
 * Finds the import statement for a given component name.
 * Handles both default imports and named imports.
 * @param content - The file content to search
 * @param componentName - The component name to find import for
 * @returns Import information or null if not found
 */
function findImportForComponent(content: string, componentName: string): {
  importStatement: string;
  importPath: string;
  isDefaultImport: boolean;
} | null {
  // Check for default import: import ComponentName from "path"
  const defaultImportRegex = new RegExp(`import\\s+${componentName}\\s+from\\s+["']([^"']+)["'];?`, 'g');
  const defaultMatch = defaultImportRegex.exec(content);

  if (defaultMatch) {
    return {
      importStatement: defaultMatch[0],
      importPath: defaultMatch[1],
      isDefaultImport: true
    };
  }

  // Check for named import: import { ComponentName } from "path"
  const namedImportRegex = /import\s*\{\s*([^}]*)\s*\}\s*from\s*["']([^"']+)["'];?/g;
  let namedMatch;

  while ((namedMatch = namedImportRegex.exec(content)) !== null) {
    const imports = namedMatch[1].split(',').map(imp => imp.trim());
    if (imports.includes(componentName)) {
      return {
        importStatement: namedMatch[0],
        importPath: namedMatch[2],
        isDefaultImport: false
      };
    }
  }

  return null;
}

/**
 * Transforms regular component imports to lazy imports.
 * Converts: import ComponentName from "./path"
 * To: const ComponentName = lazy(() => import("./path"))
 * @param content - The file content to transform
 * @param routeComponents - Array of route components to transform
 * @returns Transformed content with lazy imports
 */
function transformToLazyImports(content: string, routeComponents: RouteComponent[]): string {
  let transformedContent = content;

  // Add lazy import if not already present
  if (!content.includes('lazy')) {
    transformedContent = addLazyImport(transformedContent);
  }

  // Transform each route component import
  routeComponents.forEach((component, index) => {
    const { componentName, importStatement, importPath, isDefaultImport } = component;

    // Create lazy import statement
    const lazyImport = isDefaultImport
      ? `const ${componentName} = lazy(() => import("${importPath}"));`
      : `const ${componentName} = lazy(() => import("${importPath}").then(module => ({ default: module.${componentName} })));`;

    // Replace the original import with lazy import
    transformedContent = transformedContent.replace(importStatement, (index === 0 ? '\n' : '') + lazyImport);
  });

  return transformedContent;
}

/**
 * Adds lazy import from React if not already present.
 * @param content - The file content to modify
 * @returns Content with lazy import added
 */
function addLazyImport(content: string): string {
  // Check if React import exists and update it
  const reactImportRegex = /import\s+(?:\*\s+as\s+)?React(?:\s*,\s*\{\s*([^}]*)\s*\})?\s+from\s+["']react["'];?/;
  const reactImportMatch = content.match(reactImportRegex);

  if (reactImportMatch) {
    // React import exists, add lazy to it
    const existingImports = reactImportMatch[1] || '';
    const importList = existingImports.split(',').map(imp => imp.trim()).filter(Boolean);

    if (!importList.includes('lazy')) {
      importList.push('lazy');
    }
    if (!importList.includes('Suspense')) {
      importList.push('Suspense');
    }

    const newImport = importList.length > 0
      ? `import React, { ${importList.join(', ')} } from "react";`
      : `import React from "react";`;

    return content.replace(reactImportMatch[0], newImport);
  } else {
    // No React import found, add it
    const firstImportMatch = content.match(/^import.*$/m);
    if (firstImportMatch) {
      return content.replace(firstImportMatch[0], `import React, { lazy, Suspense } from "react";\n${firstImportMatch[0]}`);
    } else {
      // No imports found, add at the beginning
      return `import React, { lazy, Suspense } from "react";\n${content}`;
    }
  }
}

/**
 * Wraps the Routes component with Suspense for lazy loading fallback.
 * Converts: <Routes>...</Routes>
 * To: <Suspense fallback={<div>Loading...</div>}><Routes>...</Routes></Suspense>
 * @param content - The file content to modify
 * @returns Content with Suspense wrapper added
 */
function addSuspenseWrapper(content: string): string {
  // Check if Suspense is already wrapping Routes
  if (content.includes('<Suspense') && content.match(/<Suspense[^>]*>[\s\S]*<Routes/)) {
    console.log('✅ Suspense wrapper already present');
    return content;
  }

  // Find Routes component and wrap with Suspense
  // Handle both self-closing and regular Routes tags
  const routesRegex = /(<Routes(?:[^>]*)>)([\s\S]*?)(<\/Routes>)/;
  const selfClosingRoutesRegex = /(<Routes[^>]*\/>)/;

  const routesMatch = content.match(routesRegex);
  const selfClosingMatch = content.match(selfClosingRoutesRegex);

  if (routesMatch) {
    // Regular Routes with children
    const [fullMatch, openTag, children, closeTag] = routesMatch;
    const suspenseWrapper = `<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>}>\n        ${openTag}${children}${closeTag}\n      </Suspense>`;
    return content.replace(fullMatch, suspenseWrapper);
  } else if (selfClosingMatch) {
    // Self-closing Routes
    const suspenseWrapper = `<Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-lg">Loading...</div></div>}>\n        ${selfClosingMatch[1]}\n      </Suspense>`;
    return content.replace(selfClosingMatch[1], suspenseWrapper);
  }

  console.log('✅ Routes component not found, skipping Suspense wrapper');
  return content;
}

/**
 * Transform the import statements to include PluginProvider and change BrowserRouter to HashRouter.
 * This is the original functionality for router transformation.
 * @param content - The file content to transform
 * @returns Transformed content with updated imports
 */
function transformImports(content: string): string {
  // Add PluginProvider import
  if (!content.includes('import') || !content.includes('@rimori/client')) {
    // Add new import line for PluginProvider
    const importMatch = content.match(/^(import.*from\s+["']react["'];?\s*\n)/m);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        `${importMatch[0]}import { PluginProvider } from "@rimori/client";\n`
      );
    } else {
      // If no React import found, add at the beginning
      content = `import { PluginProvider } from "@rimori/client";\n${content}`;
    }
  } else {
    // Update existing @rimori/client import to include PluginProvider
    content = content.replace(
      /import\s*{\s*([^}]*)\s*}\s*from\s*["']@rimori\/client["'];?/,
      (match, imports) => {
        const importList = imports.split(',').map((imp: string) => imp.trim()).filter(Boolean);
        if (!importList.includes('PluginProvider')) {
          importList.push('PluginProvider');
        }
        return `import { ${importList.join(', ')} } from "@rimori/client";`;
      }
    );
  }

  // Transform react-router-dom import: replace BrowserRouter with HashRouter
  content = content.replace(
    /import\s*{\s*([^}]*)\s*}\s*from\s*["']react-router-dom["'];?/,
    (match, imports) => {
      const importList = imports.split(',').map((imp: string) => imp.trim()).filter(Boolean);
      const updatedImports = importList.map((imp: string) =>
        imp === 'BrowserRouter' ? 'HashRouter' : imp
      );
      return `import { ${updatedImports.join(', ')} } from "react-router-dom";`;
    }
  );

  return content;
}

/**
 * Transform the JSX to wrap with PluginProvider and change BrowserRouter to HashRouter.
 * This is the original functionality for router transformation.
 * @param content - The file content to transform
 * @param pluginId - The plugin ID to use in PluginProvider
 * @returns Transformed content with updated JSX
 */
function transformJSX(content: string, pluginId: string): string {
  // Replace opening BrowserRouter tag
  content = content.replace(
    /<BrowserRouter(\s[^>]*)?>/,
    `<PluginProvider pluginId="${pluginId}">
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>`
  );

  // Replace closing BrowserRouter tag
  content = content.replace(
    /<\/BrowserRouter>/,
    `</HashRouter>
    </PluginProvider>`
  );

  return content;
} 