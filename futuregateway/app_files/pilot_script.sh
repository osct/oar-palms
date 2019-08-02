#!/bin/bash
#
# Pilot script for OAR-REPAST PALMS using SSH EI
#
# Author: <riccardo.bruno@ct.infn.it>

HOST=fgsg.ct.infn.it
DOI=https://doi.org
OAR=https://www.openaccessrepository.org

# Instantiate a docker-compose.yaml file starting from a template, using
# several environment variables as input
#
# Arguments:
#    <port> Port number assigned
#    <ftp_pass> For already created instances
instantiate_compose_template() {
  HTTPD_PORT=$1
  FTP_USER=$CUSER
  [ "$2" = "" ] &&\
    FTP_PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1) ||\
    FTP_PASS=$2
  cp docker-compose.yaml_template docker-compose.yaml
  sed -i s/"<HTTPD_PORT>"/$HTTPD_PORT/ docker-compose.yaml
  sed -i s/"<FTP_USER>"/$CUSER/ docker-compose.yaml
  sed -i s/"<FTP_PASS>"/$FTP_PASS/ docker-compose.yaml
  sed -i s/"<USER>"/$CUSER/g docker-compose.yaml
}

# Automatically determine if the given user has an active HTTP/FTP port assigned
#
# Arguments:
#.  [<user>] The username if variable $CUSER is not set
locate_user_resources() {
  [ "$CUSER" = "" ] &&\
    CUSER=$(echo $1)
  [ "$CUSER" = "" ] &&\
    PORT="" &&\
    return 1

  HTTPDFTP_CNT=$(docker ps -a | grep osct/ftpd | grep $CUSER | awk '{ print $1 }')
  [ "$HTTPDFTP_CNT" != "" ] &&\
    PORT=$(docker inspect $HTTPDFTP_CNT | jq .[0].NetworkSettings.Ports | jq '."80/tcp"[0].HostPort' | xargs echo) ||\
    PORT=""

  [ "$PORT" = "" -o "$PORT" = "null" ] &&\
    return 1

  return 0
}

# Tranlsate a given DOI number into its referenced URL address
#
# Arguments:
#    <DOI number> DOI number, if altrady an URL it will be ignored
#    <DOI type> DOI type tells if it is a parameter or a model DOI
doi2url() {
  INPDOI=$(echo $1)
  DOITYPE=$(echo $2)
  ISURL=$(echo $INPDOI | sed 's/^http.*/URL/')
  # Skip URLs
  [ "$ISURL" == "URL" ] &&\
    return 0
  # Model or Parameters case
  if [ "$DOITYPE" = "model" ]; then
    DOI_MODEL=$INPDOI
    REPAST_MODEL=$(curl -sL $DOI/$INPDOI |\
                   grep model.tar |\
                   grep "href=\"http" |\
                   awk -F'"' '{ print $6 }')
  elif [ "$DOITYPE" = "parameters" ]; then
    DOI_PARAMETERS=$INPDOI
    REPAST_PARAMS=$(curl -sL $DOI/$INPDOI |\
                    grep xml |\
                    grep "href=\"http" |\
                    awk -F'"' '{ print $6 }')
    PARAMS_NAME=$(curl -sL $DOI/$INPDOI |\
                  grep "<h1>" |\
                  awk -F'>' '{ print $2}' |\
                  awk -F'<' '{ print tolower($1) }')
  else
    echo "Unknown DOI type argument: '"$DOITYPE"'" >&2
  fi
  DOI_OUTPUT=$(printf ",\n \"doi\": {\n   \"model\": \"$DOI_MODEL\",\n   \"parameters\": \"$DOI_PARAMETERS\" }")
}

