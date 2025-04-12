function init () {
	defop.Google = {
		defaultAttribution: ["Google"],
		fetchAttribution: ({layer}) => fetchGoogleAttribution(layer),
		maxZoom: 22,
		tmpURL: layer => `//mt.google.com/vt?lyrs=${layer}&x={x}&y={y}&z={z}`
	};
	imagery.Google = L.tileLayer(defop.Google.tmpURL("s"), {
		...defop.Google,
		layer: 1
	});
	maps.Google = L.tileLayer(defop.Google.tmpURL("h"), {
		...defop.Google,
		layer: 0,
		pane: "overlayPane"
	});
	defop.Apple = {
		defattr: tileSource => [`<a href="${appleBootstrap.attributions.find(a => a.attributionId === appleBootstrap.tileSources.find(s => s.tileSource === tileSource).attributionId).global[0]}">Apple</a>`],
		fetchAttribution: () => maps.Apple.options.defaultAttribution,
		accessKey: () => encodeURIComponent(appleBootstrap.accessKey),
		maxZoom: 22,
		subdomains: ["", 1, 2, 3, 4],
		tmpURL: (cdn, path, style) => `//${cdn}cdn{s}.apple-mapkit.com/${path}tile?x={x}&y={y}&z={z}&v={v}&accessKey={accessKey}&style=${style}`,
		v: data => appleBootstrap.tileSources.find(s => s.tileSource === data.tileSource).path.match(/v=(\d+)/)[1]
	};
	imagery.Apple = L.tileLayer(defop.Apple.tmpURL("sat-", "", "7"), {
		...defop.Apple,
		defaultAttribution: defop.Apple.defattr("satellite"),
		tileSource: "satellite"
	});
	maps.Apple = L.tileLayer(defop.Apple.tmpURL("", "ti/", "46&size=1&scale=1&poi=1"), {
		...defop.Apple,
		defaultAttribution: defop.Apple.defattr("hybrid-overlay"),
		pane: "overlayPane",
		tileSource: "hybrid-overlay"
	});
	defop.Esri = {
		defaultAttribution: ["Esri"],
		fetchAttribution: async ({contributors}) => (await contributors)
			.filter(c => c.coverageAreas.some(a => map.getZoom() >= a.zoomMin && map.getZoom() <= a.zoomMax && map.getBounds().overlaps(pairify(a.bbox))))
			.map(c => c.attribution),
		maxNativeZoom: 19,
		maxZoom: 22,
		getattr: layer => fetch(`//static.arcgis.com/attribution/${layer}`)
			.then(r => r.json())
			.then(r => r.contributors),
		tmpURL: layer => `//{s}.arcgisonline.com/arcgis/rest/services/${layer}/MapServer/tile/{z}/{y}/{x}?blankTile=false`,
		subdomains: ["server", "services"]
	};
	imagery.Esri = L.tileLayer(defop.Esri.tmpURL("World_Imagery"), {
		...defop.Esri,
		contributors: defop.Esri.getattr("World_Imagery"),
		maxNativeZoom: 21,
		maxZoom: 22
	});
	maps.Esri = L.layerGroup([
		L.tileLayer(defop.Esri.tmpURL("Reference/World_Transportation"), {
			...defop.Esri,
			contributors: defop.Esri.getattr("Reference/World_Transportation"),
			pane: "overlayPane"
		}),
		L.tileLayer(defop.Esri.tmpURL("Reference/World_Boundaries_and_Places"), {
			...defop.Esri,
			contributors: defop.Esri.getattr("Reference/World_Boundaries_and_Places"),
			pane: "overlayPane"
		})
	], {
		...defop.Esri,
		fetchAttribution: async () => (await Promise.all(Object.values(maps.Esri._layers).map(l => l.options.fetchAttribution(l.options)))).flat()
	});
	defop.Bing = {
		defaultAttribution: ["Microsoft"],
		fetchAttribution: ({layer}) => fetchBingAttribution(layer),
		maxZoom: 22,
		q: ({x, y, z}) => Array.from(Array(z).keys(), i => Boolean(x & 1 << i) + 2 * Boolean(y & 1 << i)).reverse()
			.join(""),
		tmpURL: (subcdn, path, query) => `//t{s}.${subcdn}tiles.virtualearth.net/${path}{q}?${query}`
	};
	imagery.Bing = new L.TileLayer(defop.Bing.tmpURL("", "tiles/a", "g=1"), {
		...defop.Bing,
		layer: "Aerial",
		maxNativeZoom: 20,
		subdomains: [0, 1, 2, 3]
	});
	maps.Bing = new L.TileLayer(defop.Bing.tmpURL("ssl.ak.dynamic.", "comp/ch/", "it=z,g,l"), {
		...defop.Bing,
		layer: "Road",
		maxNativeZoom: 21,
		pane: "overlayPane",
		subdomains: ["", 0, 1, 2, 3, 4, 5, 6, 7]
	});
	defop.TomTom = {
		attrPromise: fetch("//api.tomtom.com/map/2/copyrights/caption.json?key=xWH4ZowLJkTPJgfGPAyDAArSDjyROMxl").then(r => r.json()),
		defaultAttribution: ["TomTom"],
		fetchAttribution: async ({attrPromise}) => [(await attrPromise).copyrightsCaption],
		key: "xWH4ZowLJkTPJgfGPAyDAArSDjyROMxl",
		tmpURL: (layer, format) => `//{s}api.tomtom.com/map/1/tile/${layer}/main/{z}/{x}/{y}.${format}?key={key}`,
		subdomains: ["", "a.", "b.", "c.", "d."]
	};
	imagery.TomTom = new L.TileLayer(defop.TomTom.tmpURL("sat", "jpg"), {
		...defop.TomTom,
		maxNativeZoom: 19,
		maxZoom: 22
	});
	maps.TomTom = new L.TileLayer(defop.TomTom.tmpURL("hybrid", "png"), {
		...defop.TomTom,
		maxZoom: 22,
		pane: "overlayPane"
	});
	defop.Here = {
		defaultAttribution: ["Here"],
		fetchAttribution: async ({contributors, scheme}) => (await contributors)[scheme]
			.filter(c => map.getZoom() >= c.minLevel && map.getZoom() <= c.maxLevel)
			.filter(c => !c.boxes || c.boxes.some(a => map.getBounds().overlaps(pairify(a))))
			.map(c => c.label),
		maxNativeZoom: 20,
		maxZoom: 22,
		getattr: layer => fetch(`//1.${layer}.maps.ls.hereapi.com/maptile/2.1/copyright/newest?apikey=aRrXMN6rNeDunujbIgCqESvkttKlk4Pp2j5N7xTp4Ek`).then(r => r.json()),
		tmpURL: (type, scheme, format) => `//{s}.aerial.maps.ls.hereapi.com/maptile/2.1/${type}tile/newest/${scheme}.day/{z}/{x}/{y}/256/${format}?apikey=aRrXMN6rNeDunujbIgCqESvkttKlk4Pp2j5N7xTp4Ek`,
		subdomains: [1, 2, 3, 4]
	};
	imagery.Here = L.tileLayer(defop.Here.tmpURL("base", "satellite", "jpg"), {
		...defop.Here,
		contributors: defop.Here.getattr("aerial"),
		scheme: "satellite"
	});
	maps.Here = L.tileLayer(defop.Here.tmpURL("street", "hybrid", "png"), {
		...defop.Here,
		contributors: defop.Here.getattr("base"),
		pane: "overlayPane",
		scheme: "normal"
	});
	imagery.Stadia = L.tileLayer("//tiles{s}.stadiamaps.com/data/imagery/{z}/{x}/{y}.jpg", {
		defaultAttribution: ['<a href="//stadiamaps.com">Stadia Maps</a>', "CNES, Distribution Airbus DS", "Airbus DS", "PlanetObserver (Contains Copernicus Data)"],
		fetchAttribution: ({defaultAttribution}) => defaultAttribution,
		maxNativeZoom: 18,
		maxZoom: 22,
		tileSize: 512,
		subdomains: ["", "-eu"],
		zoomOffset: -1
	});
	maps.Omniscale = L.tileLayer("//maps.omniscale.net/v2/roundup-9e599d79/style.default/layers.admin,roads,labels,housenumbers,pois/{z}/{x}/{y}.png", {
		defaultAttribution: ['<a href="//maps.omniscale.com">Omniscale</a>', '<a href="//osm.org/copyright">OpenStreetMap</a> contributors'],
		fetchAttribution: ({defaultAttribution}) => defaultAttribution,
		maxZoom: 22,
		pane: "overlayPane"
	});
	new L.Control.Layers(imagery, maps).addTo(map);
}
async function fetchGoogleAttribution (e) {
	const bbox = [["South", "West"], ["North", "East"]].map((m, i) =>
			`!${i + 5}m2${Array.from(
				new Uint32Array(new Int32Array(m.map(d => map.getBounds()[`get${d}`]() * 1e7)).buffer),
				(l, i) => `!${i + 1}x${l}`
			).join("")}`
		).join(""),
		url = `//www.google.com/maps/vt?pb=!1m8!4m7!2u${map.getZoom()}${bbox}!2m1!1e${e}!4e5`;
	arr = await fetch(url).then(r => r.json());
	arr = arr[0] || [];
	arr.unshift("Google");
	return arr;
}
async function fetchBingAttribution (e) {
	const query = ["South", "West", "North", "East"].map(d => map.getBounds()[`get${d}`]());
	query.unshift(e, map.getZoom());
	const url = `//dev.virtualearth.net/REST/V1/Imagery/Copyright/auto/${query.join("/")}?key=AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L`;
	arr = await fetch(url).then(r => r.json());
	arr = arr?.resourceSets
		?.map(s => s?.resources?.map(r => r?.imageryProviders))
		?.flat()
		?.flat() || [];
	arr.unshift("Microsoft");
	return arr;
}
const map = L.map("map").fitWorld(),
	defop = {},
	maps = {},
	imagery = {},
	refreshAppleBootstrap = () => fetch("/bootstrap").then(r => r.json())
		.then(b => appleBootstrap = b)
		.then(() => setTimeout(refreshAppleBootstrap, appleBootstrap.accessKey.split("_")[0] * 1000 - Date.now() || 7 ** 5)),
	pairify = arr => arr.reduce((a, c, i, r) => i % 2 ? a.push([r[i - 1], c]) && a : a, []);
