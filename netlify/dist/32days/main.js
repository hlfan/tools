const startButton = document.querySelector("button.start");
const alphabet = "qxjzvfwbkgpmhdcytlnuroisea";
let wordlist = [];
const workerDummy = {};
workerDummy.onmessage = event => {
	const {data} = event.data;
	switch (event.data.type) {
	case "match":
		displayMatch(data);
		return;
	case "complete":
		startButton.disabled = false;
		document.querySelector("span").innerText = `In ${Math.round(data.duration * 1e3) / 1e6} seconds, ${Math.round(81919 / data.duration * 337e4)}% faster than Matt Parker's code`;

	}
};
workerDummy.onerror = error => console.error("Worker error:", error.message);
const matchList = document.querySelector(".matches");
init();

async function init () {
	const text = await fetch("words.txt")
		.then(response => response.text())
		.catch(error => startButton.disabled = console.error("Error fetching word list:", error) || true);
	wordlist = text.split(/[\n\r]+/).filter(word => word.length);
	startButton.addEventListener("click", startSearch);
	startButton.disabled = false;
}
function startSearch () {
	const worker = new Worker("worker.js");
	Object.assign(worker, workerDummy);
	startButton.disabled = true;
	while (matchList.childElementCount) matchList.removeChild(matchList.firstElementChild);
	worker.postMessage({
		action: "startSearch",
		wordlist,
		alphabet
	});
}
function displayMatch (match) {
	const matchDiv = document.createElement("div");
	matchDiv.className = "match";
	for (const anagrams of match) {
		const wordDiv = document.createElement("div");
		wordDiv.classList.add("word");
		wordDiv.dataset.variantCount = anagrams.length;
		const sorted = [...new Set(anagrams.map(w => [...w].sort()).flat())];
		for (const letter of sorted) {
			const letterDiv = document.createElement("div");
			letterDiv.dataset.letter = letter;
			wordDiv.appendChild(letterDiv);
			for (const variant in anagrams) letterDiv.style.setProperty(`--order-${variant - -1}`, anagrams[variant].indexOf(letter) - sorted.indexOf(letter));

		}
		matchDiv.appendChild(wordDiv);
	}
	matchList.appendChild(matchDiv);
}
