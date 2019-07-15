#!/bin/bash
#
# Pilot script for OAR-REPAST PALMS using SSH EI
#
# Author: <riccardo.bruno@ct.infn.it>

HOST=fgsg.ct.infn.it

# Instantiate a docker-compose.yaml file starting from a template, using
# several environment variables as input
#
# Arguments:
#    <port> Port number assigned
#    <ftp_pass> For already created instances
instantiate_compose_template() {
  HTTPD_PORT=$1
  FTP_USER=$CUSER
  [ "$PORT" = "" ] &&\
    FTP_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1) ||\
    FTP_PASS=$2
  cp docker-compose.yaml_template docker-compose.yaml
  sed -i s/"<HTTPD_PORT>"/$HTTPD_PORT/ docker-compose.yaml
  sed -i s/"<FTP_USER>"/$CUSER/ docker-compose.yaml
  sed -i s/"<FTP_PASS>"/$FTP_PASS/ docker-compose.yaml
  sed -i s/"<USER>"/$CUSER/g docker-compose.yaml
}

# Execute a given PALMS execution
#
# Arguments:
#    <user> The user to associate the allocated HTTP for output
#    <model_http_url> HTTP based URL of the model file
#    <params_http_url> HTTP based URL of the parameters file
#    [port] The HTTP port number associated to the user
#
execute_PALMS() {

  # Check arguments: user 
  CUSER=$1
  [ "$CUSER" = "" ] &&\
    ERR_MSG="No username specified" &&\
    return 1

  REPAST_MODEL=$2
  MODEL_CHECK=0
  [ "$REPAST_MODEL" = "" ] &&\
    ERR_MSG="No model URL file given" &&\
    return 1
  
  REPAST_PARAMS=$3
  PARAMS_CHECK=0
  [ "$REPAST_PARAMS" = "" ] &&\
    ERR_MSG="No params URL file given" &&\
    return 1

  PORT=$4
  if [ "$PORT" = "" ]; then
    # This script uses container_manager scripts to allocate containers
    # and retrieve a given port
    ALLOWED_PALMS=$(request_containers oar_palms 1)
    [ $ALLOWED_PALMS -eq 0 ] &&\
      ERR_MSG="Unable to allocate a container for PALMS execution" &&\
      return 1
    HTTP_OUT_PORT=$(freeport)
    [ $HTTP_OUT_PORT -le 0 ] &&\
      ERR_MSG="Unable to find a suitable port for PALMS execution" &&\
      return 1
  else
    HTTP_OUT_PORT=$PORT
  fi

  # Customize template file to generate instance docker-compse.yaml file
  instantiate_compose_template $HTTP_OUT_PORT "$5"

  # Start the REPAST PALMS execution
  export HTTP_OUT_PORT
  docker-compose run --rm\
	             repast_$CUSER\
                          /opt/execute.sh $FTP_USER\
                                          $FTP_PASS\
                                          ftp://ftpd_$CUSER/\
                                          "$REPAST_MODEL"\
                                          "$REPAST_PARAMS" 
  # Build output file name
  REPAST_OUT=out_$(basename $REPAST_PARAMS).tar
  
  # Get FTP/HTTPD container Id
  HTTPD_CNT=$(docker ps -a | grep osct/ftpd | grep $HTTP_OUT_PORT | awk '{ print $1 }')

  # Get the list of output files
  FILE_URL=http://$HOST:${HTTP_OUT_PORT}/${FTP_USER}/${REPAST_OUT}

  # To recover ouptut files use:
  curl $FILE_URL > output.tar

  # Prepare successful execution output
  cat >$JSON_OUT <<EOF
{
 "user": "${CUSER}",
 "model": "${REPAST_MODEL}",
 "params": "${REPAST_PARAMS}",
 "container": {
   "port": "${HTTP_OUT_PORT}",
   "name": "${CUSER}_${HTTP_OUT_PORT}_oarpalms",
   "id": "${HTTPD_CNT}"},
 "output": {
   "ftp_user": "${CUSER}",
   "ftp_pass": "${FTP_PASS}",
   "file_name": "${REPAST_OUT}",
   "url": "${FILE_URL}"}
}
EOF
}

