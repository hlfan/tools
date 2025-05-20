async function init () {
	const response = await fetch("stations.json");
	const stations = await response.json();

	const sequences = getAllValidStationSequences(stations);
	const randomSequence = sequences[Math.floor(Math.random() * sequences.length)];
	renderSequence(randomSequence);
}
function getAllValidStationSequences (stations) {
	function recurse (stack) {
		const entries = stations[stack[0]];
		if (!entries) return [[]];
		const recursed = recurse(stack.slice(1));

		return Object.entries(entries).flatMap(([line, stations]) =>
			stations.flatMap(station =>
				recursed.map(rest =>
					[
						{
							...station,
							line
						}, ...rest
					]
				)
			)
		);
	}

	const keys = Object.keys(stations);
	return recurse(keys).filter(seq =>
		new Set(seq.map(s => s.line)).size === keys.length
	);
}
function renderSequence (seq) {
	const ol = document.getElementById("sequence");
	seq.forEach(({station, filename, line}) => {
		const li = document.createElement("li");
		li.className = `station ${line}`;
		li.innerHTML = `<span class="line">${line}</span>: ${station} <small>(${filename})</small>`;
		ol.appendChild(li);
	});
}
init();
