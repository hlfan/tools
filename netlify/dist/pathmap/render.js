import abs from "https://cdn.jsdelivr.net/npm/abs-svg-path/+esm";
import parse from "https://cdn.jsdelivr.net/npm/parse-svg-path/+esm";

const R = 6378137;
export function normalizePathData (d) {
	const segments = abs(parse(d));
	return segments;
}
function wgs84ToMercator ([lng, lat]) {
	const x = R * lng * Math.PI / 180;
	const y = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
	return [x, y];
}
export function segmentsToMercatorPath (segments) {
	return segments.map(seg => {
		const [code, ...vals] = seg;
		const mVals = [];
		for (let i = 0; i < vals.length; i += 2) mVals.push(...wgs84ToMercator([vals[i], vals[i + 1]]));
		return [code, ...mVals];
	});
}

export function renderPathTiles ({pathEl, bandWidth, zoom, tileUrl, canvas, landscape = false, normalSmoothness = 0.2}) {
	const ctx = canvas.getContext("2d");
	const bandLength = pathEl.getTotalLength();
	const tileSize = 256;
	const metersPerPixel = 2 * Math.PI * R / (tileSize * 2 ** zoom);
	const tangentPx = Math.ceil(bandLength / metersPerPixel);
	const normalPx = Math.ceil(bandWidth / metersPerPixel);
	const deltaTangentPx = bandWidth * normalSmoothness;
	if (landscape) {
		canvas.width = tangentPx;
		canvas.height = normalPx;
	} else {
		canvas.width = normalPx;
		canvas.height = tangentPx;
	}
	const tileCache = new Map();
	function fetchTile ({x, y}) {
		const key = `${x}_${y}`;
		if (tileCache.has(key)) return;
		const tileDict = {
			x,
			y,
			z: zoom
		};
		const url = tileUrl.replaceAll(/\{([xyz])\}/g, (_, p) => tileDict[p]);
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const pointsToDraw = drawCache.get(key) || [];
			for (const {source, target} of pointsToDraw) ctx.drawImage(img, source.x, source.y, 1, 1, target.x, target.y, 1, 1);
		};
		img.src = url;
		tileCache.set(key, img);
	}
	const pointCache = new Map();
	function getPointAtLength (length) {
		if (pointCache.has(length)) return pointCache.get(length);
		const point = pathEl.getPointAtLength(length);
		pointCache.set(length, point);
		return point;
	}
	const drawCache = new Map();
	function drawPoint (tile, source, target) {
		const key = `${tile.x}_${tile.y}`;
		if (!drawCache.has(key)) drawCache.set(key, []);
		drawCache.get(key).push({
			source,
			target
		});
	}
	for (let u = 0; u < tangentPx; u++) for (let v = 0; v < normalPx; v++) {
		const centerLinePoint = getPointAtLength(u * metersPerPixel);
		const pNext = getPointAtLength(Math.min(u * metersPerPixel + deltaTangentPx, bandLength));
		const pointDelta = {
			x: pNext.x - centerLinePoint.x,
			y: pNext.y - centerLinePoint.y
		};
		const len = Math.hypot(pointDelta.x, pointDelta.y) || 1;
		const offset = (v - normalPx / 2) * metersPerPixel;
		const world = {
			x: centerLinePoint.x - pointDelta.y * offset / len,
			y: centerLinePoint.y + pointDelta.x * offset / len
		};
		const pixel = {
			x: (world.x + R * Math.PI) / metersPerPixel,
			y: tileSize * 2 ** zoom - (world.y + R * Math.PI) / metersPerPixel
		};
		const tile = {
			x: Math.floor(pixel.x / tileSize),
			y: Math.floor(pixel.y / tileSize)
		};
		const inTile = {
			x: Math.floor(pixel.x - tile.x * tileSize),
			y: Math.floor(pixel.y - tile.y * tileSize)
		};
		fetchTile(tile);
		const dest = {};
		if (landscape) {
			dest.x = u;
			dest.y = normalPx - v;
		} else {
			dest.x = v;
			dest.y = u;
		}
		drawPoint(tile, inTile, dest);
	}
}
