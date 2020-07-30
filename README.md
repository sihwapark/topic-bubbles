# TopicBubbles: an Interactive Topic Model Visualization

TopicBubbles is a D3-based bubble chart for topic model visualization that aims to present more intuitive and interactive topic model visualization. It was developed as part of the [WhatEvery1Says project(WE1S)](https://we1s.ucsb.edu).

![alt text](img/screenshot.png "Logo Title Text 1")

[[Working example](https://sihwapark.github.io/topic-bubbles/)] [[Video demo showing full functionality](https://vimeo.com/437987253)]



## How to Use

### Topic Model Data

TopicBubbles uses files for a topic model generated from [dfrtopics](https://github.com/agoldst/dfrtopics) with the use of an `export_browser_data` function. To generate a topic model with your own text corpus, please refer to [its documentation](https://agoldst.github.io/dfrtopics/introduction.html) for detail. The necessary files for TopicBubbles are as following:

* `tw.json`: a JSON object file having topic words and their weights. 
* `meta.csv.zip`: a headerless zipped CSV file about document metadata, e.g. DOI, title, and authors.
* `topic_scaled.csv`: a headerless CSV file for two-dimensional coordinates of topics that used in a scaled layout.
* `dt.json.zip`: a zipped JSON file giving the topic weights for each document.

Please see [the dfr-browser's data file specifications](https://github.com/agoldst/dfr-browser#browser-data-file-specifications) to understand the files in detail. Put the data files inside the `data` folder.

### Configuration Information (Optional)

To use Topicbubbles' specialized features such as topic word highlighting and an embedded JSON reader, original text corpus data used for topic modeling needs to be transformed in JSON format that has the text of each document as the value for a field name `content`. For example, if you have 100 documents that used for topic modeling, you need to transform them to 100 JSON files with the format below:

``` json
{ "content": "[put the text of each document here]" }
```

Also, a folder path in which the transformed JSON files exist should be specified in the`config.json` file that TopicBubbles uses, and the JSON file names need to be the same with DOIs in `meta.csv.zip`. `config.json` file is as below and put it inside the `data` folder as well.

```json
{ "json_cache_path": "[specify a path to a folder for the JSON files here]" }
```

### Running a HTTP Server

To run the code with your own data, you need to run a HTTP server. One of choices for running the server is to use [http-server](https://www.npmjs.com/package/http-server). After installing `http-server`, please follow instructions blew in the command line.

```shell
cd [path-to-the-TopicBubbles-folder]
http-server -p 9000
```

Now you can visit http://localhost:9000 to view the TopicBubbles visualization for your topic models. 9000 is a port number that you can change if it is already occupied by other server programs.



## Visualization Elements

### Topic Bubbles

Each bubble represents a topic and its size and color are determined by `alpha` in `tw.json`, the hyper parameter alpha for each topic, which indicates how many times each topic appears in the document. The bigger and redder a circle is, the higher an alpha value is. And it maps `alpha` to size and color in two ways: Absolute and relative range mapping. In the absolute range mapping, a range for `alpha` values is fixed with [0, 1] and this range is mapped into a size in the range [20, 80] with the use of `d3.scaleSqrt()`. For the color mapping, TopicBubbles uses the 'Reds' sequential color scheme `d3.interpolateReds` with the range [0, 0.7] not to make red color too dark. As for the relative range mapping, the alpha range depends on real data values by finding the maximum and minimum alpha values from the data. Mapping ranges for color and size and a scaling function are the same with the absolute range mapping. The relative mapping is the default and the user can change the mapping mode through the selection of the "absolute range" checkbox in the GUI at the top-left corner.

### Default and Scaled Layouts

As a default layout, all bubbles are laid out according to a circle-packing-algorithm with the use of  `d3.pack()`. In this layout, the bubbles are draggable and they move back to the center of the screen slowly according to a background force simulation managed by `d3.forceSimulation` that also controls the bubbles' position/motion/collision.

When the "scaled" checkbox in the GUI is selected, the bubbles are arranged in a scaled layout that represents the same set of the bubbles approximately clustered according to the statistical similarity of topics to each other. The coordinates of the bubbles in the scales layout are in `topic_scaled.csv`. The scaled layout is the same with the scaled view of [dfr-browser](https://github.com/agoldst/dfr-browser).

### Word Cloud

When a bubble is clicked, it smoothly expands into a rounded square that shows the word cloud of the top 50 words in a topic. The word cloud varies the font sizes of the words according to a ratio of each word's weight to the maximum weight in the topic. The font size are in the range [5, 25], with the use of `d3.scaleSqrt()`. Each word shows a tooltip displaying the word's weight on mouseover. A layout for word clouds in a square is automatically calculated by Jason Davies's library, [d3-cloud](https://github.com/jasondavies/d3-cloud). 

### Pie Chart for Word Search

Clicking words in the word cloud works as a filter to show only topics including the words and to visualize their weights in the form of a pie chart on top of each bubble. The selected words are highlighted by being underlined and put in boldface and they also appear in the search input box in the GUI with "+" operator that is used as Boolean "and".

### Document and Source Views

When the user clicks the blue expand button at the bottom-right corner of the word cloud view, the rounded square becomes larger and shows a document view at the right and a source view at the bottom. The document view shows the titles and sources of the top 20 documents related to a topic. When the optional configuration information is set, features for analyzing the word-document relationships, such as previewing and highlighting topic words according to mouseover interaction, are available. Also, an embedded JSON reader appears on top of the document view to show content for the document when it is clicked.

The source view visualizes the publication sources of the top 20 documents as a lollipop chart in which the height of lines indicates the accumulated weights of the documents published by sources. When the mouse pointer is on the circle or the line, the titles of the documents issued by the source in the document view are highlighted in blue with a transparency that varies proportionally to the ratio of a document's weight to the accumulated weight of the source.



## Locating a Topic with URL Parameters

TopicBubbles supports two URL parameters. With the `topicNum` parameter, the user can create a link to a specific topic in a model. The parameter `expand` is used to set all additional information views of a topic to be fully opened. For example, http://localhost:9000/?topicNum=10 will show TopicBubbles of which the topic 10's word cloud view is activated. In the same manner, http://localhost:9000/?topicNum=10&expand=1 will locate topic 10 with document and source views expanded.



## Libraries and References

### Used Libraries

- [dat.GUI](https://github.com/dataarts/dat.gui)
- [D3.js](https://d3js.org/)
- [d3-legend](http://d3-legend.susielu.com/)
- [d3-cloud](https://github.com/jasondavies/d3-cloud)
  - [An example](https://bl.ocks.org/abrahamdu/e1481e86dd4e9d553cc2d7d359b91e68) for d3.js v4 or above
- [fetch](https://github.com/github/fetch) to support `fetch()` in IE
- [polyfill](https://github.com/taylorhakes/promise-polyfill), a Promise polyfill for older browsers
- [jszip](https://github.com/Stuk/jszip)
- [json-viewer](https://github.com/abodelot/jquery.json-viewer)
- [jquery](http://jquery.com/)

### References

- [Interactive bubble chart example by Nau Studio]( https://naustud.io/tech-stack/)
- [dfr-browser](https://github.com/agoldst/dfr-browser)

