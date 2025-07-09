const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Tell Metro that `.wasm` files are static assets
config.resolver.assetExts = config.resolver.assetExts.concat(['wasm']);

// For web, add the COEP/COOP headers so the SharedArrayBuffer in the worker will work
config.server.enhanceMiddleware = (middleware) => {
    return (req, res, next) => {
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        return middleware(req, res, next);
    };
};

module.exports = config;