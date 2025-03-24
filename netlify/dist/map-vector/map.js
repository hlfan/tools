(async function () {
    const arcgis = arcgisUtils();
    const apple = await appleUtils();
    const google = googleUtils();
    window.imagery = {
        apple: getAppleSatelliteLayer(apple),
        bing: getBingImageryLayer(),
        esri: await getEsriImageryLayer(arcgis),
        google: getGoogleSatelliteLayer(google)
    };
    window.overlays = {
        apple: getAppleHybridLayer(apple),
        esri: await getEsriHybridLayer(arcgis),
        google: getGoogleHybridLayer(google),
        osm: await getOSMLayer()
    };
    window.map = new maplibregl.Map({
        container: "map",
        hash: true,
        maplibreLogo: false,
        maxPitch: 90,
        maxZoom: 24,
        style: {
            version: 8,
            sources: {},
            layers: [],
            glyphs: "/mapglyphs/{fontstack}/{range}.pbf"
        }
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    buildList("imagery", imagery, "radio");
    buildList("overlays", overlays, "checkbox");
    map.once("load", () =>
        map._controlContainer.querySelector(".maplibregl-ctrl-top-left")?.appendChild(document.querySelector("#controls"))
    );
}());

function buildList (id, layers, type) {
    const container = document.getElementById(id);
    Object.entries(layers)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, layer]) => {
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.id = `${container.id}-${id}`;
            label.htmlFor = input.id;
            input.type = type;
            input.name = container.id;
            input.value = id;
            input.dataset.checked = false;
            label.appendChild(input);
            label.appendChild(document.createTextNode(layer.name));
            container.appendChild(label);
        });
    container.addEventListener("change", () => {
        const newlyChecked = container.querySelectorAll("input:checked[data-checked='false']");
        const newlyUnchecked = container.querySelectorAll("input:not(:checked)[data-checked='true']");
        for (const input of newlyChecked) {
            const layer = layers[input.value];
            Object.entries(layer.sources).forEach(entry => map.addSource(...entry));
            layer.sprite?.forEach(sprite => map.addSprite(sprite.id, sprite.url));
            layer.layers.forEach(layer => map.addLayer(layer,
                id === "imagery" ? map.getLayersOrder()[0] : undefined
            ));
            if (layer.onMoveEnd) map.on("moveend", layer.onMoveEnd);
            input.dataset.checked = true;
        }
        for (const input of newlyUnchecked) {
            const layer = layers[input.value];
            layer.layers.forEach(layer => map.removeLayer(layer.id));
            Object.keys(layer.sources).forEach(source => map.removeSource(source));
            layer.sprite?.forEach(sprite => map.removeSprite(sprite.id));
            if (layer.onMoveEnd) map.off("moveend", layer.onMoveEnd);
            input.dataset.checked = false;
        }
    });
}

