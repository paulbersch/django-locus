import urllib
from urllib2 import Request, urlopen
import urlparse
import json

API_URL = "http://maps.googleapis.com/maps/api/geocode/"

class GeoCodeRequest(object):
	def __init__(self, address, response_format = 'json', sensor = "false"):
		self.address = address
		self.response_format = response_format
		self.sensor = sensor

		data = {
			'address': self.address,
			'sensor': self.sensor,
				}

		self.requestURL = "{0}?{1}".format(urlparse.urljoin(API_URL, self.response_format), urllib.urlencode(data))

		#print self.requestURL
	def send_request(self):
		self.request = Request(self.requestURL)
		self.response = urlopen(self.request)
		self.response_data = json.loads(self.response.read())
		if self.response_data['status'] != 'OK':
			return False
			#print self.response_data['status'] + ": Failed request for: " + self.address
		else:
			return True

	def get_property(self, property_name):
		results = []
		for result in self.response_data['results']:
			print result
			results.append(result[property_name])
		print results
		return results

if __name__ == "__main__":
	gcr = GeoCodeRequest('9144 N. Brandybrook Trl. Brown Deer, WI 53223')
	gcr.send_request()
	geometry = gcr.get_property('geometry')
	print geometry['geometry']['location']

