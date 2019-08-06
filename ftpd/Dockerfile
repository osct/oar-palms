FROM alpine:3.7
RUN apk --no-cache add vsftpd\
                       bash\
                       vim\
                       curl\
                       mini_httpd\
                       python &&\
    cp /etc/mini_httpd/mini_httpd.conf\
       /etc/mini_httpd/mini_httpd.conf_orig &&\
    sed -i "s/^port=.*/port=80/" /etc/mini_httpd/mini_httpd.conf &&\
    sed -i "s/^dir=.*/dir=\\/ftp/" /etc/mini_httpd/mini_httpd.conf &&\
    sed -i "s/^user=.*/user=minihttpd/" /etc/mini_httpd/mini_httpd.conf &&\
    sed -i "s/^dir=.*/dir=\\/ftp/" /etc/mini_httpd/mini_httpd.conf &&\
    sed -i "s/^#nochroot/nochroot/" /etc/mini_httpd/mini_httpd.conf &&\
    sed -i "s/^#cgipat.*/cgipat=**.sh|**.cgi|**.py/" /etc/mini_httpd/mini_httpd.conf &&\
    echo "mini_httpd.conf" &&\
    cat /etc/mini_httpd/mini_httpd.conf &&\
    echo "Docker image setup, completed"

COPY ftpd.sh /bin/ftpd.sh
COPY vsftpd.conf /etc/vsftpd/vsftpd.conf
COPY upload.html /ftp/upload.html
COPY upload.py /ftp/upload.py

EXPOSE 21 21000-21010
EXPOSE 80

CMD "/bin/ftpd.sh"
