var data_folder = ['data/']
//var data_folder = ['data/us_canada_humanities_2017/']
var files = {
        info: 'info.json',
        meta: 'meta.csv.zip',
        dt: 'dt.json.zip',
        tw: 'tw.json',
        topic_scaled: 'topic_scaled.csv',
        auto_labels_supervised: 'output_supervised_.csv',
        auto_labels_unsupervised: 'output_unsupervised_.csv'
};

var data = {
};

var gui_elements = {
        'absolute range': false,
        'scaled': false,
        'search for words': '',
        'clear search': clearSearch
};

var simulation;
var centerX, centerY;
var width, height;
var minWordCloudSize = 400;
let forceCollide = d3.forceCollide(function(d) { return (d.clicked)? d.r * 1.2 : d.r + 2; });
var init_nodes;
let scaleColor = d3.scaleSequential(d3.interpolateReds); 
var pack;
var root;
var data_nodes;

var dataDomain;
var scaleRadius;
var scaleValue;

var coloringByKeyword = false;
var valueByKeyword = [];
var isMSIE = false; // check if a web browser is IE
var isFF = false; // check if a web browser is Firefox

var lastTransform;
var zoom;

var searchInput; 

var worker = new Worker('js/worker.min.js');
var expandedWidthScale = 2.0;
var expandedHeightScale = 2.0;

function load() {
    worker.fs = d3.map();
    worker.onmessage = function(e) {
        var i = worker.fs.get(e.data.what);
        if (i) {
            i(e.data.result);
        }
    };

    worker.callback = function(e, i) {
        worker.fs.set(e, i);
    };

    load_data(data_folder[0] + files.topic_scaled, function(e, i) {
        if (typeof i === 'string') {
            set_topic_scaled(i);

            load_data(data_folder[0] + files.tw, function(e, i) {
                if (typeof i === 'string') {
                    set_tw(i);

                    load_data(data_folder[0] + files.dt, function(e, i) {
    
                        set_dt(i, function(e) {
                            if (e) {
                                load_data(data_folder[0] + files.meta, function(e, i) {
                                    if (typeof i === 'string') {
                                        set_meta(i);
                                    } else {
                                        view.error('Unable to load a file ' + files.meta)
                                    }
                                });
                            } else {
                                console.log('Unable to load a file ' + files.dt)
                            }
                        });

                        // console.log(i);

                        //data.dt = i;
                    });
                } else {
                    console.log('Unable to load a file ' + files.tw);
                }
            });
        } else {
            console.log('Unable to load a file ' + files.topic_scaled);
        }
    });

    // load_data(data_folder[0] + files.auto_labels_unsupervised, function(e, i) {
    //     if(typeof i === 'string') {
    //         set_auto_labels(i, 'unsupervised');
    //         load_data(data_folder[0] + files.auto_labels_supervised, function(e, i) {
    //             if(typeof i === 'string') {
    //                 set_auto_labels(i, 'supervised');
    //             } else {
    //                 console.log('Unable to load a file ' + files.auto_labels_supervised);
    //             }
    //         });

    //     } else {
    //         console.log('Unable to load a file ' + files.auto_labels_unsupervised);
    //     }
    // });
};

function load_data(e, t) {
    var i, n;
    if (typeof e === 'undefined') {
        return t('target undefined', undefined);
    }
    i = e.replace(/^.*\//, '');
    n = d3.select('#m__DATA__' + i.replace(/\..*$/, ''));
    if (!n.empty()) {
        return t(undefined, JSON.parse(n.html()));
    }
    if (e.search(/\.zip$/) > 0) {
        return d3.buffer(e).then(function(n) {
            var o, r;
            if(n && n.byteLength) {
                o = new JSZip(n);
                r = o.file(i.replace(/\.zip$/, '')).asText();
            }
            return t(e, r);
        })
    }

    return d3.text(e).then(function(data) {
        return t(e, data);
    })
};

function set_dt(e, i) {
    if (typeof e !== 'string') {
        i(false)
    }

    worker.callback('set_dt', function(e) {
        //data.dt = e;
        i(e)
    });

    worker.postMessage({
        what: 'set_dt',
        dt: JSON.parse(e)
    });
}

function set_meta(e) {
    var i = e.replace(/^\n*/, "").replace(/\n*$/, "\n");
    
    data.docs = d3.csvParseRows(i, function(e, i) {
            
        var d = new Date(e[6].trim())
        if(d == 'Invalid Date')
            d = new Date();

        var n;
        n = {
            doi: e[0].trim(),
            title: e[1].trim(),
            authors: e[2].trim(),
            journal: e[3].trim(),
            volume: e[4].trim(),
            issue: e[5].trim(),
            date: d,
            pagerange: e[7].trim().replace(/^p?p\. /, "").replace(/-/g, "–")
        };
        e.slice(8, e.length).forEach(function(e, i) {
            n[t.extra_fields[i] || "X" + String(i)] = e.trim()
        });
        return n;
    });

    init();
    draw();
}

function set_tw(e) {
    var tw_json;
    
    if (typeof e !== 'string') {
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
            name: 'Topic ' + (n + 1),
            weight: v,
            alpha: tw_json.alpha[n],
            words: w,
            wordCloud: []
        }
        return t;
    }); 
};  

function set_topic_scaled(e) {
    var i;
    if (typeof e !== 'string') {
        return
    }

    i = e.replace(/^\n*/, '').replace(/\n*$/, '\n');
    data.topic_scaled = d3.csvParseRows(i, function(d) {
        return d.map(parseFloat)
    });
};

function set_auto_labels(e, type) {
    
    if (typeof e !== 'string') {
        return
    }
    
    if(typeof data.auto_labels == 'undefined') {
        data.auto_labels = d3.csvParseRows(e, function(d) {
            return { idx: d[0], labels: {[type]: d.slice(1) }};
        });
    } else {
        d3.csvParseRows(e, function(d, i) {
            data.auto_labels[i].labels[type] = d.slice(1);
        });
    }
}

