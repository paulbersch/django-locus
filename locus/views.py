# Create your views here.
from django.core.urlresolvers import reverse
from django.core.serializers import serialize
from django.core.management import call_command
from django.template import RequestContext
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render_to_response
from locus.models import Location, Category
from random import random as randomfloat
from locus.utils.location import calcDistance, milesBox, revLookup
from django.db.models import Q
from django.contrib.auth.decorators import login_required
import json
from django.views.decorators.cache import never_cache
from django.utils.encoding import smart_unicode
from urllib import quote
from django.conf import settings
import subprocess, sys

def locator(request, dataset):
	# override main_custom to allow you to extend the main template
	return render_to_response(["locus/" + dataset + ".html", "locus/main_custom.html","locus/main.html"], { 'categories': Category.objects.all() }, context_instance = RequestContext(request))

def locations(request, how, info):
	locations = ''

	if(how == 'zip'):
		locations = serialize("json", Location.objects.filter(zip__exact = info))
	elif(how == 'state'):
		locations = serialize("json", Location.objects.filter(state__exact = info.upper()))
	elif(how == 'geo'):
		locations = serialize("json", Location.objects.filter(
			Q(longitude__exact = None) | Q(latitude__exact = None) | Q(longitude__exact = 0) | Q(latitude__exact = 0)))
	elif(how == 'georange'):
		start, end = info.split(',')
		locations = serialize("json", Location.objects.filter(
			Q(longitude__exact = None) | Q(latitude__exact = None) | Q(longitude__exact = 0) | Q(latitude__exact = 0))[int(start):int(end)])
	else:
		# ensure that any overridden entries don't get re-geocoded
		locations = serialize("json", Location.objects.all().filter(override_lat_long = False))

	return HttpResponse(locations)

@never_cache
def geoip(request):

	ip = request.META['REMOTE_ADDR']
	# look up in the database

	if ip[:3] == '10.':
		ip = '99.125.184.183'
		ip = '98.100.216.114'
		#ip = '88.65.216.37'

	record = revLookup(ip)

	if record and record['city'] != None and record['region_name'] != None:
		for key in record.keys():
			if 'decode' in dir(record[key]):
				record[key] = record[key].decode('iso-8859-1')
		country = record['country_code']
		latitude = record['latitude']
		longitude = record['longitude']
		address = quote(u" ".join([record['city'], record['region_name']]).encode('utf-8'))

		response = HttpResponse(json.dumps(record,ensure_ascii=False))

		response.set_cookie('latitude',value=latitude)
		response.set_cookie('address',value=address)
		response.set_cookie('longitude',value=longitude)
		response.set_cookie('country_code',value=country)

		return response
	elif record and record['country_code'] != None:
		#usually at minimum the country can be determined
		response = HttpResponse("false")
		response.set_cookie('country_code', value=record['country_code'])
		return response
	else:
		#they'll have to tell us themselves
		return HttpResponse("false")


def sort_by_attr(seq,attr):
	intermed = [ (getattr(seq[i],attr), i, seq[i]) for i in xrange(len(seq)) ]
	intermed.sort()
	return [ tup[-1] for tup in intermed ]

def nearby_within_bounds(request, latitude, longitude, swlat, swlng, nelat, nelng):
	# fudge the bounding box to be a bit smaller so that locations on the edges don't show
	(swlat, swlng, nelat, nelng) = (float(swlat), float(swlng), float(nelat), float(nelng))

	lat_fudge = abs(nelat - swlat) * .02
	lng_fudge = abs(swlng - nelng) * .02

	fudge = min([lat_fudge, lng_fudge]) # use the smaller fudge - otherwise the gutter gets distorted for very non-square maps

	(swlat, swlng, nelat, nelng) = ((swlat - fudge), (swlng + fudge), (nelat - fudge), (nelng + fudge))

	# takes the southwest and northeast coordinates of the bounding box in addition to the center
	nearbyLocations = Location.objects.filter(latitude__gte = swlat).filter(latitude__lte = nelat).filter(longitude__gte = swlng).filter(longitude__lte = nelng)

	(total_locations, locations) = filter_locations(request, latitude, longitude, nearbyLocations)

	locations = serialize("json", locations);

	locations = '[' + str(total_locations) + ', ' + locations + ']'

	return HttpResponse(locations)

def nearby(request, latitude, longitude, miles):
	# convert the input data to numeric types
	(latitude, longitude, miles) = (float(latitude), float(longitude), int(miles))

	# calculate the coordinates of a square with a height of 2 x the search radius
	(lat1,long1,lat2,long2) = milesBox(latitude, longitude, miles)

	"""
	# currently vulnerable to exploitation, should whitelist filters and filtervalues
	if('filters' in request.GET and request.GET['filters'] != ''):
		filters = [ u"{0:s} = '1'".format(filtername) for filtername in request.GET['filters'].split(',') ]
	else:
		filters = []
	"""
	nearbyLocations = Location.objects.filter(latitude__gte = lat1).filter(latitude__lte = lat2).filter(longitude__gte = long1).filter(longitude__lte = long2)
	(total_locations, locations) = filter_locations(request, latitude, longitude, nearbyLocations)

	locations = serialize("json", locations);

	locations = '[' + str(total_locations) + ', ' + locations + ']'

	return HttpResponse(locations)

