function getLayers () {
	const arcgis = arcgisUtils();
	const apple = appleUtils();
	const bing = bingUtils();
	const google = googleUtils();
	const here = hereUtils();
	const tomtom = tomtomUtils();
	return {
		imagery: {
			apple: getAppleSatelliteLayer(apple),
			bing: getBingImageryLayer(bing),
			esri: getEsriImageryLayer(arcgis),
			google: getGoogleSatelliteLayer(google),
			here: getHereSatelliteLayer(here),
			stadia: getStadiaSatelliteLayer(),
			tomtom: getTomtomSatelliteLayer(tomtom)
		},
		overlays: {
			apple: getAppleHybridLayer(apple),
			bing: getBingHybridLayer(bing),
			esri: getEsriHybridLayer(arcgis),
			google: getGoogleHybridLayer(google),
			mapquest: getMapquestHybridLayer(here), // Here itself has no hybrid json afaict so mapquest style instead
			osm: getOSMLayer(),
			tomtom: getTomtomHybridLayer(tomtom)
		}
	};
}
const ish = maybe => Promise.all([maybe]).then(a => a[0]);
const {imagery, overlays} = getLayers();
const map = new maplibregl.Map({
	container: document.querySelector("main"),
	hash: true,
	maplibreLogo: false,
	maxPitch: 70,
	maxZoom: 24,
	style: {
		version: 8,
		sources: {},
		layers: [],
		glyphs: "/mapglyphs/{fontstack}/{range}"
	}
});
map.addControl(new maplibregl.NavigationControl(), "top-right");
buildList("imagery", imagery, "radio");
buildList("overlays", overlays, "checkbox");
map.once("load", () =>
	map._controlContainer.querySelector(".maplibregl-ctrl-top-left")?.appendChild(document.querySelector("form"))
);
map.overlapsWithBounds = bbox =>
	map.getBounds().getNorth() >= bbox[0] &&
        map.getBounds().getEast() >= bbox[1] &&
        map.getBounds().getSouth() <= bbox[2] &&
        map.getBounds().getWest() <= bbox[3];

function buildList (id, layers, type) {
	const container = document.getElementById(id);
	Object.entries(layers)
		.sort(([, a], [, b]) => a.name.localeCompare(b.name))
		.forEach(([value, layer]) => {
			if (layer.getAttribution) layer.onMoveEnd = () => Object.keys(layer.sources).forEach(id => layer.getAttribution(map.getSource(id)).then(() => map._controls.forEach(c => c._updateAttributions?.())));
			const label = document.createElement("label");
			const input = document.createElement("input");
			input.id = `${container.id}-${value}`;
			label.htmlFor = input.id;
			input.type = type;
			input.name = container.id;
			input.value = value;
			input.dataset.checked = false;
			label.title = layer.title;
			label.appendChild(input);
			label.appendChild(document.createTextNode(layer.name));
			container.appendChild(label);
		});
	container.addEventListener("change", async () => {
		for (const input of container.querySelectorAll("input:checked[data-checked='false']")) {
			const layer = layers[input.value];
			for (const [id, source] of Object.entries(await ish(layer.sources))) {
				await layer.update?.(source);
				map.addSource(id, source);
				layer.onMoveEnd?.();
			}
			(await ish(layer.sprite))?.forEach(sprite => map.addSprite(sprite.id, sprite.url));
			(await ish(layer.layers)).forEach(layer => map.addLayer(layer,
				id === "imagery" ? map.getLayersOrder()[0] : undefined
			));
			if (layer.onMoveEnd) map.on("moveend", layer.onMoveEnd);
			input.dataset.checked = true;
		}
		for (const input of container.querySelectorAll("input:not(:checked)[data-checked='true']")) {
			const layer = layers[input.value];
			(await ish(layer.layers)).forEach(layer => map.removeLayer(layer.id));
			for (const id of Object.keys(await ish(layer.sources))) map.removeSource(id);
			(await ish(layer.sprite))?.forEach(sprite => map.removeSprite(sprite.id));
			if (layer.onMoveEnd) map.off("moveend", layer.onMoveEnd);
			input.dataset.checked = false;
		}
	});
}

function arcgisUtils () {
	return {
		getAttribution (contributors) {
			return contributors
				.filter(c => c.coverageAreas.some(a => map.getZoom() >= a.zoomMin && map.getZoom() <= a.zoomMax && map.overlapsWithBounds(a.bbox)))
				.map(c => c.attribution)
				.join(", ");
		},
		getContributors (service) {
			return fetch(`https://static.arcgis.com/attribution/${service}`)
				.then(r => r.json())
				.then(r => r.contributors);
		}
	};
}

