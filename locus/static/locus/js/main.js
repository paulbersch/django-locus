"use strict;"

// shim for console.log so it doesn't break IE
if (!window["console"]) window.console = {};
var console = (/** @type {Object} */ window.console);

// Implement console log if needed
if (!console["log"])
{
        console.log = (/** @param {...*} args */ function(args) {});
}

require.config({
  paths: {
    // Libraries
    underscore: "libs/underscore",
    backbone: "libs/backbone",
    paginator: "libs/backbone.paginator",
    locations: "modules/locations",
  },
  shim: {
    underscore: {
      exports: '_'
    },
    backbone: {
      deps: ["underscore"],
      exports: "Backbone"
    },
    paginator: {
      deps: ["backbone"],
      exports: "Paginator"
    }
  }
});

require(["underscore", "backbone", "locations"], function(_, Backbone, Locations) {

    var Router = Backbone.Router.extend({
        routes: {
            "": "home",
            "search/:query/": "view"
        },
        home: function() {
            var map = new Locations.Views.Map({ el: document.getElementById('map-anchor') });
            map.render();

            var list = new Locations.Views.LocationsList(map.map);
            list.setElement(document.getElementById('list-anchor'));

            var controls = new Locations.Views.Controls(list);
            controls.setElement(document.getElementById('controls-anchor'));
            controls.render();
        },
        search: function(hash, query) {

        }
    });
    var router = new Router;
    Backbone.history.start({ pushState: false, root: '/'});
    //Backbone.history.navigate('/');
    //Backbone.history.navigate('detail');
});
