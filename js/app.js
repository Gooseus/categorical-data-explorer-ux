// TODO - Move to utilities area/file
function intToColName(i){
	let s = '', t;

	while (i > 0) {
		t = (i - 1) % 26;
		s = String.fromCharCode(65 + t) + s;
		i = (i - t) / 26 | 0;
	}

	return s || undefined;
}

(function() {
	// vue setup
	let app = new Vue({
						el: "#app",
						data: {
							rnum: 0,
							vnum: 0,
							H_ind: 0,
							H_sat: 0,
							filename: "",
							graph_width: 800,
							graph_height: 800,
							graph_capture_threshold: 0.11,
							graph_nodes: {},
							graph_edges: {},
							show_graph: false
						}
					});

	// drag-drop file processing setup
	let dropArea = document.getElementById('drop-area');

	// prevent default action of these events on the drop area
	function preventDefaults (e) {
		e.preventDefault();
		e.stopPropagation();
	}

	// highlighting visual
	// highligting drag-drop event handlers
	highlight = e => dropArea.classList.add('highlight');
	unhighlight = e => dropArea.classList.remove('highlight');

	// add highlight listeners
	function addHighlighting(evt) {
		dropArea.addEventListener(evt, preventDefaults, false);
		switch(evt) {
			case "dragenter": case "dragover":
				dropArea.addEventListener(evt, highlight, false);
			break;
			case "dragleave": case "drop":
				dropArea.addEventListener(evt, unhighlight, false);
			break;
			default: console.log("no case for event: ", evt);
		}
	}
	['dragenter', 'dragover', 'dragleave', 'drop'].forEach(addHighlighting);

	// actually only processes the first file in any list of files
	let processFiles = files => {
		console.log(files);
		let n = 0; // number of rows
		//let graph = { nodes: [], links: [] }; 
		let graph = { nodes: [], links: [] };
		let nodes = app.graph_nodes;
		let links = app.graph_edges;

		// saturated model object
		let sat = {};

		let processCols = head => {
			let vars = Object.keys(head);
			for(var i=0; i<vars.length; i++) {
				let key = vars[i];
				let id = intToColName(i+1);
				app.graph_nodes[key] = {
					idx: i+1,
					name: vars[i],
					id: id,
					freq: {},
					prob: {}
				};
				graph.nodes.push(nodes[key]);
			}
		};

		let processRow = results => {
			let row = results.data;
			if(n===0) processCols(row);
			n++;
			let vars = Object.keys(row);
			for(var i=0; i<vars.length; i++) {
				let key = vars[i];
				let val = row[key];
				let node = nodes[key];

				if(!node.freq[val]) node.freq[val] = 0;
				node.freq[val] += 1;
			}
		};
		
		let processRowAgain = results => {
			let row = results.data;
			let vars = Object.keys(row);

			let satkey = '';
			for(var i=0; i<vars.length; i++) {
				let key = vars[i];
				let val = row[key];
				let node = nodes[key];
				let vid = node.classes.indexOf(val);
				satkey += vid + '|';
				for(var j=i+1; j<vars.length; j++) {
					let jkey = vars[j];
					let jval = row[jkey];
					let jnode = nodes[jkey];
					let jvid = jnode.classes.indexOf(jval);
					let lid = `${node.id}|${jnode.id}`;
					let link = links[lid];
					link.table[vid][jvid] += 1;
				}
			}
			if(!sat[satkey]) sat[satkey] = 0;
			sat[satkey] += 1;
		}

		let finishFileAgain = () => {
			console.log("through a second time!");
			let gamma = p => -1*p*Math.log2(p);

			let max_captured = [-Infinity,null];
			let min_captured = [Infinity,null];

			let lkeys = Object.keys(links);
			let larr = Object.values(links);
			for(var i=0; i<larr.length; i++) {
				let link = larr[i];
				let entropy = 0;
				for(var j=0; j<link.table.length; j++) {
					let A = link.table[j];
					for (var k=0; k<A.length; k++) {
						A[k] = A[k] / n;
						entropy += gamma(A[k]);
					}
				}
				link.entropy = entropy;
				link.ind_entropy = link.source.entropy+link.target.entropy;
				link.captured_info = link.ind_entropy - link.entropy;
				if(link.captured_info > max_captured[0]) max_captured = [link.captured_info,link];
				if(link.captured_info < min_captured[0]) min_captured = [link.captured_info,link];

				if(link.captured_info > app.graph_capture_threshold) {
					graph.links.push(link);
				}
			}

			app.H_sat = Object.values(sat).reduce((H,f) => H + gamma(f/n), 0);

			console.log("graph data so far: ", graph);
			console.log("maximum information capture link: ", max_captured);
			console.log("minimum information capture link: ", min_captured);
			console.log("model information spread: ", max_captured[0] - min_captured[0]);
			console.log("build pie graph:");
			buildPieGraph('#graph', graph, { });
			app.show_graph = true;
		}

		let finishFile = () => {
			let vars = Object.keys(nodes);
			console.log(`Read ${n} rows of data with ${vars.length} variables.`);
			console.log("Building distributions and graph");
			app.H_ind = 0 //let ind_entropy = 0;
			app.rnum = n;
			app.vnum = vars.length;

			for(var i=0; i<vars.length; i++) {
				let key = vars[i];
				let data = nodes[key];
				
				let classes = Object.keys(data.freq);
				data.classes = classes;
				data.card = classes.length;
				let prob = data.prob;
				data.pieChart = [];
				// check classes.length against n?
				if(data.card > 10) {
					data.pieChart.push({ color: 10, percent: 100 });
					continue;
				}
				for(var j=0; j<data.card; j++) {
					let c = classes[j];
					prob[c] = data.freq[c] / n;
					let piece = { color: j+1, percent: 100*prob[c] };
					data.pieChart.push(piece);
				}
				let gamma = (H,i) => -1*data.prob[i]*Math.log2(data.prob[i]) + (H || 0);
				data.entropy = Object.keys(data.prob).reduce(gamma,0);
				app.H_ind += data.entropy;
				for(j=i+1; j<vars.length; j++) {
					let jkey = vars[j];
					let jdata = nodes[jkey];
					let jcard = Object.keys(jdata.freq).length;
					let link = {
									source: data,
									target: jdata, 
									value: 20, 
									dof: (data.card*jcard)-1
								};
					link.table = null;
					if(link.dof < 1000) {
						link.table = [];
						let f
						for(var k=0;k<data.card;k++) {
							(f = []).length = jcard;
							f.fill(0);
							link.table.push(f);
						}
					}
					links[`${data.id}|${jdata.id}`] = link;
					//graph.links.push(link);
				}
			}

			console.log("independence model entropy: ", app.H_ind);

			let parseConfigAgain = {
				header: true,
				worker: true,
				step: processRowAgain,
				complete: finishFileAgain
			};
			Papa.parse(files[0], parseConfigAgain);
		}

		let parseConfig = {
			header: true,
			worker: true,
			step: processRow,
			complete: finishFile
		};

		app.filename = files[0].name;
		Papa.parse(files[0], parseConfig);

		/* for(var i=0; i<files.length; i++) {
			Papa.parse(files[i], parseConfig);
		}*/
	}

	let handleDrop = e => processFiles(e.dataTransfer.files);
	dropArea.addEventListener('drop', handleDrop, false);
}());