function appleUtils () {
	return {
		bootstrap: {},
		async ensureBootstrap () {
			if (this.bootstrap?.accessKey?.split("_")[0] - 30 > Date.now() / 1000) return;
			this.bootstrap = await fetch("/bootstrap").then(r => r.json());
		},
		getAttribution (source) {
			return this.bootstrap
				.attributions
				.find(a => a.attributionId === this.bootstrap.tileSources.find(s => s.tileSource === source).attributionId)
				.global
				.map(a => `<a href="${a.url}">${a.name + (a.name.length < 2 ? "Apple" : "")}</a>`)
				.join(", ");
		},
		getTiles (source, discardParams) {
			let path = this.bootstrap.tileSources.find(s => s.tileSource === source).path.replaceAll(/(\{|\})+/g, "$1");
			for (const [param, value] of discardParams) path = path.replace(param, value || "");
			return this.bootstrap
				.tileSources
				.find(s => s.tileSource === source)
				.domains
				.flatMap(d => ["", 1, 2, 3, 4].flatMap(s => d.replace(".", `${s}.`)))
				.map(d => `https://${d}${path}`);
		}
	};
}

function getAppleHybridLayer (apple) {
	return {
		name: "Apple",
		title: "Apple Hybrid",
		sources: {
			"apple-hybrid": {
				type: "raster",
				tiles: [],
				maxzoom: 21,
				tileSize: 256,
				attribution: "Apple"
			}
		},
		layers: [
			{
				id: "apple-hybrid",
				type: "raster",
				source: "apple-hybrid"
			}
		],
		async update (source) {
			await apple.ensureBootstrap();
			source.tiles = apple.getTiles("hybrid-overlay", [["{tileSizeIndex}", 1], ["{resolution}", 1], ["&lang={lang}"]]);
		},
		async getAttribution (source) {
			await apple.ensureBootstrap();
			source.attribution = apple.getAttribution("hybrid-overlay");
		}
	};
}

function getAppleSatelliteLayer (apple) {
	return {
		name: "Apple",
		title: "Apple Satellite",
		sources: {
			"apple-satellite": {
				type: "raster",
				tiles: [],
				maxzoom: 22,
				tileSize: 256,
				attribution: "Apple"
			}
		},
		layers: [
			{
				id: "apple-satellite",
				type: "raster",
				source: "apple-satellite"
			}
		],
		async update (source) {
			await apple.ensureBootstrap();
			source.tiles = apple.getTiles("satellite", [["&size={tileSizeIndex}"], ["&scale={resolution}"]]);
		},
		async getAttribution (source) {
			await apple.ensureBootstrap();
			source.attribution = apple.getAttribution("satellite");
		}
	};
}

function bingUtils () {
	const domains = ["", 0, 1, 2, 3, 4, 5, 6, 7].map(s => `https://t${s}.ssl.ak.tiles.virtualearth.net/`);
	return {
		dynamicDomains: domains.map(l => l.replace("tiles", "dynamic.tiles")),
		domains,
		async getAttribution (layer) {
			const bbox = map
				.getBounds()
				.toArray()
				.flat()
				.join("/");
			const url = `//dev.virtualearth.net/REST/V1/Imagery/Copyright/auto/${layer}/${Math.round(map.getZoom())}/${bbox}?key=AuhiCJHlGzhg93IqUH_oCpl_-ZUrIE6SPftlyGYUvr9Amx5nzA-WqGcPquyFZl4L`;
			const resp = await fetch(url).then(r => r.json());
			const arr = resp?.resourceSets?.flatMap(r => r?.resources)?.flatMap(r => r?.imageryProviders);
			return [...new Set(["Microsoft", ...arr.flat()])].sort().join(", ");
		}
	};
}

