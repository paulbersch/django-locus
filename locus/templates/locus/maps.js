var map = 0;
var centerMarker;
var address;
var myOptions;
var circle;
var dealerMarkers = {};
var markerCount = 0;
var data;
var page = 1;
var perpage = 40;
var radius = false;
var latlng;
var geocoder;
var brands;
var filters;
var promotions;
var types;
var openInfoWindow;
var openInfoWindowMarker;
var icon_retailer;
var icon_retailer_selected;
var icon_distributor;
var icon_distributor_selected;
var total_dealers;
var resizeTimer = 0;

function getInternetExplorerVersion()
// Returns the version of Internet Explorer or a -1
// (indicating the use of another browser).
{
  var rv = -1; // Return value assumes failure.
  if (navigator.appName == 'Microsoft Internet Explorer')
  {
    var ua = navigator.userAgent;
    var re  = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
    if (re.exec(ua) != null)
      rv = parseFloat( RegExp.$1 );
  }
  return rv;
}

function toggleLoading(turnOn) {
	if (turnOn) {
		$('#loading').show();
	} else {
		$('#loading').hide();
	}
}

function goToDirections(destination) {
	var google_url = 'http://maps.google.com/maps?f=d&source=s_d&saddr=' + escape($('#address').val()) + '&daddr=' + escape(destination);
	window.open(google_url);
	return true;
}

function getFilterValues() {
	filters = [];
	$('input.dealerfilter:checked').each(function () {
		filters.push(this.value);
	});
	promotions = [];
	$('input.promotionfilter:checked,input[type=hidden].promotionfilter').each(function () {
		promotions.push(this.value);
	});
	types = [];
	$('input.typefilter:checked,input[type=hidden].typefilter').each(function () {
		types.push(this.value);
	});
	brands = [];
	$('input.brandfilter:checked').each(function () {
		brands.push(this.value);
	});

	$('.datatypes').html(types.join("s/") + 's');
}

function resizeMap() {
	paddingHeight = 0;
	if (navigator.userAgent.match(/(iPod|iPhone)/)) {
		// hide the address bar on iPhone
		//$("#padder").css('height','60px');
		paddingHeight = 60;
		setTimeout( function(){ window.scrollTo(0, 1); }, 50 );
	}
	var windowHeight = $(window).outerHeight(true);
	var topOfMap = $("#map_canvas").offset().top;
	//var topOfMap = $("#header").outerHeight();
	var footerHeight = $("#footer").outerHeight(true);
	var mapHeight = windowHeight - topOfMap - footerHeight + paddingHeight;
	if( (window['console'] !== undefined) ){
		console.log([windowHeight, footerHeight, topOfMap, paddingHeight]);
	}
	$("#map_canvas, #sidebar").height(mapHeight);
	$("#loading").css('top', topOfMap + 15).css('left', $("#map_canvas").offset().left + 75);
	google.maps.event.trigger(map, "resize");
}

function resizeMapOnEnd() {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout("resizeMap();", 500);
}

function showMap() {
	var ie = getInternetExplorerVersion();
	if(ie != 6 && ie !=7) {
		$(window).resize(resizeMap);
	} else {
		$(window).resize(resizeMapOnEnd);
	}
	$(document.body).bind('orientationchange', resizeMap);
	resizeMap();

	myOptions.center = latlng;
	myOptions.zo
	map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
	google.maps.event.addListener(map, 'idle', function (event) {
		var center_address = "";
		latlng = map.getCenter();

		geocoder.geocode({'latLng': latlng}, function (results, status) {
			if (status == google.maps.GeocoderStatus.OK) {
				if (results[1]) {
					center_address = results[1].formatted_address;
					//createCookie('address', address, 7);
				} else {
					center_address = latlng;
				}
			} else {
				center_address = latlng;
			}
			createCookie('latitude', latlng.lat(), 7);
			createCookie('longitude', latlng.lng(), 7);
			$('.addressdisplay').html(center_address);
			$('#address').val(address);
		});

		newSearchLocation();
	});

	$('input.dealerfilter').live('click', function () { $('input.brandfilter,#clearfilters').removeAttr('checked'); getFilterValues(); newSearchLocation(); });
	$('input.promotionfilter').live('click', function () { getFilterValues(); newSearchLocation(); });
	$('input.typefilter').live('click', function () {
		if($('input.typefilter:checked').length == 0) {
			$('input#filter-dealer-retailer').prop('checked',true);
		}
		getFilterValues();
		newSearchLocation();
	});

	$('input.brandfilter').live('click', function () { $('input.dealerfilter,input.promotionfilter,#clearfilters').removeAttr('checked'); getFilterValues(); newSearchLocation(); });
	$('#clearfilters').live('click', function () { $('input.dealerfilter,input.promotionfilter,input.brandfilter').removeAttr('checked'); getFilterValues(); newSearchLocation(); });
	$('#ranges').live('change', function () { radius = this.value; getFilterValues(); newSearchLocation(); });

	icon_retailer = new google.maps.MarkerImage('{{ LOCATOR_MEDIA_URL }}images/markers/markers-square.png', new google.maps.Size(34,40), new google.maps.Point(44*0, 0), new google.maps.Point(17,39));
	icon_retailer_selected = new google.maps.MarkerImage('{{ LOCATOR_MEDIA_URL }}images/markers/markers-square.png', new google.maps.Size(34,40), new google.maps.Point(44*1, 0), new google.maps.Point(17, 39));
	icon_distributor = new google.maps.MarkerImage('{{ LOCATOR_MEDIA_URL }}images/markers/markers-square.png', new google.maps.Size(34,40), new google.maps.Point(44*2, 0), new google.maps.Point(17, 39));
	icon_distributor_selected = new google.maps.MarkerImage('{{ LOCATOR_MEDIA_URL }}images/markers/markers-square.png', new google.maps.Size(34,40), new google.maps.Point(44*3, 0), new google.maps.Point(17, 39));

	resizeMap(); //-- repaints make this necessary a second time (?)
}

