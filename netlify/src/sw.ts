// @ts-ignore
import {getRedirectResponse} from "../edge-functions/go/redirects.ts";

interface FetchEvent extends Event {
	request: Request;

	respondWith(response: Promise<Response> | Response): void;
}

self.addEventListener("fetch", (event: FetchEvent) => {
	const rr = getRedirectResponse(event.request);
	if (rr) event.respondWith(rr);
});
