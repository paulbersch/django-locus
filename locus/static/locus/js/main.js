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
    URI: "libs/URI"
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
    },
    "URI": {
        exports: "URI"
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
            var locator = new Locations.Views.Locator({ el: document.getElementById('locator-anchor') });
            locator.render();
        },
        search: function(hash, query) {

        }
    });
    var router = new Router;
    Backbone.history.start({ pushState: false, root: '/'});
    //Backbone.history.navigate('/');
    //Backbone.history.navigate('detail');
});