function resetMarkers() {
	$('#dealer-table .listing').trigger('mouseout');
}

function newSearchLocation(more) {
	toggleLoading(true);
	/*
	if (openInfoWindow) {
		openInfoWindow.close();
	}
	*/
	// recenters the map and the radius circle.
	if (!map) {
		showMap();
	}

	page = 1;

	more = typeof(more) != 'undefined' ? true : false;
	markerCount = more ? markerCount + perpage : perpage;
	if(radius) {
		loadData(latlng.lat(), latlng.lng(), radius);
	} else {
		var bounds = map.getBounds();
		var ne = bounds.getNorthEast();
		var sw = bounds.getSouthWest();
		loadData_bounds(latlng.lat(), latlng.lng(), sw.lat(), sw.lng(), ne.lat(), ne.lng());
	}

}

function loadData(latitude, longitude) {
	$.getJSON('{{ LOCATOR_ROOT }}nearby/'+latitude+'/'+longitude+'/'+radius+'/?filters='+filters+'&promotions='+promotions+'&brands='+brands+'&types='+types+'&limit='+String(markerCount), function (dealerData) { data = dealerData[1]; total_dealers = dealerData[0]; drawDealerMarkers(); });
}

function loadData_bounds(latitude, longitude, swlat, swlng, nelat, nelng) {
	$.getJSON('{{ LOCATOR_ROOT }}nearby-bounds/'+latitude+'/'+longitude+'/'+swlat+'/'+swlng+'/'+nelat+'/'+nelng+'/?filters='+filters+'&promotions='+promotions+'&types='+types+'&brands='+brands+'&limit='+String(markerCount), function (dealerData) { data = dealerData[1]; total_dealers = dealerData[0]; drawDealerMarkers(); });
}

