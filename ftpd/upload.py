#!/usr/bin/python
import cgi, os
import cgitb; cgitb.enable()
form = cgi.FieldStorage()

# Get FTP username from /ftp dir
def get_username():
  basepath = '/ftp'
  for f in os.listdir(basepath):
    if os.path.isdir(os.path.join(basepath, f)):
        # User directory identified
        return f
  return None

def upload_file():
  fn = ''
  message = ''

  username = get_username()

  if username is None:
    return '<li>Sorry, unable to identify FTP server username</li>'

  if not 'filenames' in form:
    return '<li>Sorry, no files to upload provided</li>'

  fileitems = form['filenames']

  if not isinstance(fileitems, list):
    fileitems = [ fileitems ]

  for fileitem in fileitems:
    # Test if the file was uploaded
    if len(fileitem.filename) > 0:
      try:
        fn = os.path.basename(fileitem.filename)
        open('/ftp/' + username + '/' + fn, 'wb').write(fileitem.file.read())
        message += '<li>File "<b>' + fn + '</b> was uploaded successfully</li>'
      except Exception as e:
        message = '<li>File <b>' + fn + '</b> was not uploaded (%s)</li>' % e
    else:
      message = '<li>Sorry, no file(s) provided</li>'
  return message, username

#
# Main code
#
message, username = upload_file()

print("""\
Content-Type: text/html\n
<html>
<head>
  <title>PALMS file(s) upload results</title>
</head>
<body bgcolor="f0f0f8">
   <font color="#0f0f1d" face="helvetica, arial">
   <h2>PALSM file(s) upload results</h2>
   <p><ul>%s</ul></p>
   <p>
     Please press <a href="upload.html">here</a> to send other file(s)<br>
     To access the user files, please click <a href="%s/">here</a>
   </p>
</body>
</html>
""" % (message, username))

