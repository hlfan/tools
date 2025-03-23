(async function () {
    const apple = await appleUtils();
    window.imagery = {
        apple: await getAppleSatelliteLayer(apple),
        esri: await getEsriImageryLayer()
    };
    window.overlays = {
        apple: await getAppleHybridLayer(apple),
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
})();

function buildList(id, layers, type) {
    const container = document.getElementById(id);
    Object.entries(layers)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, layer]) => {
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.id = container.id + "-" + id;
            label.htmlFor = input.id;
            input.type = type;
            input.name = container.id;
            input.value = id;
            input.dataset.checked = false;
            label.appendChild(input);
            label.appendChild(document.createTextNode(layer.name));
            container.appendChild(label);
        });
    container.addEventListener("change", function (e) {
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
            input.dataset.checked = false
        }
    });
}

async function appleUtils() {
    const fetchBootstrap = async () => fetch("/bootstrap").then(r => r.json());
    return {
        bootstrap: await fetchBootstrap(),
        hasValidBootstrap: function () {
            return this.bootstrap?.accessKey?.split('_')[0] * 1000 > Date.now();
        },
        fetchBootstrap: fetchBootstrap,
        getAttribution: function (source) {
            return this.bootstrap.attributions.find(a => a.attributionId == this.bootstrap.tileSources.find(s => s.tileSource === source).attributionId).global.map(a => `<a href="${a.url}">${a.name + (a.name.length < 2 ? "Apple" : "")}</a>`).join(", ");
        },
        getTiles: function (source, discardParams) {
            let path = this.bootstrap.tileSources.find(s => s.tileSource === source).path.replaceAll(/(\{|\})+/g, "$1");
            for (const [param, value] of discardParams) path = path.replace(param, value || "");
            const subdomains = this.bootstrap.tileSources.find(s => s.tileSource === source).domains.flatMap(d => ["", 1, 2, 3, 4].flatMap(s => d.replace(".", s + ".")));
            return subdomains.map(d => `https://${d}${path}`);
        }
    };
}

async function getAppleHybridLayer(apple) {
    const makeTiles = () => apple.getTiles("hybrid-overlay", [["{tileSizeIndex}", 1], ["{resolution}", 1], ["&lang={lang}"]]);
    return {
        name: "Apple Hybrid",
        sources: {
            "apple-hybrid": {
                "type": "raster",
                "tiles": makeTiles(),
                "maxzoom": 21,
                "tileSize": 256,
                "attribution": apple.getAttribution("hybrid-overlay")
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
        onMoveEnd: function ({ target }) {
            if (apple.hasValidBootstrap()) return;
            apple.fetchBootstrap().then(bootstrap => {
                apple.bootstrap = bootstrap;
                const source = target.getSource("apple-hybrid");
                source.tiles = makeTiles();
                source.attribution = apple.getAttribution("hybrid-overlay");
                target._controls.forEach(c => c._updateAttributions && c._updateAttributions())
            });
        }
    };
}

async function getAppleSatelliteLayer(apple) {
    const makeTiles = () => apple.getTiles("satellite", [["&size={tileSizeIndex}"], ["&scale={resolution}"]]);
    return {
        name: "Apple Satellite",
        sources: {
            "apple-satellite": {
                "type": "raster",
                "tiles": makeTiles(),
                "maxzoom": 22,
                "tileSize": 256,
                "attribution": apple.getAttribution("satellite")
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
        onMoveEnd: function ({ target }) {
            if (apple.hasValidBootstrap()) return;
            apple.fetchBootstrap().then(bootstrap => {
                apple.bootstrap = bootstrap;
                const source = target.getSource("apple-satellite");
                source.tiles = makeTiles();
                source.attribution = apple.getAttribution("satellite");
                target._controls.forEach(c => c._updateAttributions && c._updateAttributions())
            });
        }
    };
}

async function getEsriImageryLayer() {
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
        contributors: await fetch("https://static.arcgis.com/attribution/World_Imagery").then(r => r.json()).then(r => r.contributors),
        onMoveEnd: function ({ target }) {
            const source = imagery.esri.sources["esri-imagery"];
            source.attribution = imagery.esri.contributors.filter(c =>
                c.coverageAreas.some(a => target.getZoom() >= a.zoomMin && target.getZoom() <= a.zoomMax && (
                    target.getBounds().getNorth() >= a.bbox[0] &&
                    target.getBounds().getEast() >= a.bbox[1] &&
                    target.getBounds().getSouth() <= a.bbox[2] &&
                    target.getBounds().getWest() <= a.bbox[3]
                ))
            ).map(c => c.attribution).join(", ");
            target.getSource("esri-imagery").attribution = source.attribution;
            target._controls.forEach(c => c._updateAttributions && c._updateAttributions())
        }
    };
}

async function getOSMLayer() {
    const style = await fetch("versatilescolorfulhybrid.json").then(r => r.json());
    return {
        name: "OpenStreetMap",
        sources: {
            osmv: {
                type: "vector",
                url: "https://vector.openstreetmap.org/shortbread_v1/tilejson.json"
            }
        },
        style: style,
        layers: style.layers,
        sprite: style.sprite
    };
}
