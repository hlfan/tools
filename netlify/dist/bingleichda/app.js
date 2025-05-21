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

		return Object.entries(entries)
			.filter(([line]) => line.startsWith("U"))
			.flatMap(([line, stations]) =>
				stations.flatMap(station =>
					recursed.map(rest =>
						[
							{
								...station,
								width: entries.width,
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
	const container = document.getElementById("collage");
	for (const station of seq) {
		const wrapper = document.createElement("div");
		wrapper.className = "station";
		wrapper.style.width = `${station.width}px`;

		const img = document.createElement("img");
		img.src = `img/${station.filename}`;
		img.style.marginInlineStart = `-${station.x}px`;
		wrapper.appendChild(img);

		container.appendChild(wrapper);
	}
}
init();
