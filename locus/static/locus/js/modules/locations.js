"use strict";

define([
    'underscore',
    'backbone',
    'paginator',
], function(_, Backbone, Paginator) {
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
            $("body").trigger('loadingStart');
            this.$el.append(templates.map());
            this.map = new google.maps.Map($("#map_canvas", this.el)[0], this.mapOptions);

        }
    });

    Locations.Views.Controls = Backbone.View.extend({
        initialize: function(list) {
            templates.controls = _.template($('#-tmpl-locations-controls').html());
            this.list = list;
        },
        events: {
            'submit form#locus-address-search': 'search_form_submit',
            'change form#categories input[type=checkbox]': 'filter_change'
        },
        render: function() {
            this.el.innerHTML = templates.controls();
        },
        // yuck :-(
        search_form_submit: function(event) {
            return this.list.search_form_submit(event);
        },
        filter_change: function(event) {
            return this.list.filter_change(event);
        }
    });

    Locations.Views.LocationsList = Backbone.View.extend({
        initialize: function(map) {
            templates.list = _.template($('#-tmpl-locations-list').html());
            templates.list_item = _.template($('#-tmpl-locations-list-item').html());
            templates.infowindow_content = _.template($('#-tmpl-locations-infowindow').html());

            this.map = map;

            this.parameters = { bounds: "0,0,0,0"};

            // see if there's an address in the querystring
            var url = new URI();
            var search = url.search(true);

            google.maps.event.addListenerOnce(map, 'idle', _.bind(function() {
                this.collection = new Locations.List();
                this.collection.bind('reset', this.populateList, this);
                this.render();

                if('address' in search) {
                    this.location_search(search['address']);
                    $('#locus-address-search input[name=address]').val(search['address']);
                }

            }, this));

            google.maps.event.addListener(map, 'idle', _.bind(function() {
                $("body").trigger("loadingStart");

                // check that the infowindow still belongs on the map
                var bounds = this.map.getBounds();
                var position = this.infoWindow.getPosition();
                if (position && !bounds.contains(position)) {
                    // the marker that this infowindow belongs to isn't visible anymore
                    this.infoWindow.close();
                }

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
            'click a.prev': "prev",
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
            if(this.collection.isEmpty()) {
                locations_table.html('<td colspan=5>No locations were found.  Drag and zoom the map to expand your search to a larger area.</td>');
            }

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
                    // don't anchor to a marker, as it may get redrawn
                    this.infoWindow.setPosition(marker.getPosition());
                    this.infoWindow.open(this.map);
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
        },
        filter_change: function(event) {
            $("body").trigger("loadingStart");
            var target = event.target;
            var type = $(target).attr('data-type');

            if (target.checked) {
                this.add_filter(target.value, type);
            } else {
                this.remove_filter(target.value, type);
            }
        },
        add_filter: function(id, type) {
            var url = new URI(urlRoot);

            if(!(type in this.parameters)) {
                var list = [];
            } else {
                // turn the string parameter into a list
                var list = this.parameters[type].split(',');
            }

            // add the new id
            list.push(id);

            // the api expects a comma-separated list of ids
            // remove duplicates and re-join the list
            this.parameters[type] = _.uniq(list).join(',');

            // create a new query url
            url = url.search(this.parameters)
            this.collection.url = url;

            this.collection.fetch({ data: this.parameters });
        },
        remove_filter: function(id, type) {
            var url = new URI(urlRoot);

            if(!(type in this.parameters)) {
                // we don't need to remove anything
                $("body").trigger("loadingEnd");
                return true;
            }

            // remove all occurances of id
            var list = _.without(this.parameters[type].split(','), id);

            if (list.length == 0) {
                // empty lists may cause errors
                delete this.parameters[type];
            } else {
                this.parameters[type] = list.join(',');
            }

            // create a new query url
            url = url.search(this.parameters)
            this.collection.url = url;

            this.collection.fetch({ data: this.parameters });
        },
        search_form_submit: function(event) {
            event.preventDefault();

            // grab the address from the form
            var form = event.target;
            var address = $('input[name=address]', form).val();

            // trigger the search
            this.location_search(address);
        },
        location_search: function(address) {
            $('.locations-search-address').html("Distances relative to search: \"" + address + '"');

            var geocoder = new google.maps.Geocoder();
            geocoder.geocode( { 'address': address}, _.bind(function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    var loc = results[0].geometry.location;
                    this.parameters['order_by'] = 'distance';
                    this.parameters['from'] = loc.lat() + ',' + loc.lng();
                    this.map.panTo(loc);
                    if(typeof(this.location_marker) != 'undefined') {
                        this.location_marker.setMap();
                    }
                    this.location_marker = new google.maps.Marker({
                        map: this.map,
                        animation: google.maps.Animation.BOUNCE,
                        position: loc
                    });
                } else {
                    alert("Geocode was not successful for the following reason: " + status);
                }
            }, this));

            //return false; // prevent default

        }
    });

    // marker functions

    return Locations;
});
