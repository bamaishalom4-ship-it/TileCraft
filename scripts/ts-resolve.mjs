import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Lightweight Node 24 loader hook allowing `node --test` to resolve standard
 * extensionless TypeScript imports used by Expo/Metro without extra dependencies.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (
        (specifier.startsWith('./') || specifier.startsWith('../')) &&
        !specifier.endsWith('.ts') &&
        !specifier.endsWith('.tsx') &&
        context.parentURL
      ) {
        const candidateUrl = new URL(`${specifier}.ts`, context.parentURL);
        if (existsSync(fileURLToPath(candidateUrl))) {
          return nextResolve(`${specifier}.ts`, context);
        }
      }
      throw err;
    }
  },
});