//Text wrapping based on https://bl.ocks.org/mbostock/7555321
function wrap(text, width) {

    text.each(function () {
        var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, // ems
            x = text.attr('x'),
            y = text.attr('y'),
            dy = 0, //parseFloat(text.attr("dy")),
            tspan = text.text(null)
                        .append('tspan')
                        .attr('x', x)
                        .attr('y', y)
                        .attr('dy', dy + 'em')
                        .attr('dominant-baseline', 'text-before-edge');

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(' '));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(' '));
                line = [word];
                tspan = text.append('tspan')
                            .attr('x', x)
                            .attr('y', y)
                            .attr('dy', ++lineNumber * lineHeight + dy + 'em')
                            .attr('dominant-baseline', 'text-before-edge')
                            .text(word);
            }
        }
    });
}

function show_docs_list(topic_idx, docLayer) {

    var leftX = minWordCloudSize * 0.5;
    var topY= -minWordCloudSize * 0.5;

    var docs = data.topic_docs[topic_idx].citations.map(function(d, i) {
                    return {
                                id: data.topic_docs[topic_idx].docs[i].doc,
                                frac: data.topic_docs[topic_idx].docs[i].frac,
                                weight: data.topic_docs[topic_idx].docs[i].weight,
                                citation: d
                            };
                });
    
    docLayer.selectAll('text.doc')
            .data(docs).enter()
                        .append('foreignObject')
                            .attr('x',  leftX + 15)
                            .attr('y', function(d, i) { return topY + 5 + (i + 1) * 37; })
                            .attr('width', minWordCloudSize - 20)
                            .attr('height', 37)
                            .append('xhtml:div')
                                .style('text-align', 'left')
                                .style('font-size', '12px')
                                .style('word-wrap', 'break-word')
                                .on('mouseover', function(d) {
                                    d3.select(this)
                                        .style('text-decoration', 'underline')
                                        .style('cursor', 'pointer');
                                })
                                .on('mouseout', function(d) {
                                    d3.select(this)
                                        .style('text-decoration', 'none')
                                        .style('cursor', 'default');
                                })
                                .on('click', function(d) {
                                    window.open(d.citation.doi);
                                })
                                .html(function(d) { return '\"' + d.citation.title + '\", ' + d.citation.journal; });
}

function show_sources(topic_idx, sourceLayer) {
    sources = [];
    data.topic_docs[topic_idx].citations.forEach(function(d, i) {

        var name = d.journal;
        var substringIndex = name.indexOf(' (');
        if(substringIndex != -1) name = name.slice(0, substringIndex);
        
        var s = sources.find(function(d) {
            return d.name == name;
        });

        if(typeof s === 'undefined') {
            s = {name: name, weight: 0, index:[]};
            sources.push(s);
        }

        s.weight += data.topic_docs[topic_idx].docs[i].weight;
        s.index.push(i);
    });

    sources.sort(function(a, b) { return b.weight - a.weight; });
    data.topic_sources[topic_idx] = sources;
    var weights = sources.map(function(d) { return d.weight});

    var x = d3.scaleBand()
            .range([0, minWordCloudSize * 0.7])
            .domain(sources.map(function(d) { return d.name; }))
            .padding(1);
    
    sourceLayer.append('g')
        .attr('transform', 'translate(-' + (minWordCloudSize * 0.35) + ', ' + (minWordCloudSize + 50) + ')')
        .call(d3.axisBottom(x))
        .selectAll('text')
            .attr('transform', 'translate(-10, 0)rotate(-45)')
            //.call(wrap, 100)
            .style('font-size', '10px')
            .style('text-anchor', 'end');

    var y = d3.scaleLinear()
            .domain([0, d3.max(weights) * 1.1])
            .range([minWordCloudSize * 0.5 - 25, 0]);

    var g = sourceLayer.append('g')
        .attr('transform', 'translate(-' + (minWordCloudSize * 0.35) + ', ' + (minWordCloudSize * 0.5 + 75) + ')')
        .call(d3.axisLeft(y).tickPadding(20))
       
    g.selectAll('text')
        .style('font-size', '10px');

    sourceLayer.append('text')
        .attr('transform', 'translate(-' + (minWordCloudSize * 0.35) + ', ' + (minWordCloudSize * 0.5 + 70) + ')')
        .style('font-size', '10px')
        .style('text-anchor', 'end')
        .text('Weight');

    g.selectAll('source-lines')
        .data(sources)
        .enter()
        .append('line')
            .attr('x1', function(d) { return x(d.name); })
            .attr('x2', function(d) { return x(d.name); })
            .attr('y1', function(d) { return y(d.weight); })
            .attr('y2', y(0))
            .attr('stroke', 'grey');

    g.selectAll('source-circles')
        .data(sources)
        .enter()
        .append('circle')
            .attr('cx', function(d) { return x(d.name); }) 
            .attr('cy', function(d) { return y(d.weight); })
            .attr('r', 5)
            .style('fill', d3.rgb(0, 200, 255, 0.7))
            .attr('stroke', 'black');
}

function topic_docs(topic_idx, num, docListLayer, sourceLayer) {
    if(typeof data.topic_docs === 'undefined')
        data.topic_docs = {};
    
    if(typeof data.topic_sources === 'undefined')
        data.topic_sources = {};

    if(typeof data.topic_docs[topic_idx] != 'undefined') {
        show_docs_list(topic_idx, docListLayer);
        show_sources(topic_idx, sourceLayer);
        return;
    }

    var result = function(d) {
        data.topic_docs[topic_idx] = {
            t: topic_idx,
            docs: d,
            citations: d.map(function(e) {
                return data.docs[e.doc];
            }),
            weight: d3.sum(d, function(e) {
                return e.weight;
            })
        };

        show_docs_list(topic_idx, docListLayer);
        show_sources(topic_idx, sourceLayer);
    }

    worker.callback("topic_docs/" + topic_idx + "/" + num, result);
    worker.postMessage({
        what: "topic_docs",
        t: topic_idx,
        n: num
    });
}

