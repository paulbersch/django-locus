django-locus
============

A Django store locator with a REST API and a backbone.js frontend.  Maps provided by the Google Maps API.

Still a work in progress: right now it puts pins on a map and shows locations below.

Installation
------------

If you want to take it for a spin, there's an example project and a test CSV file with Walmart locations from http://www.poi-factory.com/.

Clone the repository, create a virtualenv for the project, and install the required packages.

    git clone git@github.com:paulbersch/django-locus.git
    cd django-locus
    virtualenv virtualenv
    source virtualenv/bin/activate
    pip install -r requirements.txt

Set up the database and create an inital user for the admin.
    cd example
    ./manage.py syncdb

Next you'll want to install the test data.  First open a shell_plus, which will take care of setting up your Django environment.

    ./manage.py shell_plus
    
From the shell, import the csv import script, which will parse the CSV file and load the data into Django models.

    import csv_import

Finally, run the Django development server.

    ./manage.py runserver
