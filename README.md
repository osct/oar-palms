# OAR Reproducibility for PALMS
PALMS is a micro-simulation that predicts the lifelong physical activity behaviour of a population taking into account individual characteristics and their effect on physical activity over time. The model produces individual and aggregated quantitative outputs for quality of life and health conditions related costs.
This repository allow to reproduce REPAST executions for PALMS study, starting from entries registered into the Open [Access Reposigory (OAR)][OAR]

# Setup
The following components are necessary in order to execute REPAST simulations:

* Docker image for REPAST
* Docker image hosting an ftp server necessary for REPAST image, it also hosts a httpd service that publishes ftp folder

Please notice that reproducibility hosting machine requires Docker compose and Makefile.

## REPAST docker image
[REPAST image][OSCT_REPAST] can be downloaded from [Docker hub][DHUB]. In alternative the image can be built with the following commands:

```bash
cd repast
make image
```

## FTPD docker image
[FTPD image][OSCT_FTPD] can be downloaded from [Docker hub][DHUB]. In alternative the image can be built with the following commands:

```bash
cd ftpd
make image
```

# Execution
Once the REPAST and FTPD images are available, it is possible to execute a simulation running the following commands:

```bash
export HTTP_OUT_PORT=80
REPAST_PARAMS=http://jobserver2.hopto.org/repast/PALMS/input/batch_params.xml_0
REPAST_MODEL=http://jobserver2.hopto.org/repast/PALMS/model.tar
FTP_USER=$(cat palms.env | grep USERS | awk -F'=' '{ print $2 }' | cut -d '|' -f1)
FTP_PASS=$(cat palms.env | grep USERS | awk -F'=' '{ print $2 }' | cut -d '|' -f2)
docker-compose run --rm repast\
                        /opt/execute.sh $FTP_USER\
                                        $FTP_PASS\
                                        ftp://ftpd/\
                                        "$REPAST_MODEL"\
                                        "$REPAST_PARAMS" 
# To get the output
REPAST_OUT=out_$(basename $REPAST_PARAMS).tar
curl localhost:$HTTP_OUT_PORT/$FTP_USER/$REPAST_OUT > $REPAST_OUT
# Release the allocated FTP server
docker-compose down -v
```

The REPAST execution requires three inputs:

 * The HTTP port number used to publish REPAST output
 * A HTTP URL address pointing to the model file for REPAST
 * A HTTP URL address pointing to the REPAST parameter file

The script above uses the environment file `palms.env` which specifies the FTP server user and password values.
The `HTTP_OUT_PORT` specifies the HTTP server port that will be used by Docker to expose the HTTP server.
Execution output can be retrieved from an FTP client using credentials specified in the `palms.env` file, or via the HTTP server as in the execution example above.

# References
* The REPAST Docker image is taken from [osabuon/repast][REPAST_DHUB] Docker image.
* The FTPD Docker image has been taken from [Alpine FTP Server][APLINE_VSFTP] project and adapted to the REPAST reproducibility requirements.

[DHUB]:{https://hub.docker.com}
[OAR]:{https://www.openaccessrepository.it}
[REPAST_DHUB]:{https://hub.docker.com/r/osabuoun/repast}
[APLINE_VSFTP]:{https://github.com/delfer/docker-alpine-ftp-server}
[OSCT_REPAST]:{https://cloud.docker.com/u/osct/repository/docker/osct/repast}
[OSCT_FTPD]:{https://cloud.docker.com/u/osct/repository/docker/osct/ftpd}
