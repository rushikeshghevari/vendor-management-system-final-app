const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Some packages (zod's unified v3/v4 package, in particular) ship a `package.json`
// "exports" map that Metro's package-exports resolver mis-resolves — even for plain
// relative imports made from inside the package itself. Falling back to "main"/legacy
// resolution avoids that whole class of bug; nothing in this app relies on exports-only
// packages that require it.
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: './global.css' });
