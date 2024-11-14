const fs = require('fs')

export default async (request) => {
	let { next_run } = await request.json(),
		tokenResponse = await fetch('https://maps.apple.com/place/mwtoken'),
		token = await tokenResponse.text(),
		headers = { authorization: `Bearer ${token}` },
		bootstrapResponse = await fetch('https://cdn.apple-mapkit.com/ma/bootstrap', { headers }),
		bootstrap = await bootstrapResponse.json(),
		tileSourcesMapper = ({ tileSource, path, attributionId }) => [tileSource, { v: decodeURIComponent(path.match(/v=(\d+)/)[1]), attributionId }],
		attributionsMapper = ({ attributionId, global }) => [attributionId, [...new Set(global.map(a => a.url))]],
		out = {
			accessKey: bootstrap.accessKey,
			expiresAt: Date.now() + bootstrap.expiresInSeconds * 1000,
			tiles: Object.fromEntries(bootstrap.tileSources.map(tileSourcesMapper)),
			attributions: Object.fromEntries(bootstrap.attributions.map(attributionsMapper))
		};

	fs.writeFileSync('../../dist/apple-token.json', JSON.stringify(out));
	console.log(`Cached token for until ${new Date(expiresAt)}. Next run at ${ ${new Date(next_run)}}`);
}
