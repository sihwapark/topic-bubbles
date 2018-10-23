var data_folder = ["data/"]
var files = {
        info: "info.json",
        meta: "meta.csv.zip",
        dt: "dt.json.zip",
        tw: "tw.json",
        topic_scaled: "topic_scaled.csv"
};

var data = {
};

var gui_elements = {
        'absolute range': false,
        'scaled': false,
        'search a word': ''
};

var simulation;
var centerX, centerY;
var width, height;

let forceCollide = d3.forceCollide(d => d.r + 1);
var init_nodes;
let scaleColor = d3.scaleSequential(d3.interpolateReds); 
var pack;
var root;
var data_nodes;
let focusedNode, focusedTarget;

var dataDomain;
var scaleRadius;
var scaleValue;

var coloringByKeyword = false;
var valueByKeyword = [];

function load() {
    
    load_data(data_folder[0] + files.topic_scaled, function(e, i) {
        if (typeof i === "string") {
            set_topic_scaled(i);
        } else {
            console.log("Unable to load a file " + files.topic_scaled)
        }
    });

    load_data(data_folder[0] + files.tw, function(e, i) {
    
        if (typeof i === "string") {
            set_tw(i);
        } else {
            console.log("Unable to load a file " + files.tw)
        }
    });
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

    data.tw = tw_json.tw.map(function(e, n) {
        
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
            words: w,
            wordCloud: []
        }
        return t
    }); 

    init();
    calculateWordClouds();
    
};

function set_topic_scaled(e) {
    var i;
    if (typeof e !== "string") {
        return
    }

    i = e.replace(/^\n*/, "").replace(/\n*$/, "\n");
    data.topic_scaled = d3.csvParseRows(i, function(e) {
        return e.map(parseFloat)
    });
};

function ticked() {

    var svg = d3.select("svg");
    var node = svg.selectAll('.node')
    
    if(gui_elements.scaled == false) {
        node.attr('transform', d => `translate(${d.x},${d.y})`);

    } else {
       
    }

    //console.log(node.filter((l,i) => l.idx == 45).data()[0]);

    node.select('rect')
    .attr("rx", d => d.r * d.borderRatio)
    .attr("ry", d => d.r * d.borderRatio)
    .attr('width', d => d.r * 2)
    .attr('height', d => d.r * 2)
    .attr('x', d => d.r * -1)
    .attr('y', d => d.r * -1)
    .style('fill', d => scaleColor(scaleValue(d.value)));
    // .style('fill', d => scaleColor(scaleValue(coloringByKeyword? valueByKeyword[d.idx].value : d.value)));
}

function init() {
     if(data.tw == undefined) return;
    
    var svg = d3.select("svg");
    width = svg.node().clientWidth;
    height = +svg.node().clientHeight;

    centerX = width * 0.5;
    centerY = height * 0.5;
    let strength = 0.05;

    pack = d3.pack()
        .size([width, height])
        .padding(0);

    simulation = d3.forceSimulation()
            .force('charge', d3.forceManyBody())
            .force('collide', forceCollide)
            .force('x', d3.forceX(centerX).strength(strength))
            .force('y', d3.forceY(centerY).strength(strength))
            .on("tick", ticked);

    root = d3.hierarchy({ children: data.tw })
            .sum(function(d) { return d.alpha; });

    setMappingScale();

    pack.radius(d => scaleRadius(d.value));
    
    data_nodes = pack(root).leaves().map(node => {
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
            name: data.name,
            endAngle: 0
        }
    });
}

function drawLegend() {

    var svg = d3.select('svg');

    var colorScale = d3.scaleSqrt()
      .domain(dataDomain)
      .range([scaleColor(scaleValue(dataDomain[0])), scaleColor(scaleValue(dataDomain[1]))]);

    svg.append("g")
      .attr("class", "legend-color")
      .attr("transform", "translate(" + [20, height - 120] + ")");
    
    svg.append("g")
      .attr("class", 'legend-size')
      .attr("transform", "translate(" + [100, height - 100] + ")")

    var steps
    var legendLinear = d3.legendColor()
      .labelFormat(d3.format(".2f"))
      .cells(5)
      .labelOffset(10)
      .title("Alpha Range")
      .scale(colorScale);
      

    let sizeScale = d3.scaleOrdinal()
            .domain(['low', 'high'])
            .range([5, 20] );
    
    let legendSize = d3.legendSize()
            .scale(sizeScale)
            .shape('circle')
            .shapePadding(40)
            .labelOffset(20)
            .labelAlign('end');

    svg.select(".legend-color")
      .call(legendLinear);

    svg.select(".legend-size")
      .call(legendSize);
}

function setMappingScale() {
    if(typeof data.alphaRange == 'undefined')
        data.alphaRange = [d3.min(data.tw, d => +d.alpha), d3.max(data.tw, d => +d.alpha)];

    var isAbsoluteValueRange = gui_elements['absolute range'];

    dataDomain = isAbsoluteValueRange? [0, 1] : data.alphaRange;
    scaleRadius = d3.scaleSqrt().domain(dataDomain).range([20, 80]);
    scaleValue = d3.scaleSqrt().domain(dataDomain).range([0, 0.7]);
}

