from sys import path
import os
import time

# adjust to the paths and app name of the given project
path.append('/mnt/missioncontrol/clients/Restat/interactive/sites/restat.gsdesign.com/apps/')
path.append('/mnt/missioncontrol/clients/Restat/interactive/sites/restat.gsdesign.com/')
os.environ['DJANGO_SETTINGS_MODULE'] = 'restat.settings'

from locator.models import Location
import pygeocode
from django.db.models import Q
from django.conf import settings

success_log = open('success.txt','w')
failure_log = open('fail.txt','w')

locations = Location.objects.filter(
		Q(longitude__exact = None) | Q(latitude__exact = None) |
		Q(longitude__exact = 0) | Q(latitude__exact = 0)
	)

for location in locations:
	address = "{0} {1} {2}, {3} {4}".format(location.street_line1, location.street_line2, location.city, location.state, location.zip)
	gcr = pygeocode.GeoCodeRequest(address, response_format='json',sensor='false')
	gcr.send_request()
	if(gcr.response_data['status'] == 'OK'):
		geometry = gcr.get_property('geometry')
		latlng = geometry['geometry']['location']
		location.latitude = latlng['lat']
		location.longitude = latlng['lng']
		location.save()
		success_log.write("Location id {0} updated with coordinates {1} - address: {2}\n".format(location.id, latlng, address))
	else:
		failure_log.write("Location id {0} failed with status {1} - address: {2}\n".format(location.id, gcr.response_data['status'], address))
	time.sleep(.75)
