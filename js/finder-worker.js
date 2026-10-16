// Runs findRecipes() off the main thread; the full search takes a few seconds.
import data from './data.js';
import { findRecipes } from './finder.js';

self.onmessage = ({ data: { version, seed, target, opts, keep } }) => {
  const result = findRecipes(data.versions[version], seed, target, opts, {
    keep,
    onProgress: done => self.postMessage({ progress: done }),
  });
  self.postMessage({ result });
};
