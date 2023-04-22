const v="v1.2";
self.addEventListener("install",e=>{
	e.waitUntil(caches.open(v).then(cache=>
		cache.addAll(["index.html","vent.mp4","manifest.json"]
			.map(r=>new Request(r,{cache:"reload",mode:"same-origin"})))
	))
}),
	self.addEventListener("fetch",e=>{
		let update=async(event,fetch)=>{
				let response=await fetch;
				if(response.status!=200||response.type==='opaqueredirect')return;
				let clone=response.clone(),
					cache=await caches.open(v);
				cache.put(event.request,clone);
			},
			handle=async event=>{
				let cacheResponse=await caches.match(event.request)||0;
				let request=event.request;
				if((new URL(event.request.url)).origin===location.origin)
					request=new Request(event.request,{headers:{
							...Object.fromEntries(event.request.headers.entries()),
							'if-none-match':cacheResponse?.headers?.get('etag')||"0"
						}});
				let fetchResponse=fetch(request);
				update(event,fetchResponse);
				return cacheResponse||fetchResponse
			};
		e.respondWith(handle(e))
	}),
	self.addEventListener("activate",e=>{
		e.waitUntil(caches.keys().then(c=>
			Promise.all(c.map(n=>[v].includes(n)||caches.delete(n)))
		))
	});
