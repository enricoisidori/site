// Cloudflare Worker on the route enricoisidori.com/__blueness_media/*.
// Everything else on the domain stays on GitHub Pages. Serving the video bytes
// from the page's own origin is what lets iPhone Safari read their pixels:
// the D1 device test showed CORS alone is rejected (SecurityError).
import {createBluenessMediaHandler} from './blueness-media-core.mjs';
const handle=createBluenessMediaHandler();
export default {fetch:request=>handle(request)};
