var data_folder = ["data/us_canada_humanities_2017/", "data/korea_humanities_2017/"]
var files = {
        info: "info.json",
        meta: "meta.csv.zip",
        dt: "dt.json.zip",
        tw: "tw.json",
        topic_scaled: "topic_scaled.csv"
};


function load_data(e, t) {
    var i, n;
    if (e === undefined) {
        return t("target undefined", undefined)
    }
    i = e.replace(/^.*\//, "");
    n = d3.select("#m__DATA__" + i.replace(/\..*$/, ""));
    if (!n.empty()) {
        return t(undefined, JSON.parse(n.html()))
    }
    if (e.search(/\.zip$/) > 0) {
        return d3.xhr(e).responseType("arraybuffer").get(function(e, n) {
            var o, r;
            if (n && n.status === 200 && n.response.byteLength) {
                o = new JSZip(n.response);
                r = o.file(i.replace(/\.zip$/, "")).asText()
            }
            return t(e, r)
        })
    }

    return d3.text(e).then(function(data) {
        return t(e, data)
    })
};


function set_tw(e) {
    var tw_json;
    
    if (typeof e !== "string") {
        return
    }
    tw_json = JSON.parse(e);

    var alpha = tw_json.alpha;

    var data = tw_json.tw.map(function(e, n) {
        var w = d3.map();
        var v = 0;
        e.words.map(function(i, n) {
            w.set(i, e.weights[n])
            v += e.weights[n];
        });

        var t = {
            idx: n,
            name: "Topic " + (n + 1),
            weight: v,
            alpha: tw_json.alpha[n],
            words: w
        }
        return t
    });
   
    // based on the bubble chart example, https://naustud.io/tech-stack/
    var svg = d3.select("svg"),
        width = document.body.clientWidth,
        height = +svg.attr("height");


    let centerX = width * 0.5;
    let centerY = height * 0.5;
    let strength = 0.05;
    let scaleColor = d3.scaleSequential(d3.interpolateOrRd);

    let pack = d3.pack()
        .size([width, height])
        .padding(0);
    

    let forceCollide = d3.forceCollide(d => d.r + 1);
    let simulation = d3.forceSimulation()
            .force('charge', d3.forceManyBody())
            .force('collide', forceCollide)
            .force('x', d3.forceX(centerX).strength(strength))
            .force('y', d3.forceY(centerY).strength(strength))


    let root = d3.hierarchy({ children: data })
            .sum(function(d) { return d.alpha; });

    var max = d3.max(data, d => +d.alpha);
    var min = d3.min(data, d => +d.alpha);
    console.log(min, max);

    let scaleRadius = d3.scaleSqrt().domain([min, max]).range([20, 100]);
    let rescaleValue = d3.scaleSqrt().domain([min, max]).range([0, 0.9]);
    var sizeScale = d3.scaleSqrt().domain([0, 1]).range([20,100]);
    pack.radius(d => scaleRadius(d.value))

    let nodes = pack(root).leaves().map(node => {
                const data = node.data;
                //console.log(data.alpha + " " + node.r + " " + scaleRadius(data.alpha));
                return {
                    x: centerX + (node.x - centerX) * 3,
                    y: centerY + (node.y - centerY) * 3,
                    r: 0,
                    borderRatio: 1,
                    idx: data.idx,
                    radius: node.r,
                    value: node.value,
                    wieght: data.weight,
                    words: data.words,
                    name: data.name
                }
            });
    
    var node = svg.selectAll('.node')
        .data(nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
                .on('start', (d) => {
                    if (!d3.event.active) simulation.alphaTarget(0.2).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (d) => {
                    d.fx = d3.event.x;
                    d.fy = d3.event.y;
                })
                .on('end', (d) => {
                    if (!d3.event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

    // simulation.nodes(nodes).on('tick', function() {
    //     node.attr('transform', d => `translate(${d.x},${d.y})`)
    //         .select('circle')
    //         .attr('r', d => d.r);
    // });


    // node.append('circle')
    //     .attr('id', d => d.idx)
    //     .attr('r', 0)
    //     .style('fill', d => scaleColor(rescaleValue(d.value)))
    //     .transition().duration(2000).ease(d3.easeElasticOut)
    //             .tween('circleIn', (d) => {
    //                 let i = d3.interpolateNumber(0, d.radius);
    //                 return (t) => {
    //                     d.r = i(t);
    //                     simulation.force('collide', forceCollide);
    //                 }
    //             })

    let focusedNode;

    simulation.nodes(nodes).on('tick', function() {
        node.attr('transform', d => `translate(${d.x},${d.y})`)
            .select('rect')
            .attr("rx", function(d) {
               
                return d.r * d.borderRatio;
            })
            .attr("ry", function(d) {
                    return d.r * d.borderRatio;
            })
            .attr('width', d => d.r * 2)
            .attr('height', d => d.r * 2)
            .attr('x', d => d.r * -1)
            .attr('y', d => d.r * -1);
    });

    var rect = node.append('rect')
        .attr('id', d => d.idx)
        .attr("rx", 0)
        .attr("ry", 0)
        .attr('width', 0)
        .attr('height', 0)
        .style('fill', d => scaleColor(rescaleValue(d.value)))
        .transition().duration(2000).ease(d3.easeElasticOut)
                .tween('circleIn', (d) => {
                    let i = d3.interpolateNumber(0, d.radius);

                    return (t) => {
                        d.r = i(t);
                        simulation.force('collide', forceCollide);
                    }
                })

    node.append("clipPath")
        .attr("id", d => `clip-${d.idx}`)
        .append("use")
        .attr("xlink:href", d => `#${d.idx}`);

    node.append('text')
        .attr("clip-path", d => `url(#clip-${d.idx}`)
        .selectAll('tspan')
        .data(d => d.name.split())
        .enter().append('tspan')
            .attr('x', 0)
            .attr('y', (d, i, nodes) => (13 + (i - nodes.length / 2 - 0.5) * 10))
            .text(name => name);

    
    d3.selection.prototype.moveToFront = function() {  
      return this.each(function(){
        this.parentNode.appendChild(this);
      });
    };
    
    d3.selection.prototype.moveToBack = function() {  
        return this.each(function() { 
            var firstChild = this.parentNode.firstChild; 
            if (firstChild) { 
                this.parentNode.insertBefore(this, firstChild); 
            } 
        });
    };


    // let wordCloud = node.append('foreginObject')
    //                 .classed('circle-overlay hidden', true)
    //                 .attr('x', -350 * 0.5 * 0.8)
    //                 .attr('y', -350 * 0.5 * 0.8)
    //                 .attr('height', 350 * 0.8)
    //                 .attr('width', 350 * 0.8)
    //                 .append('xhtml:div')
    //                 .classed('circle-overlay__inner', true);



    node.on('click', (selectedNode) => {
        d3.event.stopPropagation();
        
        let currentTarget = d3.event.currentTarget;
            if (selectedNode === focusedNode) {
                // no focusedNode or same focused node is clicked
                return;
            }
        let lastNode = focusedNode;
        focusedNode = selectedNode;

        simulation.alphaTarget(0.2).restart();

        if (lastNode) {
            node.filter((d, i) => i === lastNode.index)
                .transition().duration(500).ease(d3.easePolyOut)
                .tween('circleOut', () => {
                    let irl = d3.interpolateNumber(lastNode.r, lastNode.radius);
                    let irlBorder = d3.interpolateNumber(lastNode.borderRatio, 1);
                    return (t) => {
                        lastNode.r = irl(t);
                        lastNode.borderRatio = irlBorder(t);
                    }
                })
                .on('interrupt', () => {
                    lastNode.r = lastNode.radius;
                    lastNode.borderRatio = 1;
                });
        }

        d3.transition().duration(1000).ease(d3.easePolyOut)
            .tween('moveIn', () => {
                d3.select(currentTarget).moveToFront();

                let ir = d3.interpolateNumber(selectedNode.r, centerY * 0.5);
                let irBorder = d3.interpolateNumber(selectedNode.borderRatio, 0.1);
                
                return function(t) {
                    selectedNode.r = ir(t);
                    selectedNode.borderRatio = irBorder(t);

                    simulation.force('collide', forceCollide);
                };
            })
            .on('end', () => {
                    simulation.alphaTarget(0);
                    // let $currentGroup = d3.select(currentTarget);
                    // $currentGroup.select('.circle-overlay')
                    //     .classed('hidden', false);
                    // $currentGroup.select('.node-icon')
                    //     .classed('node-icon--faded', true);

                    console.log(selectedNode.name)
                    console.log("words:", selectedNode.words)
                    console.log("weight:", selectedNode.wieght)

                    
            })
            .on('interrupt', () => {
                    //console.log('move interrupt', selectedNode);
                    // currentNode.fx = null;
                    // currentNode.fy = null;
                    simulation.alphaTarget(0);

                    console.log(selectedNode.name)
                    console.log("words:", selectedNode.words)
                    console.log("weight:", selectedNode.wieght)
            });
        });

    d3.select(document).on('click', () => {
        let target = d3.event.target;

        if(focusedNode) {
            simulation.alphaTarget(0.2).restart();

            d3.transition().duration(500).ease(d3.easePolyOut)
                .tween('moveOut', function () {
                    //console.log('tweenMoveOut', focusedNode);
                    let ir = d3.interpolateNumber(focusedNode.r, focusedNode.radius);
                    let irlBorder = d3.interpolateNumber(focusedNode.borderRatio, 1);
                    
                    return function (t) {
                        focusedNode.r = ir(t);
                        focusedNode.borderRatio = irlBorder(t);
                        
                        simulation.force('collide', forceCollide);
                    };
                })
                .on('end', () => {
                    focusedNode = null;
                    simulation.alphaTarget(0);
                })
                .on('interrupt', () => {
                    simulation.alphaTarget(0);
                });
        }

    });
};


function load() {
    load_data(data_folder[1] + files.tw, function(e, i) {
        
        if (typeof i === "string") {
            set_tw(i);
            
        } else {
            view.error("Unable to load topic words from " + files.tw)
        }
    });
};