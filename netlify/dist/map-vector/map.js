(async function () {
    window.imagery = {
        esri: await getEsriImageryLayer(),
        apple: await getAppleLayer()
    };
    window.overlays = {
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
            if (layer.onViewChange) map.on("moveend", layer.onViewChange);
            input.dataset.checked = true;
        }
        for (const input of newlyUnchecked) {
            const layer = layers[input.value];
            layer.layers.forEach(layer => map.removeLayer(layer.id));
            Object.keys(layer.sources).forEach(source => map.removeSource(source));
            layer.sprite?.forEach(sprite => map.removeSprite(sprite.id));
            if (layer.onViewChange) map.off("moveend", layer.onViewChange);
            input.dataset.checked = false
        }
    });
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
        onViewChange: function ({ target }) {
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

async function getAppleLayer() {
    const bootstrap = await fetch("/bootstrap").then(r => r.json());
    function getTiles(s) {
        const path = bootstrap.tileSources.find(s => s.tileSource === "satellite").path.replaceAll(/(\{|\})+/g, "$1").replace("&size={tileSizeIndex}&scale={resolution}", "");
        return `https://sat-cdn${s}.apple-mapkit.com${path}`;
    }
    return {
        name: "Apple Satellite",
        bootstrap: bootstrap,
        sources: {
            "apple-satellite": {
                "type": "raster",
                "tiles": ["", 1, 2, 3, 4].map(getTiles),
                "maxzoom": 22,
                "tileSize": 256,
                "attribution": bootstrap.attributions.find(a => a.attributionId == bootstrap.tileSources.find(s => s.tileSource === "satellite").attributionId).global.map(a => `<a href="${a.url}">${a.name !== String.fromCharCode(8206) ? a.name : "Apple"}</a>`).join(", ")
            }
        },
        layers: [
            {
                id: "apple-satellite",
                type: "raster",
                source: "apple-satellite",
                minzoom: 0,
                maxzoom: 21
            }
        ]
    };
}
