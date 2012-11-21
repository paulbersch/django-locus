# give the dealer locator its own path off the root
# by including this file in the application urls.py
# for example, ('^locator/', include('locator.urls')),
from django.conf.urls.defaults import *
from api import LocationResource, FilterValueResource, CategoryResource, DataSetResource

from tastypie.api import Api
v1_api = Api(api_name='v1')

v1_api.register(LocationResource())
v1_api.register(FilterValueResource())
v1_api.register(CategoryResource())
v1_api.register(DataSetResource())

urlpatterns = patterns('locus.views',

    url(r'^locations/', include(v1_api.urls)),  # a to the p to the i
    # the default view, shows the locator and makes a guess at the location
    #url(r'^$', 'main', name='main'),
    url(r'^import/$', 'process_export', name='process_export'),
    url(r'^upload-export/$', 'upload_export', name='upload_export'),
    url(r'^nearby/(?P<latitude>[\d\.-]+)/(?P<longitude>[\d\.-]+)/(?P<miles>\d+)/$', 'nearby', name='nearby'),
    url(r'^nearby-bounds/(?P<latitude>[\d\.-]+)/(?P<longitude>[\d\.-]+)/(?P<swlat>[\d\.-]+)/(?P<swlng>[\d\.-]+)/(?P<nelat>[\d\.-]+)/(?P<nelng>[\d\.-]+)/$', 'nearby_within_bounds', name='nearby-bounds'),
    #url(r'^dealers/(?P<how>(zip|state|geo|all|georange))/(?P<info>.*)$', 'dealers', name='dealerlist'),
    #url(r'^dealers/geocode/$', 'geocode', name='geocode'),
    url(r'^ranged_geotagger$', 'ranged_geotagger', name='ranged_geotagger'),
    url(r'^geotagger$', 'geotagger', name='geotagger'),
    url(r'^(?P<dataset>.*)/$', 'locator', name='locator_landing'),
)

