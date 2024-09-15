const onmatch = data => postMessage({
	type: 'match',
	data
});
onmessage = ({
	data
}) => {
	self.wordlist = data.wordlist;
	self.alphabetMap = Object.fromEntries(Array.from(data.alphabet, (c, i) => [c, i]))
		self.startTime = performance.now();
	if (data.action != 'startSearch')
		return;
	search();
	postMessage({
		type: 'complete',
		data: {
			duration: performance.now() - startTime
		}
	});
	close();
}

function search() {
	self.wordMap = new Map();
	let encodedSet = new Set();
	for (let word of wordlist) {
		let enc = encodeWord(word);
		if (enc == null)
			continue;
		if (!wordMap.has(enc))
			wordMap.set(enc, []);
		wordMap.get(enc).push(word);
		encodedSet.add(enc);
	}
	self.encodedWords = Int32Array.from([...encodedSet].sort((a, b) => a - b));
	self.indexes = Int16Array.from(Array(27).keys(), i => -1 - binarySearch(encodedWords, 1 << i));
	findWords(0, [], false);
}

function binarySearch(arr, x) {
	let low = 0,
	high = arr.length - 1;
	while (low <= high) {
		let mid = (low + high) >> 1;
		let midVal = arr[mid];
		if (midVal < x)
			low = mid + 1;
		else if (midVal > x)
			high = mid - 1;
		else
			return mid;
	}
	return  - (low + 1);
}

function findWords(usageMask, solution, skipped) {
	if (solution.length === 5) {
		onmatch(solution.map(enc => wordMap.get(enc)));
		return;
	}

	let diff = ((1 << 26) - 1) ^ usageMask;
	let highest = highestOneBit(diff);

	if (!skipped)
		selectWords(highestOneBit(highest ^ diff), highest | usageMask, usageMask, solution, true);
	selectWords(highest, usageMask, usageMask, solution, skipped);
}

function selectWords(query, mask, usageMask, solution, skipped) {
	let trailing = 31 - Math.clz32(query & -query);
	let from = indexes[trailing];
	let to = indexes[trailing + 1];
	for (let i = from; i < to; i++) {
		const word = encodedWords[i];
		if ((word & usageMask) === 0) {
			solution.push(word);
			findWords(mask | word, solution, skipped);
			solution.pop();
		}
	}
}

function encodeWord(word) {
	if (word.length !== 5)
		return null;
	let enc = 0;
	for (let char of word) {
		const bitPos = alphabetMap[char];
		if (bitPos == undefined)
			return null;
		enc |= 1 << bitPos;
	}
	let bitCount = 0;
	let x = enc;
	while (x) {
		x &= (x - 1);
		bitCount++;
	}
	return (bitCount === 5) ? enc : null;
}

function highestOneBit(x) {
	return 1 << (31 - Math.clz32(x));
}