# Execute a given PALMS execution
#
# Arguments:
#    <user> The user to associate the allocated HTTP for output
#    <model_http_url> HTTP based URL of the model file
#    <params_http_url> HTTP based URL of the parameters file
#
execute_PALMS() {

  # Check arguments: user 
  CUSER=$(echo $1)
  [ "$CUSER" = "" ] &&\
    ERR_MSG="No username specified" &&\
    return 1

  REPAST_MODEL=$(echo $2)
  MODEL_CHECK=0
  [ "$REPAST_MODEL" = "" ] &&\
    ERR_MSG="No model URL file given" &&\
    return 1
  doi2url $REPAST_MODEL "model"
  
  REPAST_PARAMS=$(echo $3)
  PARAMS_CHECK=0
  [ "$REPAST_PARAMS" = "" ] &&\
    ERR_MSG="No params URL file given" &&\
    return 1
  doi2url $REPAST_PARAMS "parameters"

  # Automatically determine if the given user has an active HTTP/FTP port assigned
  locate_user_resources

  if [ $? -ne 0 ]; then
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
    FTP_PASS=""
  else
    HTTP_OUT_PORT=$PORT
    FTP_PASS=$(docker exec $HTTPDFTP_CNT env | grep UDnWQOFx | awk -F'|' '{ print $2 }')
  fi

  # Customize template file to generate instance docker-compse.yaml file
  instantiate_compose_template $HTTP_OUT_PORT $FTP_PASS 

  # Start the REPAST PALMS execution
  export HTTP_OUT_PORT
  export COMPOSE_PROJECT_NAME=palms_$CUSER
  docker-compose run --rm\
	             repast_$CUSER\
                          /opt/execute.sh $FTP_USER\
                                          $FTP_PASS\
                                          ftp://ftpd_$CUSER/\
                                          "$REPAST_MODEL"\
                                          "$REPAST_PARAMS" > docker.out 2>docker.err
  # Store container execution into the error file
  echo "Docker run (begin)" >&2
  echo "[output]" >&2
  cat docker.out >&2
  echo "[error]" >&2
  cat docker.err >&2
  echo "Docker run (end)" >&2
  rm -f docker.out docker.err
  # Build output file name
  REPAST_OUT=out_$(basename $REPAST_PARAMS).tar
  
  # Get FTP/HTTPD container Id
  HTTPD_CNT=$(docker ps -a | grep osct/ftpd | grep $HTTP_OUT_PORT | awk '{ print $1 }')

  # Get the list of output files
  FILE_URL=http://$HOST:${HTTP_OUT_PORT}/${FTP_USER}/${REPAST_OUT}

  # To recover ouptut files use:
  curl -s $FILE_URL > output.tar

  # In case of DOIs, output file may have a different name
  [ "$PARAMS_NAME" != "" ] &&\
    docker exec $HTTPD_CNT rm -f /ftp/$CUSER/$REPAST_OUT &&\
    REPAST_OUT="$PARAMS_NAME.tar" &&\
    cp output.tar $REPAST_OUT &&\
    FILE_URL=http://$HOST:${HTTP_OUT_PORT}/${FTP_USER}/${REPAST_OUT} &&\
    docker cp $REPAST_OUT $HTTPD_CNT:/ftp/$CUSER/$REPAST_OUT &&\
    rm -f $REPAST_OUT

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
   "url": "${FILE_URL}"}${DOI_OUTPUT}
}
EOF
}