let appleBootstrap = new L.Hash(map);
map.attributionControl._update = function () {
	const layerPromises = [],
		affectedLayers = [];
	for (const layer of [...Object.values(maps), ...Object.values(imagery)]) {
		if (!Object.values(map._layers).includes(layer) || !layer.options.fetchAttribution) {
			if (layer.options.currentAttribution) continue;
			layer.options.currentAttribution = layer.options.defaultAttribution;
		}
		layerPromises.push(layer.options.fetchAttribution(layer.options));
		affectedLayers.push(layer);
	}
	Promise.all(layerPromises).then(results => {
		for (const [index, attribution] of results.entries()) {
			if (!attribution) continue;
			affectedLayers[index].options.currentAttribution = attribution;
		}
		this.attributionControl._collect();
	});
};
map.attributionControl._collect = function () {
	let attrarr = Object.values(map._layers)
		.map(l => l.options.currentAttribution)
		.map(f => typeof f === "function" ? f() : f)
		.flat()
		.filter(l => l)
		.map(s => s.replaceAll(new RegExp(`${String.fromCharCode(169)} ?`, "g"), "").replace(`${new Date().getFullYear()} `, ""))
		.sort((a, b) => a.replaceAll(/<[^>]+>/g, "").localeCompare(b.replaceAll(/<[^>]+>/g, "")));
	attrarr = [...new Set(attrarr)];
	this._container.innerHTML = `${this.options.prefix} <span aria-hidden="true">|</span> &copy; ${new Date().getFullYear()} ${attrarr.join(", ")}`;
};
map.on("moveend layeradd layerremove", map.attributionControl._update);
refreshAppleBootstrap().then(init);
