import csv
from locus.models import Location, DataSet, Category
from random import choice

""" just a dirty script for importing csv location data from http://www.poi-factory.com/ for testing """

categories = list(Category.objects.all())
dataset = DataSet.objects.get(id=1)

with open('walmart.csv','r') as csvfile:
    reader = csv.reader(csvfile, delimiter=',', quotechar='"')
    for row in reader:
        try:
            loc = Location()

            loc.longitude = float(row[0])
            loc.latitude = float(row[1])
            loc.name = row[2]

            address = row[3].split(',')

            loc.addr1 = address[0]

            if len(address) > 6:
                # there is an addr2+
                loc.addr2 = address[1]

            loc.city = address[-5]
            loc.state = address[-4]
            loc.zip = address[-3]
            loc.phone = address[-2]

            loc.save()

            loc.datasets.add(dataset)
            loc.categories.add(choice(categories))
            loc.categories.add(choice(categories))

        except Exception as e:
            print e
