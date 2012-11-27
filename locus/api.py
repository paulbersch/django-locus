from tastypie.resources import ModelResource
from tastypie.authorization import ReadOnlyAuthorization
from tastypie import fields
from models import Location, FilterValue, Category, DataSet

class FilterValueResource(ModelResource):
    class Meta:
        queryset = FilterValue.objects.all()
        resource_name = 'filtervalue'
        authorization = ReadOnlyAuthorization()

class CategoryResource(ModelResource):
    class Meta:
        queryset = Category.objects.all()
        resource_name = 'category'
        authorization = ReadOnlyAuthorization()

class DataSetResource(ModelResource):
    class Meta:
        queryset = DataSet.objects.all()
        resource_name = 'DataSet'
        authorization = ReadOnlyAuthorization()

class LocationResource(ModelResource):
    filtervalues = fields.ToManyField("locus.api.FilterValueResource", 'filtervalues', related_name='locations', blank=True, null=True, full=True)
    categories = fields.ToManyField("locus.api.CategoryResource", 'categories', related_name='locations', blank=True, null=True, full=True)
    datasets = fields.ToManyField("locus.api.DataSetResource", 'datasets', related_name='locations', blank=True, null=True, full=True)

    class Meta:
        queryset = Location.objects.all()
        resource_name = 'location'
        limit = 100
        authorization = ReadOnlyAuthorization()

    def build_filters(self, filters=None):
        if filters is None:
            filters = {}
        custom_filters = {}

        for m2m in ['filtervalues','categories','datasets',]:
            if m2m in filters:
                values = filters[m2m]
                if len(values) > 0:
                    custom_filters.update({
                        m2m + '__in': values.split(',')
                    })
                del filters[m2m]

        if 'bounds' in filters:
            swlat, swlng, nelat, nelng = [float(x) for x in filters['bounds'].split(',')]

            lat_fudge = abs(nelat - swlat) * .02
            lng_fudge = abs(swlng - nelng) * .02

            fudge = min([lat_fudge, lng_fudge]) # use the smaller fudge - otherwise the gutter gets distorted for very non-square maps

            (swlat, swlng, nelat, nelng) = ((swlat - fudge), (swlng + fudge), (nelat - fudge), (nelng + fudge))

            custom_filters.update({
                'latitude__gte': swlat,
                'latitude__lte': nelat,
                'longitude__gte': swlng,
                'longitude__lte': nelng
            })

        orm_filters = super(LocationResource, self).build_filters(filters)
        orm_filters.update(custom_filters)

        return orm_filters

    def apply_filters(self, request, applicable_filters):
        # the __in query can return duplicates, so filter those out with distinct()
        return super(LocationResource, self).apply_filters(request, applicable_filters).distinct()
