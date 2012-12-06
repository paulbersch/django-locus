import math
# add back later
# import GeoIP

nauticalMilePerLat = 60.00721
nauticalMilePerLongitude = 60.10793
rad = math.pi / 180.0
milesPerNauticalMile = 1.15078

def calcDistance(lat1, lon1, lat2, lon2):                      
	"""
	Caclulate distance between two lat lons in NM
	"""
	lat1 = float(lat1)
	lat2 = float(lat2)
	lon1 = float(lon1)
	lon2 = float(lon2)
	yDistance = (lat2 - lat1) * nauticalMilePerLat
	xDistance = (math.cos(lat1 * rad) + math.cos(lat2 * rad)) * (lon2 - lon1) * (nauticalMilePerLongitude / 2)

	distance = math.sqrt( yDistance**2 + xDistance**2 )

	return distance * milesPerNauticalMile

def milesBox( lat, lon, radius ):
	"""
	Returns two lat/lon pairs as (lat1, lon2, lat2, lon2) which define a box that exactly surrounds
	a circle of radius of the given amount in miles.
	"""

	# this gives us a tuple of values that can easily be used to get a list of "possibly close"
	# dealers.  then we use the calcDistance function to check if it's ACTUALLY within the radius.
	latRange = radius / ( milesPerNauticalMile * 60.0 )
	lonRange = radius / ( math.cos(lat * rad) * milesPerNauticalMile * 60.0)

	return ( lat - latRange, lon - lonRange, lat + latRange, lon + lonRange )


def revLookup(ip):
    return False

"""
	gi = GeoIP.open("/usr/local/share/GeoIP/GeoLiteCity.dat",GeoIP.GEOIP_STANDARD)

	return gi.record_by_addr(ip)
"""
