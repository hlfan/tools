const startButton = document.querySelector('button.start');
const alphabet = 'qxjzvfwbkgpmhdcytlnuroisea';
let wordlist = [];
let workerDummy = {};
workerDummy.onmessage = (event) => {
	const {
		type,
		data
	} = event.data;
	switch (event.data.type) {
	case 'match':
		displayMatch(data);
		return;
	case 'complete':
		startButton.disabled = false;
		document.querySelector('span').innerText = `In ${Math.round(data.duration * 1e3) / 1e6} seconds, ${Math.round(81919 / data.duration * 337e4)}% faster than Matt Parker's code`;
		return;
	}
};
workerDummy.onerror = error => console.error('Worker error:', error.message);
let matchList = document.querySelector('.matches');
init();

async function init() {
	let text = await fetch('words.txt')
		.then(response => response.text())
		.catch(error => startButton.disabled = console.error('Error fetching word list:', error) || true);
	wordlist = text.split(/[\n\r]+/).filter(word => word.length);
	startButton.addEventListener('click', startSearch);
	startButton.disabled = false;
}
function startSearch() {
	let worker = new Worker('worker.js');
	Object.assign(worker, workerDummy);
	startButton.disabled = true;
	while (matchList.childElementCount)
		matchList.removeChild(matchList.firstElementChild);
	worker.postMessage({
		action: 'startSearch',
		wordlist,
		alphabet
	});
}
function displayMatch(match) {
	let matchDiv = document.createElement('div');
	matchDiv.className = 'match';
	for (let anagrams of match) {
		let wordDiv = document.createElement('div');
		wordDiv.classList.add('word');
		wordDiv.dataset.variantCount = anagrams.length;
		let sorted = [...new Set(anagrams.map(w => [...w].sort()).flat())];
		for (let letter of sorted) {
			let letterDiv = document.createElement('div');
			letterDiv.dataset.letter = letter;
			wordDiv.appendChild(letterDiv);
			for (let variant in anagrams) {
				letterDiv.style.setProperty('--order-' + (variant - -1), anagrams[variant].indexOf(letter) - sorted.indexOf(letter));
			}
		}
		matchDiv.appendChild(wordDiv);
	}
	matchList.appendChild(matchDiv);
}
