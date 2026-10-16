// Runs findRecipes() off the main thread; the full search takes a few seconds.
import data from './data.js?v=2';
import { findRecipes } from './finder.js?v=2';

self.onmessage = ({ data: { version, seed, target, opts, keep } }) => {
  const result = findRecipes(data.versions[version], seed, target, opts, {
    keep,
    onProgress: done => self.postMessage({ progress: done }),
  });
  self.postMessage({ result });
};
