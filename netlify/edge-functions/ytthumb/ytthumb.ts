// @ts-ignore
import {Config, Context} from "https://edge.netlify.com";


export default async (request: Request, context: Context) => {
	let id = new URL(request.url).pathname.slice(8).replaceAll('/','');
	let res = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
	// @ts-ignore
	let newHeaders = new Headers(Object.fromEntries(res.headers.entries()));
	newHeaders.set('Access-Control-Allow-Origin', '*');
	return new Response(res.body, {headers: newHeaders, status: res.status, statusText: res.statusText});
};

export const config: Config = {path: "/ytthumb/*"};