def filter_locations(request, latitude, longitude, nearbyLocations, miles = False):
	if('filters' in request.GET and request.GET['filters'] != ''):
		filters = request.GET['filters'].split(',')
	else:
		filters = []

	if('brands' in request.GET and request.GET['brands'] != ''):
		brands = request.GET['brands'].split(',')
	else:
		brands = []

	if('types' in request.GET and request.GET['types'] != ''):
		types = request.GET['types'].split(',')
	else:
		types= []

	if('filtervalues' in request.GET and request.GET['filtervalues'] != ''):
		filtervalues = request.GET['filtervalues'].split(',')
		nearbyLocations = nearbyLocations.filter(filtervalues__in = filtervalues)

	if len(filters) > 0:
		nearbyLocations = nearbyLocations.filter(categories__shortname__in = filters)

	if len(types) > 0:
		nearbyLocations = nearbyLocations.filter(type__in = types)

	if len(brands) > 0:
		args = {}
		for brand in brands: args[brand] = True
		nearbyLocations = nearbyLocations.filter(**args)

	# find all of the locations that fall within the box

	locations = []
	locationsbydistance = {}

	# filter the locations who are outside of the search radius
	# the initial determination is based on a box, not a circle
	# locations that fall outside of the circle will have a distance from our search point greater than the
	# specified radius
	for location in nearbyLocations:
		distance = calcDistance(latitude, longitude, location.latitude, location.longitude)
		if not miles or distance <= miles:
			# store the distance in the object temporarily, so it's available to the front-end page
			location.distance = round(distance, 2)
			locations.append(location)
			locationsbydistance[location.id] = distance

	# now sort them by distance
	locations = sort_by_attr(locations, 'distance')

	total_locations = len(locations)
	if 'limit' in request.GET:
		try:
			locations = locations[:int(request.GET['limit'])]
		except:
			pass

	return (total_locations, locations)

def geotagger(request):
	if 'all' in request.GET:
		updatewhich = 'all'
	else:
		updatewhich = 'geo'
	return render_to_response('locus/geotagger.html', { 'updatewhich': updatewhich }, context_instance = RequestContext(request))

def ranged_geotagger(request):
	updatewhich = 'georange'
	start, end = (request.GET['start'], request.GET['end'])
	return render_to_response('locus/geotagger_range.html', { 'updatewhich': updatewhich, 'start': start, 'end': end }, context_instance = RequestContext(request))

def geocode(request):
	""" Saves the latitude and longitude of a location object """
	location = Location.objects.get(id__exact = request.GET['id'])
	location.latitude = request.GET['latitude']
	location.longitude = request.GET['longitude']
	location.save()
	return HttpResponse('OK')

@login_required
def upload_export(request):
	return render_to_response(['locus/upload_export.html',], context_instance = RequestContext(request))

@login_required
def process_export(request):
	if 'export' in request.FILES:
		# back up the old database just in case

		sys.stdout = open('/tmp/locator_backup.json', 'w')
		call_command('dumpdata', 'locus', format='json', indent=2, interactive=False, all=True)
		sys.stdout.close()
		sys.stdout = sys.__stdout__

		locator_dataset_number = request.POST.get('locator_dataset', '1')
		locator_dataset = Promotion.objects.get(id=locator_dataset_number)
		f = open('/tmp/locator_export.txt', 'w')
		for chunk in request.FILES['export'].chunks():
			f.write(chunk)
		f.close()

		import csv
		import os
		import re
		from cartridge.shop.models import ProductVariation
		from django.template.defaultfilters import slugify

		f = open('/tmp/locator_export.txt', 'r')
		notfound = open('/tmp/notfound.txt', 'w')

		csvreader = csv.reader(f, delimiter="\t")

		# hide all locations (so that locations that haven't recieved new inventory won't appear in searches)
		# also clear out the inventory
		for location in Location.objects.all_with_deleted().filter(promotion = locator_dataset):
			location.inventory.clear()
			location.categories.clear()
			location.filtervalues.clear()
			location.do_not_display = True
			location.audio = False
			location.wireless = False
			location.hartke = False
			location.zoom = False
			location.save()

		d = Location()
		count = 0

		for row in csvreader:
			count += 1
			if row[0] == 'fiscal':
				continue
			if d.account_id != row[1] or d.account_key != row[3]:
				try:
					d = Location.objects.get(account_id = row[1], account_key = row[3])
				except Location.DoesNotExist:
					d = Location()
				id = d.id
				d.account_id = row[1]
				d.account_key = row[3]
				d.name = row[4]
				d.addr1 = row[5]
				d.addr2 = row[6]
				d.addr3 = row[7]
				d.city = row[8]
				d.state = row[9][:2]
				d.zip = row[10]
				d.save()
			else:
				print 'skip', row[1]

			d.filtervalues.add(locator_dataset)
			d.save()

			if row[11] == 'A':
				d.audio = True
			if row[11] == 'W':
				d.wireless = True
			if row[11] == 'H':
				d.hartke = True
			if row[11] == 'Z':
				d.zoom = True

			try:
				v = ProductVariation.objects.get(sku = row[12])
				p = v.product
				d.inventory.add(p)
				categories = Category.objects.filter(categories__products = p)
				for category in categories:
					d.categories.add(category)
				d.do_not_display = False
			except ProductVariation.DoesNotExist:
				print "couldn't find ", row[12]
				notfound.write(row[12] + "\n")

			d.save()

		for d in Location.objects.filter(latitude=None):
			d.lookup_address()
			d.save()
		return HttpResponseRedirect("/wheretobuy/ranged_geotagger?start=0&end=10000")
	return HttpResponse("Must upload a file")