function arcgisUtils () {
    return {
        getAttribution (map, contributors) {
            return contributors
                .filter(c => c.coverageAreas.some(a => map.getZoom() >= a.zoomMin && map.getZoom() <= a.zoomMax && (
                    map.getBounds().getNorth() >= a.bbox[0] &&
                    map.getBounds().getEast() >= a.bbox[1] &&
                    map.getBounds().getSouth() <= a.bbox[2] &&
                    map.getBounds().getWest() <= a.bbox[3]
                )))
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

async function appleUtils () {
    const fetchBootstrap = () => fetch("/bootstrap").then(r => r.json());
    return {
        bootstrap: await fetchBootstrap(),
        hasValidBootstrap () {
            return this.bootstrap?.accessKey?.split("_")[0] * 1000 > Date.now();
        },
        fetchBootstrap,
        getAttribution (source) {
            return this.bootstrap.attributions.find(a => a.attributionId === this.bootstrap.tileSources.find(s => s.tileSource === source).attributionId).global.map(a => `<a href="${a.url}">${a.name + (a.name.length < 2 ? "Apple" : "")}</a>`).join(", ");
        },
        getTiles (source, discardParams) {
            let path = this.bootstrap.tileSources.find(s => s.tileSource === source).path.replaceAll(/(\{|\})+/g, "$1");
            for (const [param, value] of discardParams) path = path.replace(param, value || "");
            const subdomains = this.bootstrap.tileSources.find(s => s.tileSource === source).domains.flatMap(d => ["", 1, 2, 3, 4].flatMap(s => d.replace(".", `${s}.`)));
            return subdomains.map(d => `https://${d}${path}`);
        }
    };
}

function getAppleHybridLayer (apple) {
    const makeTiles = () => apple.getTiles("hybrid-overlay", [["{tileSizeIndex}", 1], ["{resolution}", 1], ["&lang={lang}"]]);
    return {
        name: "Apple Hybrid",
        sources: {
            "apple-hybrid": {
                type: "raster",
                tiles: makeTiles(),
                maxzoom: 21,
                tileSize: 256,
                attribution: apple.getAttribution("hybrid-overlay")
            }
        },
        layers: [
            {
                id: "apple-hybrid",
                type: "raster",
                source: "apple-hybrid",
                maxzoom: 21
            }
        ],
        onMoveEnd ({target}) {
            if (apple.hasValidBootstrap()) return;
            apple.fetchBootstrap().then(bootstrap => {
                apple.bootstrap = bootstrap;
                const source = target.getSource("apple-hybrid");
                source.tiles = makeTiles();
                source.attribution = apple.getAttribution("hybrid-overlay");
                target._controls.forEach(c => c._updateAttributions && c._updateAttributions());
            });
        }
    };
}

function getAppleSatelliteLayer (apple) {
    const makeTiles = () => apple.getTiles("satellite", [["&size={tileSizeIndex}"], ["&scale={resolution}"]]);
    return {
        name: "Apple Satellite",
        sources: {
            "apple-satellite": {
                type: "raster",
                tiles: makeTiles(),
                maxzoom: 22,
                tileSize: 256,
                attribution: apple.getAttribution("satellite")
            }
        },
        layers: [
            {
                id: "apple-satellite",
                type: "raster",
                source: "apple-satellite",
                maxzoom: 22
            }
        ],
        onMoveEnd ({target}) {
            if (apple.hasValidBootstrap()) return;
            apple.fetchBootstrap().then(bootstrap => {
                apple.bootstrap = bootstrap;
                const source = target.getSource("apple-satellite");
                source.tiles = makeTiles();
                source.attribution = apple.getAttribution("satellite");
                target._controls.forEach(c => c._updateAttributions && c._updateAttributions());
            });
        }
    };
}

function getBingImageryLayer () {
    return {
        name: "Bing Aerial",
        sources: {
            "bing-aerial": {
                type: "raster",
                tiles: [0, 1, 2, 3, 4, 5, 6, 7].map(s => `https://ecn.t${s}.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=0`),
                maxzoom: 22,
                tileSize: 256,
                attribution: "Microsoft"
            }
        },
        layers: [
            {
                id: "bing-aerial",
                type: "raster",
                source: "bing-aerial",
                maxzoom: 22
            }
        ]
        // TODO: update attribution
    };
}

async function getEsriHybridLayer (arcgis) {
    const contributors = await arcgis.getContributors("Vector/World_Basemap_v2");
    const text = await fetch("https://cdn.arcgis.com/sharing/rest/content/items/da44d3524641418b936b74b48f0e3060/resources/styles/root.json").then(r => r.text());
    const style = JSON.parse(text.replaceAll(/"icon-image":[\w\W]+?["}],/g, match => match.replaceAll(/"([A-Z][^"]+)"/g, '"world-basemap:$1"')));
    return {
        name: "Esri Hybrid",
        sources: {
            esri: {
                type: "vector",
                tiles: ["https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf"],
                minzoom: 0,
                maxzoom: 22,
                scheme: "xyz",
                attribution: "Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community"
            }
        },
        sprite: [
            {
                id: "world-basemap",
                url: "https://cdn.arcgis.com/sharing/rest/content/items/da44d3524641418b936b74b48f0e3060/resources/sprites/sprite"
            }
        ],
        style,
        layers: style.layers,
        contributors,
        onMoveEnd ({target}) {
            target.getSource("esri").attribution = arcgis.getAttribution(map, contributors);
            target._controls.forEach(c => c._updateAttributions && c._updateAttributions());
        }
    };
}

async function getEsriImageryLayer (arcgis) {
    const contributors = await arcgis.getContributors("World_Imagery");
    return {
        name: "Esri World Imagery",
        sources: {
            "esri-imagery": {
                type: "raster",
                tiles: ["server", "services"].map(s => `https://${s}.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false`),
                maxzoom: 23,
                tileSize: 256,
                attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community"
            }
        },
        layers: [
            {
                id: "esri-imagery",
                type: "raster",
                source: "esri-imagery",
                minzoom: 0,
                maxzoom: 23
            }
        ],
        contributors,
        onMoveEnd ({target}) {
            target.getSource("esri-imagery").attribution = arcgis.getAttribution(map, contributors);
            target._controls.forEach(c => c._updateAttributions && c._updateAttributions());
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
            const bbox = map.getBounds(),
                encoded = [["South", "West"], ["North", "East"]]
                    .map((m, i) => `!${i + 5}m2${Array.from(
                        new Uint32Array(new Int32Array(m.map(d => bbox[`get${d}`]() * 1e7)).buffer),
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
        name: "Google Hybrid",
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
                source: "google-hybrid",
                maxzoom: 22
            }
        ],
        async onMoveEnd ({target}) {
            target.getSource("google-hybrid").attribution = await google.getAttribution(0);
            target._controls.forEach(c => c._updateAttributions && c._updateAttributions());
        }
    };
}

function getGoogleSatelliteLayer (google) {
    return {
        name: "Google Satellite",
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
                source: "google-satellite",
                maxzoom: 22
            }
        ],
        async onMoveEnd ({target}) {
            target.getSource("google-satellite").attribution = await google.getAttribution(1);
            target._controls.forEach(c => c._updateAttributions && c._updateAttributions());
        }
    };
}

async function getOSMLayer () {
    const style = await fetch("versatilescolorfulhybrid.json").then(r => r.json());
    return {
        name: "OpenStreetMap",
        sources: {
            osmv: {
                type: "vector",
                url: "https://vector.openstreetmap.org/shortbread_v1/tilejson.json"
            }
        },
        style,
        layers: style.layers,
        sprite: style.sprite
    };
}
