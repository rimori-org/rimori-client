# Rimori Client Package

This is the React connection package required by plugins to be able to
communicate with the Rimori platform.

## Usage

In order to use the package first install the package with

```bash
npm i @rimori/client
```

Then wrap your app the following way to get started:

```typescript
import { lazy } from "react";
import { PluginProvider, setTheme } from "@rimori/client";
import { HashRouter, Route, Routes } from "react-router-dom";

// adding the theme setter
setTheme();

const queryClient = new QueryClient();

// load all pages lazy for fast loading speed
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const DiscussionsPage = lazy(() => import("./pages/discussions/page"));

const App = () => (
    // this provides connectivity to Rimori
    <PluginProvider>
        //allows using the routes set the plugin settings
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                // the plugins pages
                <Route path="/discussions" element={<DiscussionsPage />} />
                // the settings page
                <Route path="/settings" element={<SettingsPage />} />
            </Routes>
        </HashRouter>
    </PluginProvider>
);

export default App;
```

Inside the pages simply use the `usePlugin` hook.

```typescript
const { getSettings, ... } = usePlugin();
```