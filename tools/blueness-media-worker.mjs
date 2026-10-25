// Cloudflare Worker for Blueness. Serving the video bytes from the page's own
// origin is what lets iPhone Safari read their pixels: the D1 device test
// showed CORS alone is rejected (SecurityError).
// - cloudflare/blueness-pages: page as static assets + relay on *.workers.dev.
// - cloudflare/blueness-media: relay only, routed on enricoisidori.com.
import {createBluenessMediaHandler} from './blueness-media-core.mjs';
const handle=createBluenessMediaHandler();
export default {fetch:(request,env)=>new URL(request.url).pathname.startsWith('/__blueness_media/')||!env?.ASSETS?handle(request):env.ASSETS.fetch(request)};