function ticked() {

    var svg = d3.select('svg');
    var node = svg.selectAll('.node')
    
    if(gui_elements.scaled == false) {
        node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });

    } else {
        node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });       
    }

    //console.log(node.filter((l,i) => l.idx == 45).data()[0]);

    node.select('rect')
    .attr('rx', function(d) { return d.r * d.borderRatio; })
    .attr('ry', function(d) { return d.r * d.borderRatio; })
    .attr('width', function(d) { return (d.expanded)? minWordCloudSize * expandedWidthScale : d.r * 2; })
    .attr('height', function(d) { return (d.expanded)? minWordCloudSize * expandedHeightScale: d.r * 2; })
    .attr('x', function(d) { return d.r * -1; })
    .attr('y', function(d) { return d.r * -1; })
    .style('fill', function(d) { return scaleColor(scaleValue(d.value)); });
    // .style('fill', function(d) { return scaleColor(scaleValue(coloringByKeyword? valueByKeyword[d.idx].value : d.value)));
}

function init() {
    if(typeof data.tw == 'undefined') return;
    
    var container = d3.select('.container').node();
    var header = d3.select('.header').node();
    container.style.height = (window.innerHeight - header.offsetHeight) + 'px';
    
    var ua = window.navigator.userAgent;
    isMSIE = (ua.indexOf('MSIE ') > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./));
    isFF = (ua.indexOf('Firefox') > 0);

    var svg = d3.select('svg');
    var svgClientNode = (isFF)? svg.node().parentNode : svg.node();
    width = svgClientNode.clientWidth;
    height = svgClientNode.clientHeight;

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
            .on('tick', ticked);

    root = d3.hierarchy({ children: data.tw })
            .sum(function(d) { return d.alpha; });

    setMappingScale();

    pack.radius(function(d) { return scaleRadius(d.value); });
    
    data_nodes = pack(root).leaves().map(function(node) {
        const data = node.data;
        //console.log(data.alpha + ' ' + node.r + ' ' + scaleRadius(data.alpha), data.words);
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
            clicked: false,
            expanded: false
        }
    });

    data.wordCloud = new Array();
    data.searchedWords = new Array();
}

function drawLegend() {

    var svg = d3.select('svg');

    var colorScale = d3.scaleSqrt()
      .domain(dataDomain)
      .range([scaleColor(scaleValue(dataDomain[0])), scaleColor(scaleValue(dataDomain[1]))]);

    svg.append('g')
      .attr('class', 'legend-color')
      .attr('transform', 'translate(' + [20, height - 120] + ')');
    
    svg.append('g')
      .attr('class', 'legend-size')
      .attr('transform', 'translate(' + [100, height - 100] + ')');

    svg.append('g')
      .attr('class', 'legend-search')
      .attr('transform', 'translate(' + [200, height - 120] + ')');

    var legendLinear = d3.legendColor()
      .labelFormat(d3.format('.2f'))
      .cells(5)
      .labelOffset(10)
      .title('Alpha Range')
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

    svg.select('.legend-color')
      .call(legendLinear);

    svg.select('.legend-size')
      .call(legendSize);
}

function setMappingScale() {
    if(typeof data.alphaRange == 'undefined')
        data.alphaRange = [d3.min(data.tw, function(d) { return +d.alpha; }), d3.max(data.tw, function(d) { return +d.alpha; })];

    var isAbsoluteValueRange = gui_elements['absolute range'];

    dataDomain = isAbsoluteValueRange? [0, 1] : data.alphaRange;
    scaleRadius = d3.scaleSqrt().domain(dataDomain).range([20, 80]);
    scaleValue = d3.scaleSqrt().domain(dataDomain).range([0, 0.7]);
}