function drawDealerMarkers() {
		toggleLoading(true);
		/*
		if (openInfoWindow) {
			openInfoWindowMarker.setIcon(openInfoWindowMarkerIcon);
			openInfoWindowMarker.setZIndex(zIndexCounter);
			openInfoWindow.close();
		}
		*/
		if(total_dealers <= data.length) {
			$('.show-more').hide();
		} else {
			$('.show-more').show();
		}

		var visibleDealerMarkers = dealerMarkers;
		dealerMarkers = {};

		/*
		if (page == 1) {
			$('div.pagination a').addClass('inactive')
			if (data.length > perpage) {
				$('div.pagination a.next').removeClass('inactive');
			}
		}
		*/

		var zIndexCounter = 100 * markerCount;

		// empty the dealer list
		var dealertable = $('#dealer-table');
		//dealertable.remove();
		dealertable.find('.listing').remove();

		odd = false;

		$(data).each( function (dealer) {
			var dealer_id = "d" + String(this.pk);

			var options = {
				position: new google.maps.LatLng(this.fields.latitude, this.fields.longitude),
				map: map,
				title: this.fields.name,
				clickable: true,
				icon: icon_retailer,
				zIndex: 0
			}

			if (this.fields.type == 'Distributor') {
				options.icon = icon_distributor
			}

			if(dealer_id in visibleDealerMarkers) {
				dealerMarkers[dealer_id] = visibleDealerMarkers[dealer_id];
				delete visibleDealerMarkers[dealer_id];
			} else {
				dealerMarkers[dealer_id] = new google.maps.Marker(options);
			}

			if (true) {
				dealerMarkers[dealer_id].setZIndex(zIndexCounter);
				var row = $(document.createElement('tr')); 
				row.addClass('listing');
				if (odd) {
					row.addClass("odd");
					odd = false;
				} else {
					row.addClass("even");
					odd = true;
				}
				row.addClass(this.fields.type.toLowerCase());

				var promotions = '';
				{% block locator_custom_promotions %}
				{% endblock %}

				/*
				if (this.fields.category_string.length == 0) {
					var brand_array = [];
					if(this.fields.audio) brand_array.push('Audio');
					this.fields.category_string = 'Brands: ' + brand_array.join(', ');
				} else {
					this.fields.category_string = 'Carries: ' + this.fields.category_string;
				}
				*/

				{% block locator_custom_fields %}
				{% endblock %}

				var address = $(document.createElement('td'));
				// TODO: do this server-side. js string concatenation sucks.
				var address_street = this.fields.addr1 + '<br />' + (this.fields.addr2.length > 2 ? this.fields.addr2 + '<br />' : "");
				var address_text = address_street + this.fields.city + ', ' + this.fields.state + ' ' + this.fields.zip + (this.fields.phone ? '<br />' + this.fields.phone : "" );
				address.addClass('dealer-address').html(address_text);
				var distance = $(document.createElement('span'));
				distance.addClass('dealer-distance').html(this.fields.distance + " MI");
				address.append(document.createElement('br')).append(distance).append(document.createElement('br'));

				if(this.fields.website) {
					var website = $(document.createElement('span'));
					if(this.fields.website.substring(0,7) != 'http://') this.fields.website = 'http://' + this.fields.website;
					website.html('<a href="' + this.fields.website + '" target="_blank">Website</a>');
					address.append(website);
				}

				this.fields.email = false;
				if(this.fields.email) {
					var email = $(document.createElement('span'));
					email.html('<a href="mailto:' + this.fields.email + '">Email</a>');
					address.append(this.fields.website ? ' | ' : '').append(email);
				}

				var directions = $(document.createElement('span'));
				directions.html('<a href="#" onclick="goToDirections(\'' + this.fields.addr1 + ' ' + this.fields.addr2 + ' ' + this.fields.city + ', ' + this.fields.state + ' ' + this.fields.zip + '\');">Directions</a>');
				address.append(this.fields.website || this.fields.email ? ' | ' : '').append(directions);

				var name = $(document.createElement('span'));
				name.addClass('dealer-title').html(this.fields.name);
				address.prepend(document.createElement('br')).prepend(name);

				row.append(address)
				var dealername = this.fields.name;
				var type = this.fields.type;

				if(dealerMarkers[dealer_id] === openInfoWindowMarker) {
					row.addClass('infowindow');
				}
				var toggleInfoBubble = function() {
					//map.panTo(dealerMarkers[dealer_id].position);
					$('.infowindow').removeClass('infowindow');
					row.addClass('infowindow')
					dealerMarkers[dealer_id].setZIndex(100000);
					var data = document.createElement('div');
					data.className='infowindow';
					$(data).append('<div>' + address.html() + '</div>');
					var info = new google.maps.InfoWindow({ content: data, disableAutoPan: true });
					info.open(map, dealerMarkers[dealer_id]);
					if (openInfoWindow) {
						//openInfoWindowMarker.setIcon(openInfoWindowMarkerIcon);
						openInfoWindowMarker.setZIndex(zIndexCounter);
						openInfoWindow.close();
					}
					google.maps.event.addListener(info, 'closeclick', function () {
						//openInfoWindowMarker.setIcon(openInfoWindowMarkerIcon);
						row.removeClass('infowindow');
						openInfoWindowMarker.setZIndex(zIndexCounter);
					});
					openInfoWindow = info;
					openInfoWindowMarker = dealerMarkers[dealer_id];
					openInfoWindowMarkerIcon = dealerMarkers[dealer_id].icon;
					//dealerMarkers[dealer_id].setIcon(type == "Distributor" ? icon_distributor_selected : icon_retailer_selected);
					//$("#sidebar").animate({ scrollTop: 0 }, 300);
				}

				row.bind('click', toggleInfoBubble);
				google.maps.event.addListener(dealerMarkers[dealer_id], 'click', toggleInfoBubble);
				$(row).mouseover( function () { resetMarkers(); dealerMarkers[dealer_id].setZIndex(100000); dealerMarkers[dealer_id].setIcon(type == "Distributor" ? icon_distributor_selected : icon_retailer_selected);} ).mouseout( function () { dealerMarkers[dealer_id].setZIndex(zIndexCounter); dealerMarkers[dealer_id].setIcon(type == "Distributor" ? icon_distributor : icon_retailer); } );
				dealertable.append(row);
				zIndexCounter = zIndexCounter - 100;
			}

		});

		// scroll to the first new item if we've shown more than one "page" of results
		if(markerCount > perpage) {
			var lastlisting = $("#dealer-table tr.listing").eq(markerCount - perpage);
			var position = lastlisting.position().top + lastlisting.height();
			$("#sidebar").animate({ scrollTop: position/*$("#sidebar").prop("scrollHeight")*/ }, 0);
		}

		// remove all of the dealer markers that are no longer on the map
		for(var m in visibleDealerMarkers) {
			visibleDealerMarkers[m].setMap();
		}
		$('#milesdisplay').html(radius + ' miles');
		$('.countdisplay').html(total_dealers);
		$('.visibledisplay').html(markerCount < total_dealers ? markerCount : total_dealers);
		if(total_dealers == 0) {
			$('.displaying').hide();
			$('.errormessage').fadeIn('slow');
		} else {
			$('.displaying').show();
			$('.errormessage').hide();
		}
		toggleLoading(false);
}

