"use strict";

define([
    'underscore',
    'backbone',
    'paginator',
    'URI'
], function(_, Backbone, Paginator, URI) {
    var Locations = {};

    var urlRoot = "../locations/v1/location/";

    Locations.Model = Backbone.Model.extend({
        urlRoot: urlRoot,
        url: function() {
            // ensure there's a trailing slash
            var temp_url = Backbone.Model.prototype.url.call(this);
            return (temp_url.charAt(temp_url.length - 1) == '/' ? temp_url : temp_url+'/');
        }
    });

    Locations.List = Backbone.Collection.extend({
        model: Locations.Model,
        url: urlRoot,
        parse: function(response) {
            this.meta = response.meta;
            return response.objects;
        }
    });

    Locations.Views = {};

    var templates = {};

    var markers = [];

    Locations.Views.Locator = Backbone.View.extend({
        initialize: function() {
            templates.locator = _.template($('#-tmpl-locations-locator').html());
        },
        events: {
        },
        render: function() {
            this.el.innerHTML = templates.locator();

            this.map = new Locations.Views.Map({ el: $('#map-anchor', this.el)[0] });
            this.map.render();

            this.list = new Locations.Views.LocationsList(this.map.map);
            this.list.setElement($('#list-anchor', this.el)[0]);
        }
    });

    Locations.Views.Map = Backbone.View.extend({
        initialize: function() {
            templates.map = _.template($('#-tmpl-locations-map').html());

            this.mapOptions = {
                center: new google.maps.LatLng(43.038902, -87.906474),
                zoom: 9,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };

            $("body").on('loadingEnd', function() {
                $("#loading").fadeOut("slow");
            });

            $("body").on('loadingStart', function() {
                $("#loading").show();
            });
        },
        events: {
        },
        render: function() {
            this.el.innerHTML = templates.map();
            this.map = new google.maps.Map($("#map_canvas", this.el)[0], this.mapOptions);
            $("body").trigger('loadingStart');

        }
    });

    Locations.Views.LocationsList = Backbone.View.extend({
        initialize: function(map) {
            templates.list = _.template($('#-tmpl-locations-list').html());
            templates.list_item = _.template($('#-tmpl-locations-list-item').html());
            templates.infowindow_content = _.template($('#-tmpl-locations-infowindow').html());

            this.map = map;

            this.parameters = { bounds: "0,0,0,0"};

            google.maps.event.addListenerOnce(map, 'idle', _.bind(function() {
                this.collection = new Locations.List();
                this.collection.bind('reset', this.populateList, this);
                this.render();
            }, this));

            google.maps.event.addListener(map, 'idle', _.bind(function() {
                $("body").trigger("loadingStart");
                this.collection.url = urlRoot; // clears out pagination
                this.parameters['bounds'] = this.map.getBounds().toUrlValue();
                this.collection.fetch({ data: this.parameters});
            }, this));

            this.infoWindow = new google.maps.InfoWindow({
                disableAutoPan: false
            });

        },
        events: {
            'click a.next': "next",
            'click a.prev': "prev"
        },
        render: function() {
            this.el.innerHTML = templates.list();
        },
        populateList: function() {
            $('.locations-total', this.el).html(this.collection.meta.total_count);
            $('.locations-page', this.el).html(Math.floor(this.collection.meta.offset / this.collection.meta.limit) + 1);
            $('.locations-total-pages', this.el).html(Math.ceil(this.collection.meta.total_count / this.collection.meta.limit));


            // clear any existing markers
            _.each(markers, function(marker) {
                marker.setMap(null);
            });

            markers = [];

            var locations_table = $('#locations-table tbody', this.el);
            $(locations_table).empty();

            this.collection.each(function(loc, index) {
                // create a map marker
                var list_item = $(templates.list_item(loc.attributes));
                var infowindow_content = $(templates.infowindow_content(loc.attributes));

                var marker = new google.maps.Marker({
                    //animation: google.maps.Animation.DROP,
                    //map: this.map,
                    position: new google.maps.LatLng(loc.get('latitude'), loc.get('longitude'))
                });

                // for debug
                var open_info_window = _.bind(function() {
                    this.infoWindow.close();
                    this.infoWindow.setContent(infowindow_content.html());
                    this.infoWindow.open(this.map, marker);
                }, this); // why does _.bind always feel like an antipattern...

                google.maps.event.addListener(marker, 'click', open_info_window);
                $('td', list_item).on('click', open_info_window);

                locations_table.append(list_item);

                markers.push(marker);

            }, this);

            _.each(markers, function(marker) {
                marker.setMap(this.map);
            }, this);
            $("body").trigger("loadingEnd");

        },
        next: function() {
            if(this.collection.meta.next) {
                this.collection.url = this.collection.meta.next;
                this.collection.fetch({ data: this.parameters });
            } else {
                console.log("no more next");
            }
        },
        prev: function() {
            if(this.collection.meta.previous) {
                this.collection.url = this.collection.meta.previous;
                this.collection.fetch({ data: this.parameters });
            } else {
                console.log("no more previous");
            }
        }
    });

    // marker functions

    return Locations;
});
