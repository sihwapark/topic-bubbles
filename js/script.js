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
        
        var v = 0;
        var w = e.words.map(function(i, n) {
            v += e.weights[n];
            return {
                word: i,
                weight: e.weights[n]
            }
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
    //let scaleColor = d3.scaleSequential(d3.interpolateOrRd);
    let scaleColor = d3.scaleSequential(d3.interpolateReds); 

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
    let rescaleValue = d3.scaleSqrt().domain([min, max]).range([0, 0.7]);
    var sizeScale = d3.scaleSqrt().domain([0, 1]).range([20,100]);
    pack.radius(d => scaleRadius(d.value))


    let nodes = pack(root).leaves().map(node => {
                const data = node.data;
                //console.log(data.alpha + " " + node.r + " " + scaleRadius(data.alpha), data.words);
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

    let focusedNode, focusedTarget;

    simulation.nodes(nodes).on('tick', function() {
        node.attr('transform', d => `translate(${d.x},${d.y})`)
            .select('rect')
            .attr("rx", d => d.r * d.borderRatio)
            .attr("ry", d => d.r * d.borderRatio)
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
        .classed('topic_name', true)
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


    // Word Cloud Implementation
    // based on Jason Davies's library, https://github.com/jasondavies/d3-cloud

    let wordCloudLayer = node.append('g')
                            .classed('wordcloud-overlay hidden', true)

    wordCloudLayer.append('rect')
            .attr('x', -centerY * 0.5 + 2)
            .attr('y', -centerY * 0.5 + 2)
            .attr('rx', (centerY * 0.5 - 2) * 0.1)
            .attr('ry', (centerY * 0.5 - 2) * 0.1)
            .attr('height', centerY - 4)
            .attr('width', centerY - 4)
            .style('fill', d3.rgb(255, 255, 255, 0.7));
            //.classed('wordcloud-overlay__inner', true);
    
    wordCloudLayer.append('text')
            //.attr("clip-path", d => `url(#clip-${d.idx}`)
            .attr('x', 0)
            .attr('y', (-centerY * 0.5) + 13 + 10)
            //.attr('fill', d3.rgb(255, 0, 0))
            //.attr('background-color', 'black')
            .attr('font-weight', 'bold')
            .text(d => {
                let fontSizeScale = d3.scaleSqrt().domain([0, 1]).range([5, 25]);

                var maxWeight = d.words[0].weight;
                var words_frequency = d.words.slice(0, 50).map(w => {
                    return {
                        text: w.word,
                        size: Math.floor(fontSizeScale(w.weight / maxWeight))
                    }
                });

                d3.layout.cloud().size([centerY - 10, centerY - 50])
                        .timeInterval(10)
                        .words(words_frequency)
                        .padding(3)
                        .rotate(0)//(~~(Math.random() * 6) - 3) * 30)
                        .fontSize(w => w.size)
                        .on('end', (words) => {
                            
                            var color = d3.scaleOrdinal(d3.schemeCategory20);

                            var layer = wordCloudLayer.filter((l,i) => l.idx == d.idx)

                            words.forEach(w => {
                                layer.append('text')
                                    .style('font-size', w.size + "px")
                                    .style("fill", color(w.size % 20))
                                    .attr("transform", 
                                      "translate(" + [w.x, w.y] + ")rotate(" + w.rotate + ")")   
                                    .text(w.text);
                            })

                            
                            
                                            // .selectAll('tspan')
                                            // .data(words)
                                            // .enter().append('tspan')
                                                    // 
                                            
                            // var layer = node.filter((l, i) => l.idx == d.idx).select('foreignObject');
                            // console.log(layer.attr('x'), layer.attr('y'));
                            //     //.classed('wordcloud-overlay__body', true)
                                
                                
                            //     layer
                            //     // .append('text')
                            //     //.attr('transform', 'translate(320,200)')
                            //     // .selectAll('text')
                            //     .data(words)
                            //     .enter().append('text')
                            //         .style("font-size", d => d.size + "px")
                            //         .style("fill", (d, i) => color(i))
                            //         .attr("transform", function(d) {
                            //           return "translate(" + [centerX + d.x, centerY + d.y] + ")rotate(" + d.rotate + ")";
                            //         })
                            //         .text(function(d) { return d.text; });

                        })
                        .start(); 

                return d.name;
            });
    

    
    // wordCloudLayer.append('p')
    //         .classed('circle-overlay__body', true)
    //         .html(d => d.desc);
       
    
    
    node.on('click', (selectedNode) => {
        d3.event.stopPropagation();
        
        let currentTarget = d3.event.currentTarget;
            if (selectedNode === focusedNode) {
                // no focusedNode or same focused node is clicked
                return;
            }
        let lastNode = focusedNode;
        let lastTarget = focusedTarget;
        focusedNode = selectedNode;
        focusedTarget = currentTarget;

        simulation.alphaTarget(0.2).restart();
        d3.selectAll('.wordcloud-overlay').classed('hidden', true);
        

        if (lastNode) {
            node.filter((d, i) => i === lastNode.index)
                .transition().duration(500).ease(d3.easePolyOut)
                .tween('rectToCircle', () => {
                    let irl = d3.interpolateNumber(lastNode.r, lastNode.radius);
                    let irlBorder = d3.interpolateNumber(lastNode.borderRatio, 1);
                    return (t) => {
                        lastNode.r = irl(t);
                        lastNode.borderRatio = irlBorder(t);
                    }
                })
                .on('end', () => {
                    d3.select(lastTarget).select('.topic_name').classed('hidden', false);
                })
                .on('interrupt', () => {
                    lastNode.r = lastNode.radius;
                    lastNode.borderRatio = 1;
                });
        }

        d3.transition().duration(1000).ease(d3.easePolyOut)
            .tween('circleToRect', () => {
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
                    let $currentGroup = d3.select(currentTarget);
                    $currentGroup.select('.wordcloud-overlay')
                        .classed('hidden', false);
                    $currentGroup.select('.topic_name').classed('hidden', true);
                    
                    //console.log($currentGroup);
                    
            })
            .on('interrupt', () => {
                    //console.log('move interrupt', selectedNode);
                    // currentNode.fx = null;
                    // currentNode.fy = null;
                    simulation.alphaTarget(0);
            });
        });

    d3.select(document).on('click', () => {
        let target = d3.event.target;

        if(focusedNode) {
            simulation.alphaTarget(0.2).restart();

            d3.transition().duration(500).ease(d3.easePolyOut)
                .tween('rectToCircle', function () {
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
                    d3.select(focusedTarget).select('.topic_name').classed('hidden', false);
                    focusedNode = null;
                    focusedTarget = null;
                    simulation.alphaTarget(0);
                })
                .on('interrupt', () => {
                    simulation.alphaTarget(0);
                });

            d3.selectAll('.wordcloud-overlay').classed('hidden', true);
        }

    });
};


function load() {
    load_data(data_folder[0] + files.tw, function(e, i) {
        
        if (typeof i === "string") {
            set_tw(i);
            
        } else {
            view.error("Unable to load topic words from " + files.tw)
        }
    });
};