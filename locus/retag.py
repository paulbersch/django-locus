# -*- coding: utf-8 -*-
from geopy import geocoders
import xml.dom.minidom
from geopy import util
from geopy import Point
from urllib import urlencode
from urllib2 import urlopen, HTTPError
from geopy.geocoders.base import Geocoder
import time
from decimal import Decimal

from django.core.serializers import serialize
import os
import sys

os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
os.environ['PYTHONIOENCODING'] = 'UTF-8'
import sys, locale, os
print(sys.stdout.encoding)
print(sys.stdout.isatty())
print(locale.getpreferredencoding())
print(sys.getfilesystemencoding())
print(os.environ["PYTHONIOENCODING"])
print(unichr(246), unichr(9786), unichr(9787))

from models import Dealer

try:
    import json
except ImportError:
    try:
        import simplejson as json
    except ImportError:
        from django.utils import simplejson as json

class Yahoo(Geocoder):

    BASE_URL = "http://where.yahooapis.com/geocode?%s"

    def __init__(self, app_id, format_string='%s', output_format=None):
        self.app_id = app_id
        self.format_string = format_string
        
        if output_format != None:
            from warnings import warn
            warn('geopy.geocoders.yahoo.Yahoo: The `output_format` parameter is deprecated '+
                 'and now ignored. JSON will be used internally.', DeprecationWarning)

    def geocode(self, string, exactly_one=True):
        params = {'location': self.format_string % string,
                  'appid': self.app_id,
                  'flags': 'J'
                 }
        url = self.BASE_URL % urlencode(params)
        util.logger.debug("Fetching %s..." % url)
        return self.geocode_url(url, exactly_one)

    def geocode_url(self, url, exactly_one=True):
        page = urlopen(url)
        return self.parse_json(page, exactly_one)
    
    def parse_json(self, page, exactly_one=True):
        if not isinstance(page, basestring):
            page = util.decode_page(page)
        doc = json.loads(page)
        results = doc.get('ResultSet', []).get('Results', [])

        if not results:
            raise ValueError("No results found")
        elif exactly_one and len(results) != 1:
            raise ValueError("Didn't find exactly one placemark! " \
                             "(Found %d.)" % len(results))

        def parse_result(place):
            line1, line2, line3, line4 = place.get('line1'), place.get('line2'), place.get('line3'), place.get('line4')
            address = util.join_filter(", ", [line1, line2, line3, line4])
            city = place.get('city')
            state = place.get('state')
            country = place.get('country')
            location = util.join_filter(", ", [address, city, country])
            lat, lng = place.get('latitude'), place.get('longitude')
            #if lat and lng:
            #    point = Point(floatlat, lng)
            #else:
            #    point = None
            return (place, location, (float(lat), float(lng)))
    
        if exactly_one:
            return parse_result(results[0])
        else:
            return [parse_result(result) for result in results]

    def reverse(self, coord, exactly_one=True):
        (lat, lng) = coord
        params = {'location': '%s,%s' % (lat, lng),
                  'gflags' : 'R',
                  'appid': self.app_id,
                  'flags': 'J'
                 }
        url = self.BASE_URL % urlencode(params)
        return self.geocode_url(url, exactly_one)

if __name__ == '__main__':
	y = Yahoo('7Gzx6f4c')  
	dealers = Dealer.objects.all().filter(quality=0)#.filter(override_lat_long = False).filter(city_unmatched = True).filter(quality = 0)

	print "...starting"
	for dealer in dealers:
		failed = False
		print "Next dealer..."
		print [dealer.addr1, dealer.addr2, dealer.city, ",", dealer.state, dealer.zip if (dealer.zip is not None and len(dealer.zip) == 5) else "", dealer.country]
		location = " ".join([dealer.addr1, dealer.addr2, dealer.city, ",", dealer.state, dealer.zip if (dealer.zip is not None and len(dealer.zip) == 5) else "", dealer.country if dealer.country is not None else ""])
		try:
			place, address, (lat, lng) = y.geocode(location) 
		except ValueError:
			print "Not found.", location
			failed = True
		except HTTPError:
			time.sleep(1)
			try:
				place, address, (lat, lng) = y.geocode(location) 
			except ValueError:
				print "Not found.", location
				failed = True
			except:
				failed = True

		print "...geolocation attempted"
		if not failed and dealer.state != place["statecode"]:
			#failed = True
			print "State different"
			print location, dealer.latitude, dealer.longitude
			print address.encode('UTF-8'), lat, lng
			print place
			print

		if not failed and dealer.city.lower() != place["city"].lower():
			#failed = True
			print "City different"
			print location, dealer.latitude, dealer.longitude
			print address.encode('UTF-8'), lat, lng
			print place
			print
			try:
				if dealer.city.lower() in place["city"].lower() or place["city"].lower() in dealer.city.lower():
					failed = False
					print "Would pass special test"
			except:
				print "Encoding fail on special test."
			if int(place['quality']) >= 85:
				failed = False
				print "Gets a pass because of high quality"

		print "...about to save"
		if failed:
			dealer.validated = False
			dealer.latitude = 0
			dealer.longitude = 0
			dealer.quality = -1
			dealer.save()
		elif not failed:
			dealer.latitude = Decimal(place['latitude'])
			dealer.longitude = Decimal(place['longitude'])
			dealer.quality = int(place['quality'])
			dealer.save()

	#print y.reverse((lat,lng))
