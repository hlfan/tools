// @ts-ignore
import type { Config, Context, Netlify } from "@netlify/functions";

export default async (request: Request, context: Context) => {
    // @ts-ignore
    const cached = Netlify.env.get("bootstrap");
    if (cached) {
        const parsed = JSON.parse(cached);
        const expirationTime = Number(parsed.accessKey.split('_')[0]) * 1000;
        if (!isNaN(expirationTime) && expirationTime > Date.now()) {
            return new Response(cached, { headers: { 'Content-Type': 'application/json' } });
        }
    }
    const tokenResponse = await fetch('https://maps.apple.com/imagecollection/token');
    const token = await tokenResponse.text();
    const bootstrapResponse = await fetch('https://cdn.apple-mapkit.com/ma/bootstrap', {
        headers: { authorization: `Bearer ${token}` }
    });
    const bootstrap = await bootstrapResponse.text();
    // @ts-ignore
    Netlify.env.set("bootstrap", bootstrap);
    return new Response(bootstrap, {
        headers: { 'Content-Type': 'application/json' },
        status: bootstrapResponse.status,
        statusText: bootstrapResponse.statusText
    });
};

export const config: Config = { path: "/bootstrap" };
