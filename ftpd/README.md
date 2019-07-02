# FutureGateway FTP Server
This image provides an Alpine linux with an vsftp service and a HTTP server publishing the FTP uploaded files.
To build this image the code from [docker-alpine-ftp-server][FTPSRV] [Docker hub][DHUB] image has been used.

## Usage
```
docker run -d \
           -p 21:21 \
           -p 80:80 \
           -p 21000-21010:21000-21010 \
           -e USERS="one|1234" \
           -e ADDRESS=ftp.site.domain \
           osct/ftpd
```

## Configuration

Environment variables:
- `USERS` - space and `|` separated list (optional, default: `ftp|alpineftp`)
  - format `name1|password1|[folder1][|uid1] name2|password2|[folder2][|uid2]`
- `ADDRESS` - external address witch clients can connect passive ports (optional)
- `MIN_PORT` - minamal port number may be used for passive connections (optional, default `21000`)
- `MAX_PORT` - maximal port number may be used for passive connections (optional, default `21010`)

## USERS examples

- `user|password foo|bar|/home/foo`
- `user|password|/home/user/dir|10000`
- `user|password||10000`

[DHUB]:{https://hub.docker.com}
[FTPSRV]:{https://github.com/delfer/docker-alpine-ftp-server}