from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
#from decimal import abs as dabs

# kudos http://codespatter.com/2009/07/01/django-model-manager-soft-delete-how-to-customize-admin/
class SoftDeleteManager(models.Manager):
    ''' Use this manager to get objects that have a deleted field
     Set objects = SoftDeleteManager() in the model to override the default manager.
     This way 'hidden' model instances are automatically not shown without having to filter out
     the hidden field manually in ever single instance.'''
    def get_query_set(self):
        return super(SoftDeleteManager, self).get_query_set().filter(do_not_display=False)
    def all_with_deleted(self):
        # essentially the regular old all() function
        return super(SoftDeleteManager, self).get_query_set()
    def deleted_set(self):
        return super(SoftDeleteManager, self).get_query_set().filter(do_not_display=True)
    def get(self, *args, **kwargs):
        ''' if a specific record was requested, return it even if it's deleted '''
        return self.all_with_deleted().get(*args, **kwargs)

    def filter(self, *args, **kwargs):
        ''' if pk was specified as a kwarg, return even if it's deleted '''
        if 'pk' in kwargs:
            return self.all_with_deleted().filter(*args, **kwargs)
        return self.get_query_set().filter(*args, **kwargs)




# Create your models here.

class Location(models.Model):
    objects = SoftDeleteManager()

    name = models.CharField(max_length=255)

    # address data
    addr1 = models.CharField(max_length=255)
    addr2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=255)
    state = models.CharField(max_length=255)
    zip = models.CharField(max_length=255)
    country = models.CharField(max_length=100, blank=True)

    # contact information
    phone = models.CharField(max_length=50, blank=True, null=True)
    website = models.CharField(max_length=250, blank=True, null=True)
    email = models.CharField(max_length=250, blank=True, null=True)

    # text data
    hours = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    # location attributes
    latitude = models.DecimalField(max_digits=16, decimal_places=13, null=True, blank=True)
    longitude = models.DecimalField(max_digits=16, decimal_places=13, null=True, blank=True)
    override_lat_long = models.BooleanField(default=False)
    override_lat_long.help_text = "Mark this field to prevent this location from auto-geotagging.  Useful if the geocoder service can't grok the address."

    # categorization/filtering
    do_not_display = models.BooleanField(default=False, null=False)
    filtervalues = models.ManyToManyField('FilterValue', blank=True, null=True)
    categories = models.ManyToManyField('Category', blank=True, null=True)
    datasets = models.ManyToManyField('DataSet', blank=True, null=True)

    # misc
    quality = models.IntegerField(default=-99)  # provided by the Yahoo Geocoder - can help identify poor-quality matches that might need human intervention
    category_string = models.CharField(max_length = 1000, blank=True)

    class Meta:
        verbose_name = 'Location'
        app_label = 'locus'
        verbose_name_plural = 'Locations'
        ordering = ('state','city','name')

    def __unicode__(self):
        return self.name

    def lookup_address(self):
        """Finds the latitude / longitude of the location's address using Google Magic"""
        # try the full address first
        from pygeocode import GeoCodeRequest

        if not self.override_lat_long:
            print " ".join([self.addr1, self.addr2, self.city, self.state, self.zip])
            gcr = GeoCodeRequest(" ".join([self.addr1, self.addr2, self.city, self.state, self.zip]))
            if gcr.send_request():
                latlng = gcr.get_property('geometry')[0]['location']
                self.latitude = latlng['lat']
                self.longitude = latlng['lng']
            else:
                self.longitude = 0
                self.latitude = 0

@receiver(pre_save, sender=Location)
def lookup(sender, **kwargs):
    instance = kwargs.pop('instance', None)
    if instance.id:
        instance.category_string = ", ".join([x.name for x in instance.categories.all()])
    if instance.latitude is None or (instance.latitude is not None and instance.longitude is not None and (abs(instance.latitude) < 1 or abs(instance.longitude) < 1)):
        instance.lookup_address()
        

class FilterValue(models.Model):
    """ used to denote attributes of locations, such as availability of a product or service """
    name = models.CharField(max_length=100)
    shortname = models.SlugField(max_length=100, unique=True)

    class Meta:
        app_label = 'locus'
        verbose_name = 'Filter Value'
        verbose_name_plural = 'Filter Values'

    def __unicode__(self):
        return self.name

class Category(models.Model):
    """ used to classify and delineate between groups of locations, such as dealers, distributiors, and service centers """
    name = models.CharField(max_length=100)
    shortname = models.SlugField(max_length=100, unique=True)

    class Meta:
        app_label = 'locus'
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'

    def __unicode__(self):
        return self.name

class DataSet(models.Model):
    """ determines which locator(s) the data appears in """
    name = models.CharField(max_length=100)
    shortname = models.SlugField(max_length=100, unique=True)

    class Meta:
        app_label = 'locus'

    def __unicode__(self):
        return self.name
