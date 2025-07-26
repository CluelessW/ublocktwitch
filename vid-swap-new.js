// ==UserScript==
// @name         Twitch Adblock + Force Chunked Quality
// @namespace    https://yourdomain.com/
// @version      1.0
// @description  Block Twitch ads and force highest quality (chunked) stream
// @author       OpenAI
// @match        https://player.twitch.tv/*
// @match        https://www.twitch.tv/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const OPT_MODE_NOTIFY_ADS_WATCHED = true;

    function hookFetch() {
        const originalFetch = window.fetch;
        window.fetch = async function(resource, init) {
            if (typeof resource === 'string') {
                // 🎯 Intercept GraphQL video playback config
                if (resource.includes('/gql')) {
                    const isPlaybackRequest = init?.body?.includes('PlaybackAccessToken') || init?.body?.includes('PlaybackAccessToken_Template');

                    if (isPlaybackRequest) {
                        const response = await originalFetch(resource, init);
                        const cloned = response.clone();
                        const json = await cloned.json();

                        try {
                            // 🛠 Modify to force "chunked" playback
                            for (const entry of json) {
                                if (entry?.data?.streamPlaybackAccessToken?.value) {
                                    const token = JSON.parse(entry.data.streamPlaybackAccessToken.value);
                                    token.player_type = 'site';
                                    token.quality = 'chunked';
                                    entry.data.streamPlaybackAccessToken.value = JSON.stringify(token);
                                }
                            }
                        } catch (e) {
                            console.warn('Could not force chunked quality:', e);
                        }

                        return new Response(JSON.stringify(json), {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers,
                        });
                    }
                }

                // 🎯 Intercept .m3u8 playlist to strip ad segments
                if (resource.includes('.m3u8')) {
                    const res = await originalFetch(resource, init);
                    const text = await res.text();

                    if (text.includes('#EXT-X-DATERANGE:CLASS="twitch-stitched-ad"')) {
                        console.log('[TwitchAdblock] Ad segment detected — blocking...');
                        if (OPT_MODE_NOTIFY_ADS_WATCHED) {
                            notifyAdsWatched(resource);
                        }
                        return new Response('', { status: 200 });
                    }

                    return new Response(text, { status: 200 });
                }
            }

            return originalFetch(resource, init);
        };
    }

    function notifyAdsWatched(uri) {
        // Optionally spoof ad views to help Twitch not suspect anything
        const payload = {
            event: 'video_ad_quartile',
            timestamp: Date.now(),
            data: {
                uri: uri,
                quartile: 'complete',
            }
        };
        navigator.sendBeacon('/track', JSON.stringify(payload));
    }

    function waitForTwitch() {
        if (typeof window.fetch === 'function') {
            hookFetch();
            console.log('[TwitchAdblock] Hooked fetch successfully.');
        } else {
            setTimeout(waitForTwitch, 500);
        }
    }

    waitForTwitch();
})();
