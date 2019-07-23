#!/bin/bash
#
# commons.sh 
#
# Common functions used by setup scripts
#

# Timestamp
get_ts() {
  TS=$(date +%y%m%d%H%M%S)
}

# Output function notify messages
# Arguments: $1 - Message to print
#            $2 - No new line if not zero
#            $3 - No timestamp if not zero
# if LOG_OUTFILE set, also print output to 
# the file
out() {
  # Get timestamp in TS variable  
  get_ts

  # Prepare output flags
  OUTCMD=echo
  MESSAGE="$1"
  NONEWLINE="$2"
  NOTIMESTAMP="$3" 
  if [ "$NONEWLINE" != "" -a $((1*NONEWLINE)) -ne 0 ]; then
    OUTCMD=printf
  fi
  if [ "$3" != "" -a $((1*NOTIMESTAMP)) -ne 0 ]; then
    TS=""
  fi
  OUTMSG=$(echo $TS" "$MESSAGE)
  $OUTCMD "$OUTMSG" >&1
  if [ "$LOG_OUTFILE" != "" ]; then
    $OUTCMD "$OUTMSG" >> $LOG_OUTFILE
  fi  
}

# Error function notify about errors
err() {
  get_ts
  echo $TS" "$1 >&2 
  if [ "$FGLOG" != "" ]; then
    echo $TS" "$1 >> $FGLOG
  fi
}

# Show output and error files
outf() {
  OUTF=$1
  ERRF=$2
  if [ "$OUTF" != "" -a -f "$OUTF" ]; then
    while read out_line; do
      out "$out_line"
    done < $OUTF
  fi
  if [ "$ERRF" != "" -a -f "$ERRF" ]; then
    while read err_line; do
      err "$err_line"
    done < $ERRF
  fi
}

TMPFILES=()
cleanup() {
  VERBOSE=0
  [ $VERBOSE -ne 0 ] && echo "Cleaning up:"
  RMFILES=(${TMPFILES[@]})
  for f in ${TMPFILES[@]}; do
    [ $VERBOSE -ne 0 ] && printf "  $f"
    rm -f $f && RMFILES=(${RMFILES[@]/$f})
  done
  [ $VERBOSE -ne 0 ] && echo ""
  [ $VERBOSE -ne 0 ] && echo "Done"
  TMPFILES=(${RMFILES[@]})
}
trap cleanup EXIT

mktmp() {
  RES=$(mktemp) &&\
  [ "$RES" != "" ] &&\
  TMPFILES+=("$RES") &&\
  return 0 ||\
  return 1
}

debugging() {
  [ $((DEBUG*1)) -ne 0 ] && return 0
  return 1
}
