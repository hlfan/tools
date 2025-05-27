// @ts-ignore
import type { Config, Context, Netlify } from "@netlify/functions";

export default async (request: Request, context: Context) => {
    // @ts-ignore
    const cached = Netlify.env.get("tomtomkey");
    if (cached) {
        const parsed = JSON.parse(cached);
        if (!isNaN(parsed.expiresAt) && parsed.expiresAt > Date.now()) {
            return new Response(cached, { headers: { 'Content-Type': 'application/json' } });
        }
    }
    // @ts-ignore
    const cookie = Netlify.env.get("TOMTOM_SSESS"); // SSESS[\da-f]+
    const keyResponse = await fetch("https://developer.tomtom.com/dashboard/map-maker-key", {headers: {cookie}});
    const key = await keyResponse.text();
    key.replaceAll(/"expiresIn":(\d+),/g,(m,n)=>`"expiresAt":${1000 * n + Date.now()},`);
    // @ts-ignore
    Netlify.env.set("tomtomkey", key);
    return new Response(key, {
        headers: { 'Content-Type': 'application/json' },
        status: keyResponse.status,
        statusText: keyResponse.statusText
    });
};

export const config: Config = { path: "/tomtomkey" };
