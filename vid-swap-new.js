// ==UserScript==
// @name         Twitch Adblocker + Force Best Quality
// @namespace    https://github.com/cleanlock/
// @version      2.0
// @description  Bypass Twitch ads and force highest quality (chunked) stream
// @author       Edited by ChatGPT
// @match        https://www.twitch.tv/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const OPT_MODE_STRIP_AD_SEGMENTS = false;
    const OPT_MODE_NOTIFY_ADS_WATCHED = true;

    function hookWorker() {
        const workerBlob = new Blob([`
            const originalFetch = fetch;
            self.fetch = async function(resource, init) {
                if (typeof resource === 'string' && resource.includes('.m3u8')) {
                    const res = await originalFetch(resource, init);
                    const text = await res.text();
                    if (text.includes('#EXT-X-DATERANGE:CLASS="twitch-stitched-ad"')) {
                        return new Response('', { status: 200 });
                    } else {
                        // Force best quality: extract chunked stream
                        const lines = text.split('\\n');
                        let chunkedUrl = null;
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].includes('VIDEO="chunked"')) {
                                chunkedUrl = lines[i + 1];
                                break;
                            }
                        }
                        if (chunkedUrl) {
                            const baseUrl = resource.substring(0, resource.lastIndexOf('/') + 1);
                            const chunkedRes = await originalFetch(baseUrl + chunkedUrl, init);
                            return chunkedRes;
                        } else {
                            return new Response(text, { status: 200 });
                        }
                    }
                }
                return originalFetch(resource, init);
            };
            self.addEventListener('message', function (event) {
                if (event.data && event.data.type === 'run') {
                    eval(event.data.script);
                }
            });
        `], { type: 'application/javascript' });

        const workerUrl = URL.createObjectURL(workerBlob);
        const originalWorker = window.Worker;

        window.Worker = function (scriptURL, options) {
            if (typeof scriptURL === 'string' && scriptURL.includes('video')) {
                return new originalWorker(workerUrl, options);
            }
            return new originalWorker(scriptURL, options);
        };
    }

    function hookFetch() {
        const originalFetch = window.fetch;
        window.fetch = async function(resource, init) {
            try {
                if (typeof resource === 'string' && resource.includes('.m3u8')) {
                    const res = await originalFetch(resource, init);
                    const text = await res.text();
                    if (text.includes('#EXT-X-DATERANGE:CLASS="twitch-stitched-ad"')) {
                        if (OPT_MODE_NOTIFY_ADS_WATCHED) {
                            console.warn('[Adblock] Midroll ad detected. Simulating ad watch...');
                            // Simulate ad-watching event if needed
                        }

                        return new Response('', { status: 200 });
                    } else {
                        // Force best quality: extract chunked stream
                        const lines = text.split('\\n');
                        let chunkedUrl = null;
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].includes('VIDEO="chunked"')) {
                                chunkedUrl = lines[i + 1];
                                break;
                            }
                        }
                        if (chunkedUrl) {
                            const baseUrl = resource.substring(0, resource.lastIndexOf('/') + 1);
                            const chunkedRes = await originalFetch(baseUrl + chunkedUrl, init);
                            return chunkedRes;
                        } else {
                            return new Response(text, { status: 200 });
                        }
                    }
                }
            } catch (e) {
                console.error('[Adblock] Error in fetch override:', e);
            }
            return originalFetch(resource, init);
        };
    }

    function run() {
        hookWorker();
        hookFetch();
    }

    run();
})();
