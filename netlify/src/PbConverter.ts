// @ts-ignore
type PbParam = string | number | bigint | boolean | PbParam[] | Record<string, PbParam>;

export class PbConverter {
	private static SEPARATOR = '!';
	private static stack = [];

	public static encode(obj: Record<string, PbParam> | PbParam[]): string {
		return this.preparedEntries(obj)
			.map(([key, value]) => {
				const encoded = this.encodeValue(value);
				return encoded ? `${key}${encoded}` : undefined;
			})
			.filter(Boolean)
			.join(this.SEPARATOR);
	}

	private static encodeValue(value: PbParam): string | void {
		switch (typeof value) {
			case 'string':
				return `s${value}`;
			case 'number':
				if (!Number.isFinite(value)) return;
				if (!Number.isInteger(value)) return `d${value}`;
			case 'bigint':
				return `${value < 0 ? 'i' : 'u'}${value}`;
			case 'boolean':
				return `b${Number(value)}`;
			case 'object':
				if (!value || !Object.entries(value).length) return 'm0';
				const encoded = this.encode(value);
				return `m${encoded.split(this.SEPARATOR).length}${this.SEPARATOR}${encoded}`;
		}
	}

	private static preparedEntries(obj: Record<string, PbParam> | PbParam[]): [string, PbParam][] {
		try {
			JSON.stringify(obj, (key, value) =>
				typeof value === 'bigint' ? value.toString() : value // return everything else unchanged
			)
		} catch (error) {
			throw new TypeError(error.message.replace('JSON', 'string'));
		}
		if (typeof obj[Symbol.iterator] === 'function')
			obj.unshift(Array); // to make array indices start at 1
		return Object.entries(obj);
	}

	public static decode(query: string): Record<string, PbParam> {
		return this.decodeObject(query.split(this.SEPARATOR).filter(Boolean));
	}

	private static decodeObject(queue: string[]): Record<string, PbParam> {
		this.stack.unshift({});
		let encoded: string;
		while (encoded = queue.shift()) {
			const [, key, type, value] = /^(\d+)([a-z])(.*)$/.exec(encoded);
			this.stack[0][key] = this.decodeValue(type, value, queue)
		}
		return this.stack.shift();
	}

	private static decodeValue(type: string, value: string, queue: string[]): PbParam {
		switch (type) {
			case 'b':
				return Boolean(value);
			case 'z':
				return this.utob(value);
			case 'd':
			case 'f':
				return parseFloat(value);
			case 'i':
			case 'u':
			case 'e':
				const intValue = parseInt(value);
				return Number.isSafeInteger(intValue) ? intValue : BigInt(value);
			case 'm':
				return this.decodeObject(queue.splice(0, parseInt(value)));
		}
		return value;
	}

	public static utob(str: string): string {
		return decodeURIComponent(atob(str)
			.split('')
			.map(c => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
			.join(''));
	}

	public static btou(str: string): string {
		return !str ? '' : btoa(encodeURIComponent(str).slice(1)
			.split('%')
			.map(l => String.fromCharCode(parseInt(l, 16)))
			.join(''));
	}
}
