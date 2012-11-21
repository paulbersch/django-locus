from django.contrib import admin
from locus import models
from imp import find_module

class BaseAdmin(admin.ModelAdmin):
    """ An abstract base class for admin pages. Add things that all locator admin pages need here so you keep DRY. """

    class Media:
        js = [
            '/static/grappelli/tinymce/jscripts/tiny_mce/tiny_mce.js',
            '/site_media/js/tinymce_setup.js',
        ]

    class Meta:
        abstract = True
    

class LocationAdmin(BaseAdmin):
    """ The admin pages for managing dealers. Locations are businesses with a fixed location who sell products and provide service. """
    list_display = ('name','city','state','zip','id','latitude','longitude','quality')
    list_filter = ('do_not_display','filtervalues')
    ordering = ('state',)
    search_fields = ('name','city','state','zip','country')

    def queryset(self, request):
        """ Returns a QuerySet of all model instances that can be edited by the
        admin site. This is used by changelist_view. """
        # Default: qs = self.model._default_manager.get_query_set()
        qs = self.model._default_manager.all_with_deleted()
        # TODO: this should be handled by some parameter to the ChangeList.
        ordering = self.ordering or () # otherwise we might try to *None, which is bad ;)
        if ordering:
            qs = qs.order_by(*ordering)
        return qs

class FilterValueAdmin(BaseAdmin):
    """ The admin pages for managing filtervalues. FilterValues are limited-time events that are associated with dealers. """
    prepopulated_fields = {"shortname": ("name",)}
    list_display = ('name',)
    ordering = ('name',)

class CategoryAdmin(BaseAdmin):
    prepopulated_fields = {"shortname": ("name",)}
    list_display = ('name',)
    ordering = ('name',)

class DataSetAdmin(BaseAdmin):
    prepopulated_fields = {"shortname": ("name",)}
    list_display = ('name',)
    ordering = ('name',)


admin.site.register(models.Location, LocationAdmin)
admin.site.register(models.FilterValue, FilterValueAdmin)
admin.site.register(models.Category, CategoryAdmin)
admin.site.register(models.DataSet, DataSetAdmin)