function draw() {
    // based on the bubble chart example, https://naustud.io/tech-stack/
    var svg = d3.select("svg");

    var node = svg.selectAll('.node')
        .data(data_nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
                .on('start', (d) => {
                    if(gui_elements.scaled) return;
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

    simulation.nodes(data_nodes);

    var rect = node.append('rect')
        .attr('id', d => d.idx)
        .attr("rx", 0)
        .attr("ry", 0)
        .attr('width', 0)
        .attr('height', 0)
        .style('fill', d => scaleColor(scaleValue(d.value)))
        .style('cursor', 'pointer')
        .transition().duration(2000).ease(d3.easeElasticOut)
                .tween('circleIn', (d) => {
                    let i = d3.interpolateNumber(0, d.radius);

                    return (t) => {
                        d.r = i(t);
                        simulation.force('collide', forceCollide);
                    }
                })
    
    var arc = d3.arc();
    node.append('path')
        .classed('arc', true)
        .attr('id', d => d.idx)
        .attr('d', d => arc({
            innerRadius: 0,
            outerRadius: d.radius,
            startAngle:0,
            endAngle:0
        })).style('fill', 'orange');

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
            .style('cursor', 'pointer')
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
            .style('cursor', 'default')
            .text(d => {

                if(typeof data.wordCloud[d.idx] != 'undefined') {

                    var layer = wordCloudLayer.filter((l,i) => l.idx == d.idx);
                    
                    data.wordCloud[d.idx].forEach(w => { 
                        layer.append('text')
                            .style('font-size', w.size + "px")
                            //.style("fill", color(w.size % 20))
                            .style('cursor', 'default')
                            .attr("transform", 
                              "translate(" + [w.x, 20 + w.y] + ")rotate(" + w.rotate + ")")   
                            .text(w.text);
                    });
                }

                return d.name;
            });
    
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
                    $currentGroup.select('.arc').classed('hidden', true);
            })
            .on('interrupt', () => {
                    //console.log('move interrupt', selectedNode);
                    // selectedNode.fx = null;
                    // selectedNode.fy = null;
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
                    d3.select(focusedTarget).select('.arc').classed('hidden', false);
                    //d3.select(focusedNode).moveToBack();
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

    addGui();
    drawLegend();
}


function calculateWordClouds() {

    var task = 0;
    data.wordCloud = new Array();

    let fontSizeScale = d3.scaleSqrt().domain([0, 1]).range([5, 25]);

    data.tw.forEach((d, i) => {
        
        var maxWeight = d.words[0].weight;
        //done[i] = false;
        var words_frequency = d.words.slice(0, 50).map(w => {
            return {
                text: w.word,
                size: Math.floor(fontSizeScale(w.weight / maxWeight))
            }
        });

        d3.layout.cloud().size([centerY - 10, centerY - 50])
                .timeInterval(10)
                .words(words_frequency)
                .padding(5)
                .rotate(0)//(~~(Math.random() * 6) - 3) * 30)
                .fontSize(w => w.size)
                .on('end', (words) => {
                    data.wordCloud[i] = words;
                    task--;

                    if(task == 0)
                        draw();
                })
                .start();

        task++;
    });
}

function addGui() {
    var gui = new dat.GUI({ autoPlace: false });
    var customContainer = $('.gui').append($(gui.domElement));
    var svg = d3.select('svg');
    var scaled = gui.add(gui_elements, 'scaled');

    if(typeof data.topic_scaled != 'undefined' ) {
        scaled.onChange(() => {

            var nodes = svg.selectAll('.node')

            if(gui_elements.scaled) {

                simulation.stop();
                simulation.nodes([]);

                data.topic_scaled.forEach((scaled, i) => {

                    var node = nodes.filter(l => l.idx == i);
                        node.transition().duration(1000)
                            .attr('transform', d => {
                                 return 'translate(' + [centerX + width * scaled[0], centerY - height * scaled[1]] + ')'
                            })
                            .on('end', d => {
                                d.x = centerX + width * scaled[0];
                                d.y = centerY - height * scaled[1];
                            })
                            .on('interrupt', d => {
                                d.x = centerX + width * scaled[0];
                                d.y = centerY - height * scaled[1];     
                            });;
                });

                var aspect = width / height;
                var n = Math.floor(width / (2.1 * Math.sqrt(aspect * data.tw.length)));
                var i = n * 1.8;
                var o = 1.1 * n;

                var xScale = d3.scaleLinear().domain([0, width]).range([o, width - o]);
                var yScale = d3.scaleLinear().domain([height, 0]).range([height - o, o]);
                
                svg.call(d3.zoom().scaleExtent([1, 15])
                                    .on("zoom", function() {
                                    
                                    var transform = d3.event.transform;
                                    var scaledX, scaledY;
                                    
                                    nodes.transition().duration(1)
                                        .attr("transform", d => {
                                            scaledX = transform.applyX(xScale(d.x));
                                            scaledY = transform.applyY(yScale(d.y));

                                            return 'translate(' + [scaledX, scaledY ] + ')';
                                        })
                                }));

            } else {
                svg.on("mousedown.zoom", null);
                svg.on("mousemove.zoom", null);
                svg.on("dblclick.zoom", null);
                svg.on("touchstart.zoom", null);
                svg.on("wheel.zoom", null);
                svg.on("mousewheel.zoom", null);
                svg.on("MozMousePixelScroll.zoom", null);

                simulation.nodes(nodes.data());
                simulation.alphaTarget(0.2).restart();
                
            }
        });
    } else {
        scaled.domElement.childNodes[0].disabled = true;
    }


    gui.add(gui_elements, 'absolute range').onChange(() => {

        setMappingScale();
        svg.select('.legend-color').remove();
        svg.select('.legend-size').remove();

        drawLegend();

        var rect = svg.selectAll('.node rect[id]')
        
        simulation.alphaTarget(0.2).restart();

        rect.transition().duration(1000).ease(d3.easeElasticOut)
                .tween('circleResize', (d) => {
                    var src = d.r;
                    d.radius = scaleRadius(d.value);
                    var dst = (focusedNode && focusedNode.idx == d.idx)? src : d.radius;
                    
                    let i = d3.interpolateNumber(src, dst);

                    return (t) => {

                        d.r = i(t);
                        simulation.force('collide', forceCollide);
                    }
                })
                .on('end', (t) => {
                    
                    simulation.alphaTarget(0);
                                       
                })
                .on('interrupt', () => {
                    
                    simulation.alphaTarget(0);
                });

    });

    // function for searching a keyword to find what topics include the keyword 
    // it 
    gui.add(gui_elements, 'search a word').onFinishChange(keyword => {
        let isKeywordEmpty = (keyword == '');
        var result = [];
        
        coloringByKeyword = !isKeywordEmpty;

        if(isKeywordEmpty == false) {
            data.tw.forEach((d, i) => {
            
                let weight = d.weight;
                result[i] = {idx: i, value: 0};

                d.words.find(w => {

                    if(w.word == keyword) {
                        //console.log(i, w.weight/weight);
                        result[i] = {idx: i, value: w.weight / weight};
                    }
                });
            
            });
        }


        valueByKeyword = result;

        var rect = svg.selectAll('.node rect[id]');
        var arcPath = svg.selectAll('.node path[id]');
        var arc = d3.arc();

        console.log(arcPath);

        //let scaleByKeyword = d3.scaleSqrt().domain([0, d3.max(result, d => +d.value)]).range([0, 80]);
        let scaleByKeyword = d3.scaleSqrt().domain([0, 1]).range([0, 80]);

        rect.transition().duration(1000).ease(d3.easeElasticOut)
                .tween('circleSearch', (d) => {
                    var src = d.r;
                    // d.radius = isKeywordEmpty? scaleRadius(d.value) : scaleByKeyword(result[d.idx].value);
                    d.radius = isKeywordEmpty? scaleRadius(d.value) : (result[d.idx].value > 0)? scaleRadius(d.value) : 0;

                    var dst = (focusedNode && focusedNode.idx == d.idx)? src : d.radius;
                    let i = d3.interpolateNumber(src, dst);

                    return (t) => {
                        d.r = i(t);
                        if(d.r < 0) d.r = 0;
                        simulation.force('collide', forceCollide);
                    }
                })
                .on('end', (t) => {
                    
                    simulation.alphaTarget(0);
                                       
                })
                .on('interrupt', () => {
                    
                    simulation.alphaTarget(0);
                });

        arcPath.transition().duration(1000)
                    .attrTween('d', (d) => {
                        let newAngle = isKeywordEmpty? 0 : 2 * Math.PI * result[d.idx].value;
                        let i = d3.interpolateNumber(d.endAngle, newAngle);

                        return (t) => {
                            d.endAngle = i(t);
                            
                            return arc({
                                  innerRadius: 0,
                                  outerRadius: d.radius,
                                  startAngle: 0,
                                  endAngle: d.endAngle
                                });
                        }
                    });

        simulation.alphaTarget(0.2).restart();

        //result.sort(function(a, b) { return b.value - a.value });

        //console.log(result);

        // f(typeof data.alphaRange == 'undefined')
        // data.alphaRange = [d3.min(data.tw, d => +d.alpha), d3.max(data.tw, d => +d.alpha)];

        // var isAbsoluteValueRange = gui_elements['absolute range'];

        // dataDomain = isAbsoluteValueRange? [0, 1] : data.alphaRange;
        // scaleRadius = d3.scaleSqrt().domain(dataDomain).range([20, 80]);
        // scaleValue = d3.scaleSqrt().domain(dataDomain).range([0, 0.7]);
        
    });
}