function draw() {
    // based on the bubble chart example, https://naustud.io/tech-stack/
    var svg = d3.select('svg');

    svg.style('cursor', 'move');
    var g = svg.append('g');
    zoom = d3.zoom();
    lastTransform = d3.zoomIdentity;
    setNormalZoom(svg);

    var node = g.selectAll('.node')
        .data(data_nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
                .on('start', function(d) {
                    if(gui_elements.scaled) return;
                    if (!d3.event.active) simulation.alphaTarget(0.2).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', function(d) {
                    d.fx = d3.event.x;
                    d.fy = d3.event.y;
                })
                .on('end', function(d) {
                    if (!d3.event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

    simulation.nodes(data_nodes);

    var rect = node.append('rect')
        .attr('id', function(d) { return d.idx; })
        .attr('rx', 0)
        .attr('ry', 0)
        .attr('width', 0)
        .attr('height', 0)
        .style('fill', function(d) { return scaleColor(scaleValue(d.value)); })
        .style('cursor', 'pointer')
        .transition().duration(2000).ease(d3.easeElasticOut)
                .tween('circleIn', function(d) {
                    let i = d3.interpolateNumber(0, d.radius);

                    return function(t) {
                        d.r = i(t);
                        simulation.force('collide', forceCollide);
                    }
                })
    
    node.append('clipPath')
        .attr('id', function(d) { return "clip-" + d.idx; })
        .append('use')
        .attr('xlink:href', function(d) { return "#" + d.idx; });

    // node.append('text')
    //     .classed('topic_name', true)
    //     .attr('clip-path', function(d) { return "url(#clip-" + d.idx; })
    //     .selectAll('tspan')
    //     .data(function(d) { return d.name.split(); })
    //     .enter().append('tspan')
    //         .style('cursor', 'pointer')
    //         .text(function(name) { return name; });

    node.append('g')
        .classed('topic_name', true)
        .style('cursor', 'pointer')
        .attr('clip-path', function(d) { return "url(#clip-" + d.idx + ")"; })
        .append('foreignObject')
                .attr('x', function(d) { return -d.radius;})
                .attr('y', function(d) { return -d.radius;})
                .attr('width', function(d) { return d.radius * 2;})
                .attr('height', function(d) { return d.radius * 2;})
                .append('xhtml:div')
                    .style('line-height', function(d) { return d.radius * 2 + 'px';})
                    .style('text-align', 'center')
                    .style('font-size', '13px')
                    .style('white-space', 'nowrap')
                    .html(function(d) { return d.name; });
    
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
                            .classed('wordcloud-overlay hidden', true);
    let leftX = topY= -minWordCloudSize * 0.5;
    let rightX = minWordCloudSize * 0.5;

    wordCloudLayer.append('rect')
            .attr('x', leftX + 2)
            .attr('y', topY + 2)
            .attr('rx', (minWordCloudSize * 0.5 - 2) * 0.1)
            .attr('ry', (minWordCloudSize * 0.5 - 2) * 0.1)
            .attr('height', minWordCloudSize - 4)
            .attr('width', minWordCloudSize - 4)
            .style('fill', d3.rgb(255, 255, 255));
    
    
    var closeButton = wordCloudLayer.append('g');
    let buttonRadius = 10;
    let crossOffset = buttonRadius * 0.5
    let buttonCenterX = rightX - buttonRadius * 2;
    let buttonCenterY = topY + buttonRadius * 2;

    closeButton.append('circle')
            .attr('cx', buttonCenterX)
            .attr('cy', buttonCenterY)
            .attr('r', buttonRadius)
            .style('fill', d3.rgb(255, 0, 0, 0.7))
            .style('cursor', 'pointer');

    closeButton.on('click', function(selectedNode) {
                let selectedTarget = node.filter(function(d, i) { return (d.idx === selectedNode.index); });
                if(selectedNode.expanded) { 
                    toggleFullView(selectedNode, selectedTarget);
                }
                closeBubble(selectedNode, selectedTarget);
            });

    var cross = closeButton.append('g');

    cross.style('cursor', 'pointer');

    cross.append('line')
            .attr("x1", buttonCenterX - buttonRadius + crossOffset)
            .attr("y1", buttonCenterY)
            .attr("x2", buttonCenterX + buttonRadius - crossOffset)
            .attr("y2", buttonCenterY);
            
    cross.append('line')
            .attr("x1", buttonCenterX)
            .attr("y1", buttonCenterY - buttonRadius + crossOffset)
            .attr("x2", buttonCenterX)
            .attr("y2", buttonCenterY + buttonRadius  - crossOffset);

    cross.attr("transform", "rotate (45," + buttonCenterX + "," + buttonCenterY + ")");

    cross.style('stroke', 'black')
        .style('stroke-width', 1.5);

    // var toggleExpandButton = wordCloudLayer.append('g')
    //                             .classed('toggle-full-view', true);

    // var toggleButtonWidth = 8;
    // var toggleButtonHeight = 40;

    // var toggleButtonX = buttonCenterX;
    // var toggleButtonY = topY + minWordCloudSize * 0.5 - toggleButtonHeight * 0.5;
    // var offset = 5;
    // var toggleButtonCenterX = toggleButtonX + toggleButtonWidth * 0.5;
    // var toggleButtonCenterY = toggleButtonY + toggleButtonHeight * 0.5;

    // toggleExpandButton.append('rect')
    //         .attr('x', toggleButtonX - offset * 0.5)
    //         .attr('y', toggleButtonY - offset * 0.5)
    //         .attr('rx', (toggleButtonWidth + offset) * 0.1)
    //         .attr('ry', (toggleButtonHeight + offset) * 0.1)
    //         .attr('height', toggleButtonHeight + offset)
    //         .attr('width', toggleButtonWidth + offset)
    //         .style('fill', d3.rgb(220, 220, 220, 0.7))
    //         .style('cursor', 'pointer');


    // var arrow = toggleExpandButton.append('g')
    //                                 .classed('toggle-arrow', true);
    // arrow.style('cursor', 'pointer');
    // arrow.append('line')
    //         .attr("x1", toggleButtonX)
    //         .attr("y1", toggleButtonY)
    //         .attr("x2", toggleButtonCenterX - 1)
    //         .attr("y2", toggleButtonCenterY);

    // arrow.append('line')
    //         .attr("x1", toggleButtonX)
    //         .attr("y1", toggleButtonCenterY + toggleButtonHeight * 0.5)
    //         .attr("x2", toggleButtonCenterX - 1)
    //         .attr("y2", toggleButtonCenterY);

    // arrow.append('line')
    //         .attr("x1", toggleButtonCenterX + 1)
    //         .attr("y1", toggleButtonY)
    //         .attr("x2", toggleButtonCenterX + toggleButtonWidth * 0.5)
    //         .attr("y2", toggleButtonCenterY);

    // arrow.append('line')
    //         .attr("x1", toggleButtonCenterX + 1)
    //         .attr("y1", toggleButtonCenterY + toggleButtonHeight * 0.5)
    //         .attr("x2", toggleButtonCenterX + toggleButtonWidth * 0.5)
    //         .attr("y2", toggleButtonCenterY);

    // arrow.style('stroke', 'black')
    //     .style('stroke-width', 1);

    // toggleExpandButton.on('click', function(selectedNode) {
    //             let selectedTarget = node.filter(function(d, i) { return (d.idx === selectedNode.index); });
    //             toggleFullView(selectedNode, selectedTarget)
    //         });
    

    // wordCloudLayer.append('text')
    //         .attr('x', 0)
    //         .attr('y', topY + 25)
    //         .attr('background-color', 'black')
    //         .attr('font-weight', 'bold')
    //         .style('cursor', 'text-')
    //         .text(function(d) {
    //             return d.name;
    //         });

    var fo = wordCloudLayer.append('foreignObject')
            .attr('x', -50)
            .attr('y', topY + 10)
            .attr('width', 100)
            .attr('height', 25);
           
    var div = fo.append('xhtml:div')
                .style('line-height', '25px')
                .style('text-align', 'center')
                .style('font-weight', 'bold')
                .style('font-size', '13px')
                .html(function(d) { return d.name; });

    var expandButton = wordCloudLayer.append('g').classed('expand-button', true);
    buttonCenterY = topY + minWordCloudSize - 4 - buttonRadius * 2;
    expandButton.append('circle')
            .attr('cx', buttonCenterX)
            .attr('cy', buttonCenterY)
            .attr('r', buttonRadius)
            .style('fill', d3.rgb(0, 200, 255, 0.7))
            .style('cursor', 'pointer');
    
    var expandButtonTriangle = expandButton.append('g').classed('expand-triangle', true);
    var symbolGenerator = d3.symbol().type(d3.symbolTriangle).size(50);
    expandButtonTriangle.append('path')
            .attr('d',symbolGenerator)
            .attr('transform', 'translate(' +[buttonCenterX, buttonCenterY] + ')rotate(15)')
            .style('fill', 'black')
            .style('cursor', 'pointer');


    expandButton.on('click', function(selectedNode) {
                let selectedTarget = node.filter(function(d, i) { return (d.idx === selectedNode.index); });
                toggleFullView(selectedNode, selectedTarget)
            });

    leftX = minWordCloudSize * 0.5;
    topY= -minWordCloudSize * 0.5;

    // let autoLabels =  node.append('g')
    //                     .classed('auto-labels hidden', true)

    // autoLabels.append('rect')
    //         .attr('x', leftX)
    //         .attr('y', topY + 2)
    //         .attr('rx', (minWordCloudSize * 0.5 - 2) * 0.1)
    //         .attr('ry', (minWordCloudSize * 0.5 - 2) * 0.1)
    //         .attr('height', minWordCloudSize - 4)
    //         .attr('width', minWordCloudSize * 0.5 - 2)
    //         .style('fill', d3.rgb(255, 255, 255, 0.6));

    // autoLabels.append('text')
    //     .attr('x', leftX + (minWordCloudSize * 0.5 - 2) * 0.5)
    //     .attr('y', topY + 25)
    //     .attr('font-weight', 'bold')
    //     .style('cursor', 'default')
    //     .text(function(d) {
    //         return 'Automatic Labels';
    //     });

    let docLists = node.append('g')
                        .classed('doc-list hidden', true)

    docLists.append('rect')
            .attr('x', leftX)
            .attr('y', topY + 2)
            .attr('rx', (minWordCloudSize * 0.5 - 2) * 0.1)
            .attr('ry', (minWordCloudSize * 0.5 - 2) * 0.1)
            .attr('height', minWordCloudSize * expandedHeightScale - 4)
            .attr('width', minWordCloudSize * expandedWidthScale * 0.5 - 2)
            .style('fill', d3.rgb(255, 255, 255, 0.8));

    var fo = docLists.append('foreignObject')
            .attr('x', leftX + (minWordCloudSize * expandedWidthScale * 0.5 - 2) * 0.5 - 125)
            .attr('y', topY + 10)
            .attr('width', 250)
            .attr('height', 25);
           
    var div = fo.append('xhtml:div')
                .style('line-height', '25px')
                .style('text-align', 'center')
                .style('font-weight', 'bold')
                .style('font-size', '13px')
                .style('cursor', 'default')
                .html('Top 20 Documents');

    leftX = -minWordCloudSize * 0.5;
    topY= minWordCloudSize * 0.5;    

    let sources = node.append('g')
                        .classed('source-view hidden', true)

    sources.append('rect')
            .attr('x', leftX + 2)
            .attr('y', topY)
            .attr('rx', (minWordCloudSize * 0.5 - 2) * 0.1)
            .attr('ry', (minWordCloudSize * 0.5 - 2) * 0.1)
            .attr('height', minWordCloudSize * expandedHeightScale - minWordCloudSize  - 2)
            .attr('width', minWordCloudSize * expandedWidthScale * 0.5 - 4)
            .style('fill', d3.rgb(255, 255, 255, 0.8));

    fo = sources.append('foreignObject')
            .attr('x', leftX + (minWordCloudSize * expandedWidthScale * 0.5 - 4) * 0.5 - 125)
            .attr('y', topY + 10)
            .attr('width', 250)
            .attr('height', 25);
           
    div = fo.append('xhtml:div')
                .style('line-height', '25px')
                .style('text-align', 'center')
                .style('font-weight', 'bold')
                .style('font-size', '13px')
                .style('cursor', 'default')
                .html('Sources of Top 20 Documents');

    node.on('click', function(selectedNode) {
        let currentTarget = d3.event.currentTarget;
        d3.select(currentTarget).moveToFront();

        if(selectedNode.clicked == true) return;

        selectedNode.clicked = true;
        //window.location.hash = 'clicked_' + selectedNode.idx;

        if(typeof data.wordCloud[selectedNode.idx] == 'undefined') {
            //console.log(selectedNode.idx + ' word cloud layout started');

            let fontSizeScale = d3.scaleSqrt().domain([0, 1]).range([5, 25]);
            var maxWeight = selectedNode.words[0].weight;
            var words_frequency = selectedNode.words.slice(0, 50).map(function(w) {
                return {
                    text: w.word,
                    size: Math.floor(fontSizeScale(w.weight / maxWeight))
                }
            });

            d3.layout.cloud().size([minWordCloudSize - 15, minWordCloudSize - 50])
                    .timeInterval(10)
                    .words(words_frequency)
                    .padding(5)
                    .rotate(0)//(~~(Math.random() * 6) - 3) * 30)
                    .fontSize(function(w) { return w.size; })
                    .on('end', function(words) {
                        data.wordCloud[selectedNode.idx] = words;
                        //console.log(selectedNode.idx + ' word cloud layout ended');

                        var layer = wordCloudLayer.filter(function(l,i) { return (l.idx == selectedNode.idx); })
                                                    .append('g')
                                                    .attr('id', 'words');
                                                    
                        
                        data.wordCloud[selectedNode.idx].forEach(function(w, i) {
                            data.wordCloud[selectedNode.idx][i].clicked = false;

                            var fo = layer.append('foreignObject')
                                    .attr('transform', 
                                        'translate(' + [w.x - w.width * 0.5, 20 + w.y - w.height * 0.4] + ')rotate(' + w.rotate + ')')   
                                    .attr('width', w.width)
                                    .attr('height', w.height);

                           
                            var div = fo.append('xhtml:div')
                                        .style('line-height', w.size + 'px')
                                        .style('cursor', 'pointer')
                                        .style('text-align', 'center')
                                        .style('font-size', w.size + 'px')
                                        .html(w.text)
                                        .on('mouseover', function(d) {
                                            div.style('color', 'blue');
                                        })
                                        .on('mouseout', function(d) {
                                            div.style('color', 'black')

                                            if(data.wordCloud[selectedNode.idx][i].clicked == false) {
                                                div.classed('clicked', false);
                                            }
                                        })
                                        .on('click', function(d) {

                                            // if(data.searchedWords.length > 0)
                                            //     clickedWords = data.searchedWords;

                                            data.wordCloud[selectedNode.idx][i].clicked = !data.wordCloud[selectedNode.idx][i].clicked;
                                            
                                            if(data.wordCloud[selectedNode.idx][i].clicked) {
                                                if(data.searchedWords.indexOf(w.text) == -1) data.searchedWords.push(w.text);
                                                div.style('color', 'black')
                                                    .classed('clicked', true);
                                                
                                            } else {
                                                data.searchedWords = data.searchedWords.filter(function(element) {
                                                                        return element != w.text;
                                                                    });

                                                div.classed('clicked', false);
                                            }

                                            searchKeywords(data.searchedWords, true);
                                        });

                                if(typeof data.searchedWords != 'undefined' && 
                                    data.searchedWords.indexOf(w.text) != -1) {

                                    data.wordCloud[selectedNode.idx][i].clicked = true;
                                    div.classed('clicked', true);
                                }
                        });
                    })
                    .start();

                var offsetY = 50;
                // var autoLabelsLayer = autoLabels.filter(function(l,i) { return (l.idx == selectedNode.idx); });

                // autoLabelsLayer.append('text')
                //         .attr('x', leftX + 15)
                //         .attr('y', topY + 25 + offsetY)
                //         .style('font-size', '15px')
                //         .style('text-anchor', 'start')
                //         .style('cursor', 'default')
                //         .text('Unsupervised:');
                
                // offsetY += 50;

                // data.auto_labels[selectedNode.idx].labels['unsupervised'].forEach(function(d, i) {
                //     autoLabelsLayer.append('text')
                //         .attr('x', leftX + (minWordCloudSize * 0.5 - 2) * 0.5)
                //         .attr('y', topY + 25 + offsetY)
                //         .style('font-size', '20px')
                //         .style('cursor', 'default')
                //         .text(function() {
                //             return d;
                //         });

                //     offsetY += 25;
                // });

                // offsetY = 50;

                // autoLabelsLayer.append('text')
                //         .attr('x', leftX + 15)
                //         .attr('y', topY + (minWordCloudSize - 4) * 0.5 + offsetY)
                //         .style('font-size', '15px')
                //         .style('text-anchor', 'start')
                //         .style('cursor', 'default')
                //         .text('Supervised:');
                
                // offsetY += 50;

                // data.auto_labels[selectedNode.idx].labels['supervised'].forEach(function(d, i) {
                //     autoLabelsLayer.append('text')
                //         .attr('x', leftX + (minWordCloudSize * 0.5 - 2) * 0.5)
                //         .attr('y', topY + (minWordCloudSize - 4) * 0.5 + offsetY)
                //         .style('font-size', '20px')
                //         .style('cursor', 'default')
                //         .text(function() {
                //             return d;
                //         });

                //     offsetY += 25;
                // });
                // 
                // 
                var docListLayer = docLists.filter(function(l,i) { return (l.idx == selectedNode.idx); });
                var sourceLayer = sources.filter(function(l,i) { return (l.idx == selectedNode.idx); });
                topic_docs(selectedNode.idx, 20, docListLayer, sourceLayer);
        }

        d3.event.stopPropagation();
        
        d3.select(currentTarget).selectAll('.arc').classed('hidden', true);

        let currentGroup = d3.select(currentTarget);

        d3.transition().duration(500).ease(d3.easePolyOut)
            .tween('circleToRect', function() {
                d3.select(currentTarget).moveToFront();

                let ir = d3.interpolateNumber(selectedNode.r, minWordCloudSize * 0.5);
                let irBorder = d3.interpolateNumber(selectedNode.borderRatio, 0.1);
                
                return function(t) {
                    selectedNode.r = ir(t);
                    selectedNode.borderRatio = irBorder(t);

                    simulation.force('collide', forceCollide);
                };
            })
            .on('end', function() {
                    simulation.alphaTarget(0);
                    
                    currentGroup.select('.wordcloud-overlay').classed('hidden', false);
                    currentGroup.select('.topic_name').classed('hidden', true);
            })
            .on('interrupt', function() {
                    //console.log('move interrupt', selectedNode);
                    // selectedNode.fx = null;
                    // selectedNode.fy = null;
                    selectedNode.borderRatio = 0.1;
                    selectedNode.r = centerY * 0.5;
                    simulation.alphaTarget(0);

                    currentGroup.select('.wordcloud-overlay').classed('hidden', false);
                    currentGroup.select('.topic_name').classed('hidden', true); 
            });
    });
    

    // var svg = d3.select('svg');
    // var docLayer = svg.append('g').classed('doc-layer hidden', true);
    
    // docLayer.append('rect')
    //     .attr('x', width * 0.6)
    //     .attr('y', 0)
    //     .attr('width', width * 0.4)
    //     .attr('height', height)
    //     .style('fill', d3.rgb(255, 255, 255))
    //     .style("opacity", 0.8);

    addGui();
    drawLegend();
}

function toggleArrow(expanded, target) {
    let buttonGroup = target.select('.toggle-full-view');
    let button = target.select('.toggle-full-view rect');
    let buttonCenterX = +button.attr('x') + (+button.attr('width')) * 0.5;
    let buttonCenterY = +button.attr('y') + (+button.attr('height')) * 0.5;

    let angle = (expanded)? 0 : 180;
    buttonGroup.attr("transform", "rotate (" + angle + "," + buttonCenterX + "," + buttonCenterY + ")");
}

function toggleFullView(node, target){
    let rect = target.select('rect');
    //toggleArrow(node.expanded, target);
    
    let button = target.select('.expand-button circle');
    let triangle = target.select('.expand-triangle');
    let buttonCenterX = +button.attr('cx');
    let buttonCenterY = +button.attr('cy');
    
    let angle = (node.expanded)? 15 : 195;
    triangle.attr('transform', 'rotate(' + angle + "," + buttonCenterX + "," + buttonCenterY + ")");

    d3.transition()
        .duration(200)
        .ease((node.expanded)? d3.easePolyIn : d3.easePolyOut)
        .tween('expandRect', function() {

            if(node.expanded) { 
                target.select('.doc-list').classed('hidden', true);
                target.select('.source-view').classed('hidden', true);
            }

            let irWidth = d3.interpolateNumber(rect.attr('width'), (node.expanded)? node.r * 2 : minWordCloudSize * expandedWidthScale);
            let irHeight = d3.interpolateNumber(rect.attr('height'), (node.expanded)? node.r * 2 : minWordCloudSize * expandedHeightScale);

            return function(t) {

                rect.attr('width', irWidth(t));
                rect.attr('height', irHeight(t));
                simulation.force('collide', forceCollide);
            };
        })
        .on('end', function(){
            simulation.alphaTarget(0);
            node.expanded = !node.expanded;
            if(node.expanded) {
                target.select('.doc-list').classed('hidden', false);
                target.select('.source-view').classed('hidden', false);
            }
        })
        .on('interrupt', function() {
            rect.attr('width', (node.expanded)? node.r * 2 : minWordCloudSize * expandedWidthScale);
            rect.attr('height', (node.expanded)? node.r * 2 : minWordCloudSize * expandedHeightScale);
            simulation.alphaTarget(0);
            node.expanded = !node.expanded;
            if(node.expanded) {
                target.select('.doc-list').classed('hidden', false);
                target.select('.source-view').classed('hidden', false);
            }        
        });

}

function closeBubble(node, target){
    d3.transition()
        .duration(500)
        .ease(d3.easePolyOut)
        .tween('rectToCircle', function() {
            //console.log('tweenMoveOut', focusedNode);
            let ir = d3.interpolateNumber(node.r, node.radius);
            let irlBorder = d3.interpolateNumber(node.borderRatio, 1);

            if(node.expanded) toggleFullView(node, target);
            
            return function(t) {
                node.r = ir(t);
                node.borderRatio = irlBorder(t);
                
                simulation.force('collide', forceCollide);
            };
        })
        .on('end', function(){

            target.select('.topic_name').classed('hidden', false);
            target.selectAll('.arc').classed('hidden', false);
            //d3.select(focusedNode).moveToBack();
            
            // focusedNode = null;
            // focusedTarget = null;
            simulation.alphaTarget(0);
            node.clicked = false;
        })
        .on('interrupt', function() {
            simulation.alphaTarget(0);
            node.clicked = false;
        });

    target.select('.wordcloud-overlay').classed('hidden', true);
}

function setNormalZoom(svg) {
    zoom.scaleExtent([0.3, 1])
        .on('zoom', function() {
            var transform = d3.event.transform;

            svg.select('g').attr('transform', transform);
            lastTransform = transform;
        });
    svg.call(zoom);
}

function setSacledZoom(svg) {
    var aspect = width / height;
    var n = Math.floor(width / (2.1 * Math.sqrt(aspect * data.tw.length)));
    var i = n * 1.8;
    var o = 1.1 * n;

    var xScale = d3.scaleLinear().domain([0, width]).range([o, width - o]);
    var yScale = d3.scaleLinear().domain([height, 0]).range([height - o, o]);
    var nodes = svg.selectAll('.node');

    zoom.scaleExtent([1, 15])
        .on('zoom', function() {
            var transform = d3.event.transform;
            var scaledX, scaledY;
            
            nodes.transition().duration(1)
                .attr('transform', function(d) {
                    scaledX = transform.applyX(xScale(d.x));
                    scaledY = transform.applyY(yScale(d.y));

                    return 'translate(' + [scaledX, scaledY ] + ')';
                });
        });

    svg.call(zoom);
}

var searchLegend = d3.legendColor().labelOffset(10).title('Search Result');
var searchLegendColor = d3.scaleOrdinal();

function searchKeywords(keywords, splited) {
    
    if(splited == false) {
        if(keywords == '' || keywords.replace(/\+/g, '') == '') keywords = [];
        else {
            keywords = keywords.split('+').filter(function(element){
                        return element != '';
                    });
        }

        data.searchedWords = keywords;
    }

    var valueForSearchInput = '';
    data.searchedWords.forEach(function(w, wi) {
        valueForSearchInput += w;
        if(wi < data.searchedWords.length - 1)
            valueForSearchInput += '+';
    });

    searchInput.setValue(valueForSearchInput);

    //if(data.searchWords == keywords) return;
    var svg = d3.select('svg');

    var result = [[],];

    let isKeywordEmpty = (keywords.length == 0);
    
    console.log(keywords);

    var arc = d3.arc();

    var rect = svg.selectAll('.node rect[id]');
    var arcPath = svg.selectAll('.node path[id]');

    arcPath.remove();
    svg.select('.legend-search').classed('hidden', isKeywordEmpty);

    if(isKeywordEmpty == false) {

        data.tw.forEach(function(d, i) {
            result[i] = [];
            
            
            let weight = d.weight;
            var found = [];
            keywords.forEach(function(kw, ki) {

                if(kw == '') return;
                
                var v = {word: kw, value: 0, index:-1};
                
                let r = d.words.filter(function(w, wi) {
                    if(w.word == kw.trim()) {
                        v.index = wi;
                        return true;
                    }
                    return false;
                });
                
                if(r.length > 0) {
                    v.value = r[0].weight/weight;
                    found.push(v);
                }
            });

            if(found.length == keywords.length)
                result[i] = found;
        });

        searchLegendColor = d3.scaleOrdinal();
        searchLegendColor.domain(keywords)
            .range(keywords.map(function(val, i) {
                return d3.interpolateYlGnBu(1 - (i / (keywords.length)));
            }));

        searchLegend.scale(searchLegendColor)
        svg.select('.legend-search').call(searchLegend);
    }

    rect.transition().duration(1000).ease(d3.easeElasticOut)
        .tween('circleSearch', function(d) {
            // possible states
            // no click, no result              --> dst = 0, borderRatio 1 -> 1
            // no click, result/isKeywordEmpty  --> dst = sacaldeRadius(d.value), borderRatio 1 -> 1
            // click, no result                 --> dst = 0, borderRatio 0.1 -> 1, wordcloud hidden
            // click, result                    --> dst = src, borderRatio 0.1 -> 0.1, wordcloud visible

            var src = d.r;
            let hasResult = (isKeywordEmpty == false && result[d.idx].length > 0);

            d.radius = (isKeywordEmpty || hasResult)? scaleRadius(d.value) : 0;
            var dst = (d.clicked && hasResult)? src : d.radius;
            let i = d3.interpolateNumber(src, dst);

            var borderTarget = (d.clicked && hasResult)? 0.1: 1;
            let irBorder = d3.interpolateNumber(d.borderRatio, borderTarget);

            var parentNode = d3.select(this.parentNode);
            var wordCloudLayer = parentNode.select('.wordcloud-overlay');
            var texts = wordCloudLayer.select('g#words').selectAll('div');

            if(texts._groups.length != 0) console.log(texts);
            texts.classed('clicked', false);
            
            if(typeof data.wordCloud[d.idx] != 'undefined') {
                data.wordCloud[d.idx].forEach(function(w, i) {
                    w.clicked = false;
                });
            }

            // due to that IE does not support clipPath
            if(isMSIE) { 
                parentNode.select('.topic_name').classed('hidden', (d.radius == 0));
            }
            
            //hide a clicked bubble if it has no search keyword
            if(d.clicked && hasResult == false) {
                
                if(d.expanded) {
                    toggleFullView(d, parentNode);
                }

                wordCloudLayer.classed('hidden', true);
                parentNode.select('.topic_name').classed('hidden', false);
                d.clicked = false;
            }

            if(hasResult) {

                result[d.idx].forEach(function(v) {
                    var text = texts.filter(function(t, ti) { return ti == v.index; });
                    text.classed('clicked', true);
                    
                    if(typeof data.wordCloud[d.idx] != 'undefined') {
                        data.wordCloud[d.idx][v.index].clicked = true;
                    }

                    // console.log(v); 
                });
            }

            return function(t) {
                d.r = i(t);
                if(d.r < 0) d.r = 0;
                d.borderRatio = irBorder(t);

                simulation.force('collide', forceCollide);
            }
        })
        .on('end', function(t) {
            
            simulation.alphaTarget(0);
                               
        })
        .on('interrupt', function() {
            
            simulation.alphaTarget(0);
        });

    var nodes = svg.selectAll('.node')

    result.forEach(function(v, i) {

        var start = 0;
        var node = nodes.filter(function(n) { return (n.idx == i); });

        v.forEach(function(kw, ki) {
            
            var end = start + 2 * Math.PI * kw.value;

            node.append('path')
            .classed('arc', true)
            .classed('hidden', function(d) { return d.clicked; })
            .attr('id', function(d) { return d.idx + kw.word + ki; })
            .attr('d', function(d) {

                return arc({
                    innerRadius: 0,
                    outerRadius: scaleRadius(d.value),
                    startAngle:start,
                    endAngle:end
                }); 
            })
            .attr('fill', function(d) { return searchLegendColor(ki); });

            start = end;  
        });
    });
    // arcPath.transition().duration(1000)
    //         .attrTween('d', (d) => {
    //             let newAngle = isKeywordEmpty? 0 : 2 * Math.PI * result[0][d.idx].value;
    //             let i = d3.interpolateNumber(d.endAngle, newAngle);

    //             return (t) => {
    //                 d.endAngle = i(t);
                    
    //                 return arc({
    //                       innerRadius: 0,
    //                       outerRadius: d.radius,
    //                       startAngle: 0,
    //                       endAngle: d.endAngle
    //                     });
    //             }
    //         });
    
    simulation.alphaTarget(0.2).restart();   
}

function clearSearch() {
    console.log('clear search');
    console.log(data.searchedWords);

    searchKeywords('', false);
}

function addGui() {
    var gui = new dat.GUI({ autoPlace: false });
    var customContainer = $('.gui').append($(gui.domElement));
    var svg = d3.select('svg');
    var scaled = gui.add(gui_elements, 'scaled');
    
    if(typeof data.topic_scaled != 'undefined' ) {
        scaled.onChange(function() {

            var nodes = svg.selectAll('.node');

            if(gui_elements.scaled) {

                simulation.stop();
                // simulation.nodes([]);
                simulation.force('collide', null);

                data.topic_scaled.forEach(function(scaled, i) {

                    var node = nodes.filter(function(l) { return (l.idx == i);} )
                        node.transition().duration(1000)
                            .attr('transform', function(d) {
                                 return 'translate(' + [centerX + width * scaled[0], centerY - height * scaled[1]] + ')'
                            })
                            .on('end', function(d) {
                                d.x = centerX + width * scaled[0];
                                d.y = centerY - height * scaled[1];
                                setSacledZoom(svg);
                            })
                            .on('interrupt', function(d) {
                                d.x = centerX + width * scaled[0];
                                d.y = centerY - height * scaled[1];     
                                setSacledZoom(svg);
                            });
                });

            } else {
                // simulation.nodes(nodes.data());
                
                simulation.force('collide', forceCollide);
                simulation.alphaTarget(0.2).restart();
                svg.call(zoom.transform, lastTransform);
                setNormalZoom(svg);
            }
        });
    } else {
        scaled.domElement.childNodes[0].disabled = true;
    }


    gui.add(gui_elements, 'absolute range').onChange(function() {

        setMappingScale();
        svg.select('.legend-color').remove();
        svg.select('.legend-size').remove();

        drawLegend();

        var rect = svg.selectAll('.node rect[id]')
        
        simulation.alphaTarget(0.2).restart();

        rect.transition().duration(1000).ease(d3.easeElasticOut)
                .tween('circleResize', function(d) {
                    var src = d.r;
                    d.radius = scaleRadius(d.value);
                    var dst = (d.clicked)? src : d.radius;
                    
                    let i = d3.interpolateNumber(src, dst);

                    return function(t) {

                        d.r = i(t);
                        simulation.force('collide', forceCollide);
                    }
                })
                .on('end', function(t) {
                    
                    simulation.alphaTarget(0);
                                       
                })
                .on('interrupt', function() {
                    
                    simulation.alphaTarget(0);
                });

    });

    // finds what topic bubbles include keywords and showing as a form of pie charts over a bubble
    searchInput = gui.add(gui_elements, 'search for words').onFinishChange(function(text) {
        text = text.toLowerCase();
        searchKeywords(text, false);             
    });

    searchInput.__input.placeholder = 'e.g. happy+life+...';

    gui.add(gui_elements, 'clear search');
}