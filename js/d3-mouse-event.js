var isMouseEventDisabled = false;
var callbackCached = false;
var cachedElements = [];

function globalMouseEventHandler() {    
    d3.select('body').on('keydown', function() {
        if(d3.event.key == 'a' && isMouseEventDisabled == false) {
            
            if(callbackCached == false) {
                d3.selectAll('*').each(function(d, i) {
                    var element = {e: this, events: []};

                    let click = d3.select(this).on('click');
                    let drag = d3.select(this).on('mousedown.drag');
                    let mouse_zoom = d3.select(this).on('mousedown.zoom');
                    let wheel_zoom = d3.select(this).on('wheel.zoom');
                    
                    if(typeof(click) !== 'undefined') element.events.push({name:'click', func: click});
                    if(typeof(drag) !== 'undefined') element.events.push({name:'mousedown.drag', func: drag});
                    if(typeof(mouse_zoom) !== 'undefined') element.events.push({name:'mousedown.zoom', func: mouse_zoom});
                    if(typeof(wheel_zoom) !== 'undefined') element.events.push({name:'wheel.zoom', func: wheel_zoom});

                    if(element.events.length > 0) cachedElements.push(element);
                });

                callbackCached = true;
            } 

            cachedElements.forEach(function(element) {
                let events = element.events;
                events.forEach(function(event) {
                    d3.select(element.e).on(event.name, null);
                });
            });
                
            isMouseEventDisabled = true;
        }

    });

    d3.select('body').on('keyup', function() {
        if(d3.event.key == 'a' && isMouseEventDisabled) {

            cachedElements.forEach(function(element) {
                let events = element.events;
                events.forEach(function(event) {
                    d3.select(element.e).on(event.name, event.func);
                });
                
            });
            
            isMouseEventDisabled = false;
        }
    });
}