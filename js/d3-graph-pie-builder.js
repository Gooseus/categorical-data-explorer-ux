(function(window,d3){
	const noop = () => {};
	const DEFAULT_OPTIONS = {
		node: {
			mouseover: noop,
			mouseout: noop,
			click: noop
		}
	};

	function buildPieGraph(id, graph, opts) {
		opts = Object.assign({},DEFAULT_OPTIONS,opts);
		let svg = d3.select(id),
		width = +svg.attr("width"),
		height = +svg.attr("height");

		// Define the div for the tooltip
		var div = d3.select("body").append("div")	
			.attr("class", "tooltip")				
			.style("opacity", 0);

		var color = d3.scaleOrdinal(d3.schemeTableau10);

		var simulation = d3.forceSimulation()
				.force("link", d3.forceLink().id(d => d.id).distance(100))
				.force("charge", d3.forceManyBody()
									.strength(-95)
									.distanceMax(150))
				.force("collide", d3.forceCollide(30))
				.force("center", d3.forceCenter(width/2, height/2));

		function dragstarted(d) {
			if (!d3.event.active) simulation.alphaTarget(0.3).restart();
			d.fx = d.x;
			d.fy = d.y;
		}

		function dragged(d) {
			d.fx = d3.event.x;
			d.fy = d3.event.y;
		}

		function dragended(d) {
			if (!d3.event.active) simulation.alphaTarget(0);
			d.fx = null;
			d.fy = null;
		}
		
		// These need to be passed in so we have access to more application data
		function nodeToolTipTxt(d) {
			let txt =  [`${d.name} (${d.id})`];
			txt.push(`|${d.id}|: ${d.card}`);
			txt.push(`H(${d.id}): ${d.entropy}`);
			// txt.push(`Transmission: ${d.entropy}`);
			return txt.join("<br />");
		};
		// These need to be passed in so we have access to more application data
		function linkToolTipTxt(l) {
			let txt =  [`${l.source.name} - ${l.target.name}`];
			txt.push(`H(${l.source.id}:${l.target.id}): ${l.ind_entropy}`);
			txt.push(`H(${l.source.id}${l.target.id}): ${l.entropy}`);
			txt.push(`I(${l.source.id}${l.target.id}): ${l.captured_info}`);
			return txt.join("<br />");
		}

		function linkMouseOver (d) {
			div.transition()
				.duration(200)
				.style("opacity", .9);
			div.html(linkToolTipTxt(d))
				.style("left", (d3.event.pageX) + "px")
				.style("top", (d3.event.pageY - 28) + "px");
		}
		function linkMouseOut (d) {
			div.transition()
				.duration(500)
				.style("opacity", 0);
		}

		function nodeMouseOver (d) {
			div.transition()
				.duration(200)
				.style("opacity", .9);
			div.html(nodeToolTipTxt(d))
				.style("left", (d3.event.pageX) + "px")
				.style("top", (d3.event.pageY - 28) + "px");

			opts.node.mouseover(d);
		}
		function nodeMouseOut(d) {
			div.transition()
				.duration(500)
				.style("opacity", 0);

			opts.node.mouseout(d);
		}
		function nodeClick (d) {
			console.log("DO SOMETHING COOL!", d);
			opts.node.click(d);
		}

		console.log("building graph", graph);
		var link = svg.append("g")
					.attr("class", "links")
					.selectAll("line")
					.data(graph.links)
					.enter().append("line")
					.attr("stroke-width", d => Math.sqrt(d.value))
					.on("mouseover",linkMouseOver)
					.on("mouseout",linkMouseOut);

		var node = svg.append("g")
					.attr("class", "nodes")
					.selectAll("g")
					.data(graph.nodes)
					.enter()
					.append("g")
					.call(d3.drag()
						.on("start", dragstarted)
						.on("drag", dragged)
						.on("end", dragended))
					.on("mouseover",nodeMouseOver)
					.on("mouseout",nodeMouseOut)
					.on("click",nodeClick);

		function ticked() {
			link
				.attr("x1", d => d.source.x)
				.attr("y1", d => d.source.y)
				.attr("x2", d => d.target.x)
				.attr("y2", d => d.target.y);

			d3.selectAll("circle")
				.attr("cx", d => d.x)
				.attr("cy", d => d.y);

			d3.selectAll("text")
				.attr("x", d => d.x)
				.attr("y", d => d.y);
		}

		/* Draw the respective pie chart for each node */
		node.each(function (d) {
			NodePieBuilder.drawNodePie(d3.select(this), d.pieChart, {
				parentNodeColor: color(d.group),
				outerStrokeWidth: 12,
				showLabelText: true,
				labelText: d.id,
				labelColor: color(d.group)
			});
		});

		simulation
				.nodes(graph.nodes)
				.on("tick", ticked);

		simulation
				.force("link")
				.links(graph.links);

		return svg;
	}

	window.buildPieGraph = buildPieGraph;
}(window,d3));