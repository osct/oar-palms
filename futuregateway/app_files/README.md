# pilot_script.sh

This is the repository for the pilot script used by REPAST-PALMS FutureGateway application.
The script accepts different input parameters accordingly to the action to be performed as depicted below:

* Execution of REPAST PALMS using HTTP URLs for parameter and model files:
```
./pilot_script.sh submit <user_name> <model_http_url|model_DOI> <parameter_http_url|parameter_DOI> 
```

The script determines automatically if the given `<user_name>` has allocated an HTTPD/FTP server; if not, a new dedicated server will be instantiated.
The allocated HTTP/FTP server will be kept alive till a `release` command will be executed.
The HTTP/FTP server has a twofold scope, the FTP server is used to store computed files by REAPST PALMS executions. The HTTP server publishes these files giving the opportunity to download produced output files using http URLs. It is possible to use the `upload` command to send custom model or parameters file for further executions.
The `submit` command accepts both http URL or OAR DOI references as input. In case of DOIs, the endpoints will be first translated via HTTP accessible URLs.
DOI are translated using the Open Access Repository (OAR) available at: www.openaccessrepository.it.
The OAR server is configurable inside the `pilot_script.sh` code, by the variable `OAR` however it is necessary to verify that existing instructions to extract HTTP URLs from the given DOI number to the corresponding HTTP URL are still working correctly after changing the OAR server. To check the translation instructions see the function doi2url.

* To list files associated to the allocated resource
```
./pilot_script.sh list <user_name> 
```

This command list available files in the FTP/HTTPD server

* To release allocated resources
```
./pilot_script.sh release <user_name>
```

This command releases the HTTP/FTP server assigned to the given user. Once performed this operation, it will be not possible to get stored output files anymore.

* To delete or clear the HTTP/FTP content
```baah
./pilot_script.sh clear <user_name> [<file_1> <file_2> ...]
```

This command removes specified file names, if no files are given the whole FTP files will be removed

* To upload a file in the HTTP/FTP server
```bash
./pilot_scipt.sh upload <user_name> <file_1> [<file_2> ...]
```

This command offers the possibility to upload a given file in the user FTP/HTTPD, so that it will be possible to execute REPAST PALMS using custom models and/or parameters files.

## Execution example
Below an example of the `submit` execution:

```bash
$ ./pilot_script.sh submit testusr http://jobserver2.hopto.org/repast/PALMS/model.tar http://jobserver2.hopto.org/repast/PALMS/input/batch_params.xml_0
WARNING: The Docker Engine you're using is running in swarm mode.

Compose does not use swarm mode to deploy services to multiple nodes in a swarm. All containers will be scheduled on the current node.

To deploy your application across the swarm, use `docker stack deploy`.

Creating network "futuregateway_palms_network_testusr" with the default driver
Creating volume "futuregateway_palms_ftpdir_testusr" with default driver
Creating futuregateway_ftpd_testusr_1 ... 
Creating futuregateway_ftpd_testusr_1 ... done
**************** checkpoint 00 *****************
testusr BE896fGl ftp://ftpd_testusr/ http://jobserver2.hopto.org/repast/PALMS/model.tar http://jobserver2.hopto.org/repast/PALMS/input/batch_params.xml_0
**************** checkpoint 01 *****************
**************** checkpoint 1 *****************
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100 3544k  100 3544k    0     0  9469k      0 --:--:-- --:--:-- --:--:-- 9450k
**************** checkpoint 2 *****************
**************** checkpoint 3 *****************
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  2498  100  2498    0     0  38717      0 --:--:-- --:--:-- --:--:-- 39031
pa_model
/opt/repast/RepastTest2/MyModels/pa_model
log4j:WARN No appenders could be found for logger (org.java.plugin.boot.DefaultPluginsCollector).
log4j:WARN Please initialize the log4j system properly.
log4j:WARN See http://logging.apache.org/log4j/1.2/faq.html#noconfig for more info.
RepastInit.run()
BatchRunner.run()
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100 40960    0     0  100 40960      0  1476k --:--:-- --:--:-- --:--:-- 1481k
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100 40960  100 40960    0     0  19.5M      0 --:--:-- --:--:-- --:--:-- 19.5M
{
 "user": "testusr",
 "model": "http://jobserver2.hopto.org/repast/PALMS/model.tar",
 "params": "http://jobserver2.hopto.org/repast/PALMS/input/batch_params.xml_0",
 "container": {
   "port": "40000",
   "name": "testusr_40000_oarpalms",
   "id": "ecbeabf11796"},
 "output": {
   "ftp_user": "testusr",
   "ftp_pass": "BE896fGl",
   "file_name": "out_batch_params.xml_0.tar",
   "url": "http://fgsg.ct.infn.it:40000/testusr/out_batch_params.xml_0.tar"}
}
```

The script returns **always** zero as script return code, a json stream in its **standard output** and the file `output.tar` containing the output of PALMS execution. The json file contains several information about the `submit` action, most of them have only importance when reporting for support activities:

* The **port** number of an HTTP server, generated automatically by the script.
* The **ftp_pass** string, representing the ftp password used to store the PALMS output.

The `pilot_script.sh` executes a docker-compose file made by two nodes, one for the PALMS execution and the second to store produced output files generated by the computation. Such file is uploaded into the FTP server and in the same time it will be available for download through HTTTP, since the FTP content is published by and HTTPD daemon running in the second node. The first node terminates after the PALMS execution, while the second node will remain up and running in order to store or retrieve files generated by PALMS executions.

Calling again the script with a different parameter, a new file will be produced and stored in the FTP server. It is important that the name of the parameter file is different otherwise the existing output file will be replaces.

## Output retrieval from HTTPD

To retrieve the list of the user output files:

```bash
./pilot_script.sh list testusr | jq .
{
  "files": [
    {
      "file": "out_batch_params.xml_0.tar",
      "url": "http://fgsg.ct.infn.it:40000/testusr/out_batch_params.xml_0.tar"
    },
    {
      "file": "out_batch_params.xml_2.tar",
      "url": "http://fgsg.ct.infn.it:40000/testusr/out_batch_params.xml_2.tar"
    }
  ]
}
```

To retrieve one of the files, just execute:

```bash
curl -O http://fgsg.ct.infn.it:40000/testusr/out_batch_params.xml_2.tar
```

## Release resources

To release allocated resources to the user, execute:

```bash
./pilot_script.sh release testusr
```

Once the release action completes it will be not possible to retrieve output files anymore, since the allocated FTP/HTTPD server has been destroyed.