# Release resouces assigned to the user owning given HTTPD port number
#
# Arguments:
#    <user> The user to associate the allocated HTTP for output
release_PALMS() {
  # Check arguments: user 
  CUSER=$(echo $1)
  [ "$CUSER" = "" ] &&\
    ERR_MSG="No username specified" &&\
    return 1

  # Automatically determine if the given user has an active HTTP/FTP port assigned
  locate_user_resources

  [ $? -ne 0 ] &&\
    ERR_MSG="No port exists for user $CUSER" &&\
    return 1

  # Customize template file to generate instance docker-compse.yaml file
  instantiate_compose_template $PORT

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
#
list_PALMS() {

  CUSER=$(echo $1)
  [ "$CUSER" = "" ] &&\
    ERR_MSG="No username specified" &&\
    return 1
  
  # Automatically determine if the given user has an active HTTP/FTP port assigned
  locate_user_resources

  [ $? -ne 0 ] &&\
    ERR_MSG="No port exists for user $CUSER" &&\
    return 1
  
  # Retrieve file list
  FILES_LIST=$(curl -s http://$HOST:$PORT/$CUSER/ | grep href | grep '.tar' | awk -F'=' '{ print $2 }'| awk -F'<' '{ print $1 }' | awk -F'>' '{ print $1 }' | xargs -I{} echo {})
  i=0
  printf "{\"files\": ["
  for f in $FILES_LIST; do
	  FILE_URL=$(curl -s http://$HOST:$PORT/$CUSER/ |\
                     grep href |\
                     grep '.tar' |\
                     grep $f |\
                     awk -F'=' '{ print $2 }' |\
                     awk -F'<' '{ print $1 }' |\
                     awk -F'>' -v host=$HOST\
                               -v port=$PORT\
                               -v user=$CUSER\
                              '{ printf("http://%s:%s/%s/%s", host, port, user, $2) }' |\
                     xargs -I{} echo "{}"|\
		     xargs echo)
    [ $i -eq 0 ] &&\
      SEP="" ||\
      SEP=", "
    printf "%s{\"file\": \"$f\",\"url\": \"$FILE_URL\"}" $SEP
     i=$((i+1))
  done
  printf "]}"
}

# Clear files stored in HTTPD/FTP server
#
# Arguments:
#    <user>: Username associated to the HTTPD server
#    [files]: List of files to remove
#
clear_PALMS() {

  CUSER=$(echo $1)
  [ "$CUSER" = "" ] &&\
    ERR_MSG="No username specified" &&\
    return 1

  # Automatically determine if the given user has an active HTTP/FTP port assigned
  locate_user_resources

  [ $? -ne 0 ] &&\
    ERR_MSG="No port exists for user $CUSER" &&\
    return 1
      
  shift 2
  FILES=$@

  RMFILES=$(docker exec $HTTPD_CNT /bin/ls -1 /ftp/$CUSER)
  RMFILES_LIST=""
  for f in $RMFILES; do
    if [ "$FILES" = "" ]; then
      docker exec $HTTPD_CNT rm -f /ftp/$CUSER/$f
      [ -z $RMFILES_LIST ] &&\
        RMFILES_LIST=$f ||\
	RMFILES_LIST="$RMFILES_LIST, $f"

    else
      if [ $(echo $FILES | grep $f | wc -l) -ne 0 ]; then 
        docker exec $HTTPD_CNT rm -f /ftp/$CUSER/$f &&\
        [ -z $RMFILES_LIST ] &&\
	  RMFILES_LIST=$f ||\
	  RMFILES_LIST="$RMFILES_LIST, $f"
      fi
    fi
  done

  [ -z $RMFILES_LIST ] &&
    RMMSG="No files removed" ||\
    RMMSG="Output files: $RMFILES_LIST for user $CUSER have been deleted"
  cat >$JSON_OUT <<EOF
{
 "user": "${CUSER}",
 "container": "${HTTPD_CNT}",
 "message": "${RMMSG}"
}
EOF
}

# Upload a given list of files into the HTTPD/FTP server
#
# Arguments:
#    <user>: Username associated to the HTTPD server
#    <file_1>: File to upload
#    [<file_n>]: Other files
#
upload_PALMS() {

  CUSER=$(echo $1)
  [ "$CUSER" = "" ] &&\
    ERR_MSG="No username specified" &&\
    return 1

  # Automatically determine if the given user has an active HTTP/FTP port assigned
  locate_user_resources

  [ $? -ne 0 ] &&\
    ERR_MSG="No port exists for user $CUSER" &&\
    return 1
        
  shift 1
  FILES=$@

  UPFILES_LIST=""
  for f in $FILES; do
    docker cp $f $HTTPDFTP_CNT:/ftp/$CUSER/$f &&\
    [ -z $UPFILES_LIST ] &&\
          UPFILES_LIST=$f ||\
          UPFILES_LIST="$UPFILES_LIST, $f"
  done

  [ -z $UPFILES_LIST ] &&
    UPMSG="No files removed" ||\
    UPMSG="Uploaded files: $UPFILES_LIST for user $CUSER have been uploaded successfully"
  cat >$JSON_OUT <<EOF
{
 "user": "${CUSER}",
 "container": "${HTTPDFTP_CNT}",
 "message": "${UPMSG}"
}
EOF
}

#
# Main code
#
# This script takes as arguments the following values:
#
# - submit <user> <model_http_url|model_DOI> <params_http_url|params_DOI>
#
#   In this case a new PALMS environment will be allocated for the given 
#   user if it does not exists yet and the given couple (model, params) will
#   be executed. The output will be available through a HTTP server.
#   The script returns as output a json containing information to retrieve and
#   eventually release the allocated resource.
#   Submit command may accept http url or OAR DOI numbers.
#
# - release <user>
#
#   In this case the allocated HTTP/FTP resource will be released, since this 
#   operation any output generated by this resource will be no longer available.
#
# - list <user>
#
#   Show files in allocated HTTP/FTP resource
#
# - clear <user> [files]
#
#   Remove files in allocate HTTP/FTP resource if no file list is given, all
#   files will be removed
#
# - upload <user> <file_1> [<file_2> ...]
#
#   Upload a given list of files in the FTP server
#

# Error message variable
ERR_MSG=""

# This script returns a JSON stream in standard ouput, this will be kept inside
# a temporary file
JSON_OUT=$(mktemp)

# Command must exist and it can be only submit or release
CMD=$(echo $1)
[ "$1" = "" ] &&\
  ERR_MSG="No command provided: <submit|release>"

# Process given command
case $CMD in

  # Process 'submit' command
  "submit")
    DOI_OUTPUT=""
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

  # Clear all files in ftp server
  "clear")
    clear_PALMS ${@:2}
    ;;

  # Upload a given list of files in ftp server
  "upload")
    upload_PALMS ${@:2}
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

