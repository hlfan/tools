const v = "v1.2";
self.addEventListener("install", e => {
	e.waitUntil(caches.open(v).then(cache =>
		cache.addAll(["index.html", "vent.mp4", "manifest.json"]
			.map(r => new Request(r, {cache: "reload",
				mode: "same-origin"})))
	));
});
self.addEventListener("fetch", e => {
	const update = async (event, fetch) => {
			const response = await fetch;
			if (response.status !== 200 || response.type === "opaqueredirect") return;
			const clone = response.clone(),
				cache = await caches.open(v);
			cache.put(event.request, clone);
		},
		handle = async event => {
			const cacheResponse = await caches.match(event.request) || 0;
			let {request} = event;
			if (new URL(event.request.url).origin === location.origin) request = new Request(event.request, {headers: {
				...Object.fromEntries(event.request.headers.entries()),
				"if-none-match": cacheResponse?.headers?.get("etag") || "0"
			}});
			const fetchResponse = fetch(request);
			update(event, fetchResponse);
			return cacheResponse || fetchResponse;
		};
	e.respondWith(handle(e));
});
self.addEventListener("activate", e => {
	e.waitUntil(caches.keys().then(c =>
		Promise.all(c.map(n => [v].includes(n) || caches.delete(n)))
	));
});