function determineLocation(callback) {
	var zipcodeFromCookie = decodeURIComponent(readCookie('address'));

	if (zipcodeFromCookie != 'null') {
		address = zipcodeFromCookie;
		// google.loader.ClientLocation is null if IP cannot be located

		// check if the user already has a zipcode in a cookie

		LatLngFromAddress(address, callback);
		return true;
	} else {
		$.get('{{ LOCATOR_ROOT }}geoip/?'+ new Date().getTime(), function (data) {  
			if (data != 'false') {
				// google.loader.ClientLocation contains IP-geolocated data if IP address has known location data
				latlng = new google.maps.LatLng(readCookie('latitude'), readCookie('longitude'));
				address = decodeURIComponent(readCookie('address'));
				callback(latlng);
				return true;
			} else {
				// this should be pretty-ified with a fancy overlay
				address = readCookie('country_code');
				if(!address) {
					address = prompt('What is your zipcode?');
				} else {
					// show a big old zoomed out map
					//radius = 1000;
					map.setZoom(4);
				}
				createCookie('address', address, 7);
				determineLocation(callback);
				return true;

			/*	$.getJSON('locate/ip/', function (geolocation) {
					latlng = new google.maps.LatLng(geolocation[0].latitude, geolocation[0].longitude);
					callback(latlng);
				});*/
			}
		});
	}
	// find the user's location using the IP and then do something with it
}

function showMore() {
	newSearchLocation(true);
	$('#sidebar').scrollTop($('#sidebar').height());
}

/*
function nextPage() {
	google.maps.event.trigger(map, 'resize');
	if ( (page * perpage) < data.length) {
		page++;

		drawDealerMarkers();
	} else {
		return false;
	}
}

function checkNextPrev() {
		var next = false;
		var prev = false;
		if (((page) * perpage) >= data.length) {
			$('A.next').hide();
		} else {
			$('A.next').show();
			next = true;
		}
		if (page > 1){
			$('A.prev').show();
			prev = true;
		} else {
			$('A.prev').hide();
		}
		if (next && prev) {
			$('.nextprevseparator').show();
		} else {
			$('.nextprevseparator').hide();
		}
}

function prevPage() {
	google.maps.event.trigger(map, 'resize');
	if (page > 1) {
		page--;
		drawDealerMarkers();
	} else {
		return false;
	}
}
*/

function addressSearch(addr) {
	address = addr;
	LatLngFromAddress(addr, function() { map.setZoom(11); map.panTo(latlng); });
	createCookie('address', addr, 7);
}

function LatLngFromAddress(address, callback) {
	// Geocode an address and then do something with it
	geocoder.geocode({address: address}, function (results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			latlng = results[0].geometry.location;
			createCookie('latitude', latlng.lat(), 7)
			createCookie('longitude', latlng.lng(), 7)
			$.each(results[0].address_components, function(index, value) {
				if ($.inArray("country",value['types']) != -1) {
					createCookie('country_code', value['short_name']);
					return false;
				}
			});
			callback(latlng);
		} else {
			if( (window['console'] !== undefined) ){
				console.log(status);
			}
		}
	});
}
