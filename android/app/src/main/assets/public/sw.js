/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "version.json",
    "revision": "45513b7332ecb381f190de828ca4490a"
  }, {
    "url": "splash-icon.svg",
    "revision": "5b7b98dd10200530d0b6870d4213945c"
  }, {
    "url": "splash-icon.png",
    "revision": "7ae6b8c01706e9d743e48e7569146654"
  }, {
    "url": "manifest.json",
    "revision": "8858f52302909961a611ee9ce0e672d0"
  }, {
    "url": "index.html",
    "revision": "a8d10669e2a7ae9743ccc06625fa86ca"
  }, {
    "url": "icon.svg",
    "revision": "cdbdd088aecc021cc198e9ac90f1c1fb"
  }, {
    "url": "icon.png",
    "revision": "d63e69dade0f7effbb676285bc2b3b77"
  }, {
    "url": "generador.html",
    "revision": "c9791817999defe7edbc8131ab6ab2c7"
  }, {
    "url": "favicon.svg",
    "revision": "78ec88bed37062b4616bf69b1f66f51b"
  }, {
    "url": "favicon.png",
    "revision": "26e3ae31a073360357c03c435967eaaf"
  }, {
    "url": "favicon-32x32.png",
    "revision": "da22ac3e2c2c74c1c9b573e35586a650"
  }, {
    "url": "favicon-16x16.png",
    "revision": "369ac38c152fa9476aa643e63bf5bdcb"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "fe5ef35973559d46787c02c2b1bb253d"
  }, {
    "url": "android-chrome-512x512.png",
    "revision": "e4535069d9d6752d756afbf9062f02d5"
  }, {
    "url": "android-chrome-192x192.png",
    "revision": "8ebfa332731f09e35bf30d2543e1e353"
  }, {
    "url": "adaptive-icon.svg",
    "revision": "ab2201457d717ec90e78c1fb568e4e5c"
  }, {
    "url": "adaptive-icon.png",
    "revision": "45a90da6178dbdbea1bb25fc5ca02cee"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/web-DuG9Ufp9.js",
    "revision": null
  }, {
    "url": "assets/web-DHWAVnpU.js",
    "revision": null
  }, {
    "url": "assets/purify.es-CYR4BTuT.js",
    "revision": null
  }, {
    "url": "assets/index.es-DXk7I3OJ.js",
    "revision": null
  }, {
    "url": "assets/index-MuEJF-8-.js",
    "revision": null
  }, {
    "url": "assets/index-BPkgCHSk.css",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-QH1iLAAe.js",
    "revision": null
  }, {
    "url": "adaptive-icon.png",
    "revision": "45a90da6178dbdbea1bb25fc5ca02cee"
  }, {
    "url": "android-chrome-192x192.png",
    "revision": "8ebfa332731f09e35bf30d2543e1e353"
  }, {
    "url": "android-chrome-512x512.png",
    "revision": "e4535069d9d6752d756afbf9062f02d5"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "fe5ef35973559d46787c02c2b1bb253d"
  }, {
    "url": "favicon-16x16.png",
    "revision": "369ac38c152fa9476aa643e63bf5bdcb"
  }, {
    "url": "favicon-32x32.png",
    "revision": "da22ac3e2c2c74c1c9b573e35586a650"
  }, {
    "url": "favicon.png",
    "revision": "26e3ae31a073360357c03c435967eaaf"
  }, {
    "url": "favicon.svg",
    "revision": "78ec88bed37062b4616bf69b1f66f51b"
  }, {
    "url": "icon.png",
    "revision": "d63e69dade0f7effbb676285bc2b3b77"
  }, {
    "url": "icon.svg",
    "revision": "cdbdd088aecc021cc198e9ac90f1c1fb"
  }, {
    "url": "splash-icon.png",
    "revision": "7ae6b8c01706e9d743e48e7569146654"
  }, {
    "url": "manifest.webmanifest",
    "revision": "9db698166bd8b884b558158efc5678d7"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 15,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
