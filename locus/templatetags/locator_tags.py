from django import template
from locator.models import Promotion

register = template.Library()

@register.inclusion_tag('locator/side.html', takes_context=True)
def sidebar_locator(context, productname, filters, promotions):
	return { 'productname': productname, 'filters': filters, 'promotions':promotions, 'LOCATOR_MEDIA_URL': context['LOCATOR_MEDIA_URL'], 'LOCATOR_ROOT': context['LOCATOR_ROOT'] }