# Release resouces assigned to the user owning given HTTPD port number
#
# Arguments:
#    <user> The user to associate the allocated HTTP for output
release_PALMS() {
  # Check arguments: user 
  CUSER=$1
  [ "$CUSER" = "" ] &&\
    ERR_MSG="No username specified" &&\
    return 1

  # Customize template file to generate instance docker-compse.yaml file
  instantiate_compose_template 99999 

  # Release the allocated FTP server
  docker-compose down -v &&\
  OUT_MSG="Container resources removed successfully" ||
  ERR_MSG="Error removing container resources: '"$(cat docker-compose.yaml)"'"

  cat >$JSON_OUT <<EOF
{
 "user": "${CUSER}",
 "message": "${OUT_MSG}${ERR_MSG}"
}
EOF
}

# List files available in the given HTTPD port number
#
# Arguments:
#    <user>: Username associated to the HTTPD server
#    <port>: HTTPD port number of the HTTPD server
list_PALMS() {

  CUSER=$1
  [ "$CUSER" = "" ] &&\
    ERR_MSG="No username specified" &&\
    return 1
  
  PORT=$2
  [ "$PORT" = "" ] &&\
    ERR_MSG="No port specified" &&\
    return 1
  
  # Retrieve file list
  FILES_LIST=$(curl -s http://$HOST:$PORT/$CUSER/ | grep href | grep '.tar' | awk -F'=' '{ print $2 }'| awk -F'<' '{ print $1 }' | awk -F'>' '{ print $1 }' | xargs -I{} echo {})
  i=0
  printf "{\"files\": ["
  for f in $FILES_LIST; do
	  FILE_URL=$(curl -s http://$HOST:$PORT/$CUSER/ | grep href | grep '.tar' | grep $f | awk -F'=' '{ print $2 }'| awk -F'<' '{ print $1 }' | awk -F'>' -v host=$HOST -v port=$PORT -v user=$CUSER '{ printf("http://%s:%s/%s/%s", host, port, user, $2) }' | xargs -I{} echo "{}"|xargs echo)
    [ $i -eq 0 ] &&\
      SEP="" ||\
      SEP=", "
    printf "%s{\"file\": \"$f\",\"url\": \"$FILE_URL\"}" $SEP
     i=$((i+1))
  done
  printf "]}"
}

#
# Main code
#
# This script takes as arguments the following values:
#
# - submit <user> <model_http_url> <params_http_url>
#
#   In this case a new PALMS environment will be allocated for the given 
#   user if it does not exists yet and the given couple (model, params) will
#   be executed. The output will be available through the HTTP server.
#   The script returns as output a json containing information to retrieve and
#   eventually release the allocate resource.
#
# - release <HTTP_PORT>
#
#   In this case the allocated resource will be released, since this operation
#   any output generated by this resource will be no longer available.
#

# Error message variable
ERR_MSG=""

# This script returns a JSON stream in standard ouput, this will be kept inside
# a temporary file
JSON_OUT=$(mktemp)

# Command must exist and it can be only submit or release
CMD=$1
[ "$1" = "" ] &&\
  ERR_MSG="No command provided: <submit|release>"

# Process given command
case $CMD in

  # Process 'submit' command
  "submit") 
    execute_PALMS ${@:2}
    ;;

  # Process 'release' command
  "release")
    release_PALMS ${@:2}
    ;;

  # List available files
  "list")
    list_PALMS ${@:2}
    ;;

  # Notify unknown/unsupported commands
  *)
    ERR_MSG="Unable to process given command: '"$CMD"'"
    ;;
esac

# Successful or failed output
if [ "$ERR_MSG" != "" ]; then
  echo $ERR_MSG >&2 &&\
  cat >$JSON_OUT <<EOF
{"error": "${ERR_MSG}"}
EOF
fi

# Show the output
cat $JSON_OUT