function getBingHybridLayer (bing) {
	return {
		name: "Bing",
		title: "Bing Labels",
		sources: {
			"bing-mvt": {
				type: "vector",
				tiles: bing.dynamicDomains.map(d => `${d}comp/ch/{z}-{x}-{y}.mvt?it=G,AP,L,LA&js=1&mvt=1&features=mvt&og=0&sv=9.33`),
				maxzoom: 21,
				attribution: "Microsoft"
			}
		},
		sprite: [
			{
				id: "bing-sprite",
				url: `${location.origin}/mapassets/bing/sprite`
			}
		],
		layers: fetch("https://www.bing.com/maps/style?styleid=hybrid")
			.then(r => r.text())
			.then(text => JSON.parse(text.replaceAll(/"icon-image":[^:]+,/g, match => match.replaceAll(/"(bkt|text|image|shield)/g, '"bing-sprite:$1'))))
			.then(b => b.layers.filter(l => l.source === "bing-mvt")),
		async getAttribution (source) {
			source.attribution = await bing.getAttribution("Road");
		}
	};
}

function getBingImageryLayer (bing) {
	return {
		name: "Bing",
		title: "Bing Aerial",
		sources: {
			"bing-aerial": {
				type: "raster",
				tiles: bing.domains.map(d => `${d}tiles/a{quadkey}.jpeg?g=0`),
				maxzoom: 20,
				tileSize: 256,
				attribution: "Microsoft"
			}
		},
		layers: [
			{
				id: "bing-aerial",
				type: "raster",
				source: "bing-aerial"
			}
		],
		async getAttribution (source) {
			source.attribution = await bing.getAttribution("Aerial");
		}
	};
}

function getEsriHybridLayer (arcgis) {
	function prepare (text) {
		return JSON.parse(text.replaceAll(/"icon-image":[\w\W]+?["}],/g, match => match.replaceAll(/"([A-Z][^"]+)"/g, '"world-basemap:$1"')));
	}
	const basemapURL = "https://cdn.arcgis.com/sharing/rest/content/items/da44d3524641418b936b74b48f0e3060/resources/";
	const style = fetch(`${basemapURL}styles/root.json`)
		.then(r => r.text())
		.then(prepare);
	return {
		name: "Esri",
		title: "Esri Hybrid Reference",
		sources: {
			esri: {
				type: "vector",
				tiles: ["https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf"],
				maxzoom: 22,
				attribution: "Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community"
			}
		},
		sprite: [
			{
				id: "world-basemap",
				url: `${basemapURL}sprites/sprite`
			}
		],
		layers: style.then(h => h.layers),
		async getAttribution (source) {
			if (!this.contributors) this.contributors = await arcgis.getContributors("Vector/World_Basemap_v2");
			source.attribution = arcgis.getAttribution(this.contributors);
		}
	};
}

function getEsriImageryLayer (arcgis) {
	return {
		name: "Esri",
		title: "Esri World Imagery",
		sources: {
			"esri-imagery": {
				type: "raster",
				tiles: ["server", "services"].map(s => `https://${s}.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false`),
				maxzoom: 21,
				tileSize: 256,
				attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community"
			}
		},
		layers: [
			{
				id: "esri-imagery",
				type: "raster",
				source: "esri-imagery"
			}
		],
		async getAttribution (source) {
			if (!this.contributors) this.contributors = await arcgis.getContributors("World_Imagery");
			source.attribution = arcgis.getAttribution(this.contributors);
		}
	};
}

function googleUtils () {
	const tlds = ["ad", "ae", "com.ag", "com.ai", "co.ao", "it.ao", "com.ar", "as", "at", "com.au", "ba", "com.bd", "be", "bf", "bg", "com.bh", "bi", "bj", "com.bn", "com.bo", "com.br", "bs", "bt", "co.bw", "by", "com.bz", "ca", "cat", "cd", "cf", "cg", "ch", "ci", "co.ck", "cl", "cm", "com.co", "com", "co.cr", "com.cu", "cv", "cz", "de", "dj", "dk", "dm", "com.do", "dz", "com.ec", "ee", "com.eg", "es", "com.et", "fi", "com.fj", "fm", "fr", "ga", "ge", "gg", "com.gh", "gl", "gm", "gp", "gr", "com.gr", "com.gt", "gy", "hk", "com.hk", "hn", "hr", "ht", "hu", "co.hu", "co.id", "ie", "co.il", "im", "co.in", "iq", "is", "it", "je", "com.jm", "jo", "jp", "co.jp", "ne.jp", "co.ke", "kg", "com.kh", "ki", "co.kr", "com.kw", "kz", "la", "com.lb", "li", "lk", "co.ls", "lt", "lv", "com.ly", "mg", "mk", "ml", "com.mm", "mn", "ms", "com.mt", "mu", "mv", "mw", "com.mx", "co.mz", "com.na", "ng", "com.ng", "com.ni", "nl", "no", "com.np", "nu", "co.nz", "com.om", "com.pa", "com.pe", "com.pg", "com.ph", "pl", "com.pl", "pn", "com.pr", "pt", "com.py", "com.qa", "ro", "rs", "ru", "com.ru", "rw", "com.sa", "com.sb", "sc", "se", "com.sg", "sh", "si", "sk", "com.sl", "sm", "sn", "so", "st", "com.sv", "td", "tg", "co.th", "tk", "tl", "tn", "to", "com.tr", "tt", "com.tw", "co.tz", "co.uk", "co.ve", "vg", "co.vi", "vu", "ws", "co.za", "co.zm", "co.zw"];
	const subdomains = ["", "www.", "maps."];
	const domains = tlds.flatMap(t => subdomains.map(s => `https://${s}google.${t}/maps/vt?pb=`));
	return {
		makeTiles: path => domains.map(d => d + path),
		async getAttribution (layerId) {
			const encoded = map.getBounds().toArray()
					.map((m, i) => `!${i + 5}m2${Array.from(
						new Uint32Array(new Int32Array(m.map(d => d * 1e7).reverse()).buffer),
						(l, i) => `!${i + 1}x${l}`
					).join("")}`)
					.join(""),
				randomDomain = domains[Math.floor(Math.random() * domains.length)],
				url = `${randomDomain}!1m8!4m7!2u${Math.floor(map.getZoom())}${encoded}!2m1!1e${layerId}!4e5`,
				arr = await fetch(url).then(r => r.json());
			return [...new Set(["Google", ...arr.flat()])].sort().join(", ");
		}
	};
}

function getGoogleHybridLayer (google) {
	return {
		name: "Google",
		title: "Google Hybrid",
		sources: {
			"google-hybrid": {
				type: "raster",
				tiles: google.makeTiles("!1m4!1m3!1i{z}!2i{x}!3i{y}!2m1!1e0!3m5!12m4!1e4!2m2!1sset!2sRoadmapSatellite"),
				maxzoom: 22,
				tileSize: 256,
				attribution: "Google"
			}
		},
		layers: [
			{
				id: "google-hybrid",
				type: "raster",
				source: "google-hybrid"
			}
		],
		async getAttribution (source) {
			source.attribution = await google.getAttribution(0);
		}
	};
}

function getGoogleSatelliteLayer (google) {
	return {
		name: "Google",
		title: "Google Satellite",
		sources: {
			"google-satellite": {
				type: "raster",
				tiles: google.makeTiles("!1m4!1m3!1i{z}!2i{x}!3i{y}!2m1!1e1"),
				maxzoom: 22,
				tileSize: 256,
				attribution: "Google"
			}
		},
		layers: [
			{
				id: "google-satellite",
				type: "raster",
				source: "google-satellite"
			}
		],
		async getAttribution (source) {
			source.attribution = await google.getAttribution(1);
		}
	};
}

function hereUtils () {
	return {
		apiKey: "apiKey=aRrXMN6rNeDunujbIgCqESvkttKlk4Pp2j5N7xTp4Ek",
		async getAttribution (...copyrights) {
			if (!this.copyrights) this.copyrights = await fetch(`https://maps.hereapi.com/v3/copyright?${this.apiKey}`)
				.then(r => r.json())
				.then(r => r.copyrights);
			const additionalCopyrights = copyrights.filter(c => !this.copyrights[c]);
			const arr = copyrights
				.flatMap(c => this.copyrights[c])
				.filter(c =>
					c &&
                    map.getZoom() >= c.minLevel &&
                    map.getZoom() <= c.maxLevel &&
                    c.boundingBoxes.some(b => map.overlapsWithBounds([b.south, b.west, b.north, b.east])))
				.map(c => c.label);
			return [...new Set([...arr, ...additionalCopyrights])].sort().join(", ");
		}
	};
}

function getHereSatelliteLayer (here) {
	return {
		name: "Here",
		title: "Here Satellite",
		sources: {
			"here-sat": {
				type: "raster",
				tiles: [`https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/jpeg?style=satellite.day&${here.apiKey}`],
				maxzoom: 20,
				tileSize: 256,
				attribution: "Here, Maxar"
			}
		},
		layers: [
			{
				id: "here-sat",
				type: "raster",
				source: "here-sat"
			}
		],
		async getAttribution (source) {
			source.attribution = await here.getAttribution("Here", "sat");
		}
	};
}

function getMapquestHybridLayer (here) {
	function prepare (text) {
		return JSON.parse(text.replaceAll(/"icon-image":[\w\W]+?"[^"]+":/g, match => match.replaceAll(/"(marker|shield|parking|pom|junction|oneway)/g, '"mapquest:$1')));
	}
	const style = fetch("https://styles.mapq.st/styles/satellite")
		.then(r => r.text())
		.then(prepare);
	return {
		name: "Mapquest",
		title: "Mapquest Hybrid",
		sources: style.then(m =>
			Object.fromEntries(
				Object.entries(m.sources)
					.filter(([, s]) => s.type === "vector")
					.map(([k, v]) => [
						k,
						{
							...v,
							attribution: "Mapquest"
						}
					])
			)
		),
		sprite: style.then(m => [
			{
				id: "mapquest",
				url: m.sprite
			}
		]),
		layers: style.then(m => m.layers.filter(l => l["source-layer"])),
		async getAttribution (source) {
			source.attribution = await here.getAttribution("Mapquest", "Here", "in", "jp");
		}
	};
}

function getOSMLayer () {
	function makeHybrid (colorful) {
		delete colorful.sources["versatiles-shortbread"];
		colorful.sources.osmv = {
			type: "vector",
			url: "https://vector.openstreetmap.org/shortbread_v1/tilejson.json"
		};
		colorful.layers.filter(l => l.source === "versatiles-shortbread").forEach(l => l.source = "osmv");
		colorful.layers = colorful.layers.filter(l => l.type !== "fill" && l.type !== "background" && l["source-layer"] !== "water_lines" && l["source-layer"] !== "dam_lines" && l["source-layer"] !== "pier_lines");
		colorful.glyphs = colorful.glyphs.replace("/demo/shortbread/fonts", "https://tiles.versatiles.org/assets/glyphs");
		colorful.sprite[0].url = colorful.sprite[0].url.replace("/demo/shortbread", "https://tiles.versatiles.org/assets");
		colorful.layers.filter(l => l.type === "line").forEach(l => delete l.minzoom);
		colorful.layers.filter(l => l.type === "line" && typeof l.paint["line-opacity"] !== "object").forEach(l => l.paint["line-opacity"] = {stops: [[15, l.paint["line-opacity"] ?? 1]]});
		colorful.layers.filter(l => l.type === "line").map(l => l.paint["line-opacity"].stops.at(-1)[0] = Math.min(l.paint["line-opacity"].stops.at(-1)[0], 15));
		colorful.layers.filter(l => l.type === "line").map(l => l.paint["line-opacity"].stops.push([20, 0]));
		colorful.layers.find(l => l.id === "transport-rail-service:outline").paint["line-width"].stops.shift();
		return colorful;
	}
	const style = fetch("versatilescolorful.json")
		.then(r => r.json())
		.then(makeHybrid);

	return {
		name: "OSM",
		title: "OpenStreetMap",
		sources: {
			osmv: {
				type: "vector",
				url: "https://vector.openstreetmap.org/shortbread_v1/tilejson.json"
			}
		},
		layers: style.then(h => h.layers),
		sprite: style.then(h => h.sprite)
	};
}

function getStadiaSatelliteLayer () {
	return {
		name: "Stadia",
		title: "Stadia Maps Satellite",
		sources: {
			"stadia-sat": {
				type: "raster",
				url: "https://tiles.stadiamaps.com/data/imagery.json",
				maxzoom: 24
			}
		},
		layers: [
			{
				id: "stadia-sat",
				type: "raster",
				source: "stadia-sat"
			}
		]
	};
}

async function tomtomUtils () {
	const keyData = await fetch("/tomtomkey").then(r => r.json());
	const url = `https://api.tomtom.com/style/1/style/24.4.*?map=2/basic_street-satellite&poi=2/poi_dynamic-satellite&key=${keyData.key}`;
	const text = await fetch(url).then(r => r.text());
	const style = JSON.parse(
		text.replaceAll(/"icon-image":[^:]+,/g, match => match.replaceAll(/"({|traffic_)/g, '"tomtom:$1'))
			.replaceAll('"Noto', `"${keyData.key}/Noto`)
	);
	for (const source of Object.values(style.sources)) source.attribution = "TomTom";
	const {satellite, ...labels} = style.sources;
	return {
		style,
		keyData,
		categorizedSources: {
			labels,
			satellite: {satellite}
		},
		getLayersFromSources: sources => style.layers.filter(l => Object.keys(sources).includes(l.source))
	};
}

function getTomtomHybridLayer (tomtom) {
	return {
		name: "TomTom",
		title: "TomTom Hybrid",
		sprite: tomtom.then(t => [
			{
				id: "tomtom",
				url: t.style.sprite
			}
		]),
		sources: tomtom.then(t => t.categorizedSources.labels),
		layers: tomtom.then(t => t.getLayersFromSources(t.categorizedSources.labels))
	};
}

function getTomtomSatelliteLayer (tomtom) {
	return {
		name: "TomTom",
		title: "TomTom Satellite",
		sources: tomtom.then(t => t.categorizedSources.satellite),
		layers: tomtom.then(t => t.getLayersFromSources(t.categorizedSources.satellite))
	};
}
