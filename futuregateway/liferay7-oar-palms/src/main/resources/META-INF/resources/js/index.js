/*****************************************************************************
 * Copyright (c) 2011:
 * Istituto Nazionale di Fisica Nucleare (INFN), Italy
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * @author <a href="mailto:riccardo.bruno@ct.infn.it">Riccardo Bruno</a>(INFN)
 *****************************************************************************/
import $ from 'jquery';

var application_name = 'oar-palms';
var application_id = 8;

// This variable keeps information related do the user FTP server
ftp_server = {
  status: false,
  user: '',
  password: '',
  file: '',
  url: '',
  httpd_port: -1,
  httpd_name: '',
  httpd_id: -1,

  reset: function() {
    this.status = false;
    this.user = '';
    this.password = '';
    this.file = '';
    this.url = '';
    this.httpd_port = -1;
    this.httpd_name = '';
    this.httpd_id = -1;
  },
  is_ftp_running: function() {
    this.status = this.user.length > 0 &&
                  this.password.length > 0 &&
                  this.httpd_port > 0 &&
                  this.httpd_name.length > 0 &&
                  this.httpd_id > 0;
    return this.status;
  }
};

// This variable keeps information about the PALMS epxeriment
palms_info = {
  app_state: 'unknown',
  output_doi: '',
  model_doi: '',
  params_doi: '',
  model_url: '',
  params_url: '',

  reset: function() {
    this.app_state = 'unknown';
    this.output_doi = '';
    this.model_doi = '';
    this.params_doi = '';
    this.model_url = '';
    this.params_url = '';
  },
  can_execute: function() {
    return this.model_url.length > 0 &&
           this.params_url.length > 0;
  },
  set_state: function(app_state) {
    this.app_state = app_state;
  },
  is_ready: function() {
    return this.app_state == 'ready';
  }
};

// Welcome text introduces the application to the user
var welcomeText =
  "<h1>OAR-PALMS</h1>" + 
  "<p>This application executes REPAST PALMS simulations in conjunction with " +
  "the <a href=\"https://www.openaccessrepository.it/search?q=palms\"" +
  "target=\"_blank\">Open Access Repository</a></p>" +
  "<p>This application can be also used to run existing models and parameters " +
  "or execute customised simulations uploading models and/or parameters files.</p>";

// Function providing application page structure
function build_page() {
  // Below the structure of the page containing elemennts:
  //   * User info
  //   * Application info
  //   * Task info ans its output
  var html =
    "<div class=\"" + application_name + "\">" +
    "  <p>" + welcomeText + "</p>" +
    "  <div class=\"error\"></div>" +
    "  <div class=\"user_info\"></div>" +
    "  <div class=\"app_info\"></div>" +
    "  <div class=\"task_info\"></div>" +
    "  <div class=\"gui\"></div>" +
    "  <div class=\"ftp\"></div>" +
    "</div>";
  if(themeDisplay.isSignedIn() && fg_user_info.user_group == "true") {
      // init call may report errors to be notified
      if(fg_user_info.err_message.length>0) {
          message = "Unable to retrieve information for user: '" +
                    fg_user_info.name + "'; error: '" +
                    fg_user_info.err_message;
          report_error(message, user_support);
      } else {
          // Performs a cascading check on user, app and task adding
          // dynamically elements into the div areas of the web page
          // accordingly to the results of the FG API calls performed
          check_user_app_tasks();
      }
  } else {
    mail_subject = "User support for application: " + application_name;
    mail_body = "I would like to be contacted in order to get access or " +
                "receive more information about the application: '" + application_name +
                "'.\nMany thanks,\nRegards\n" + "<your name>";
    err_message = "<strong>Warning!</strong> You have to sign-in to access this service.";
    if(themeDisplay.isSignedIn()) {
        err_message = "<strong>Warning!</strong> Your user does not belong to the FutureGateway' group " +
          "associated to this application.";
    }
    // Notify that this service is available only for logged users
    html = "<div class=\"alert alert-danger\" role=\"alert\">" +
           "  <button type=\"button\"" +
           "          class=\"close\"" +
           "          data-dismiss=\"alert\">&times;</button>" +
           err_message +
           "</div>" +
           "<div class=\"disclaimer\">" + 
           "<p>Please contact the <a href=\"" + user_support +
           "?subject=" + mail_subject + "&body=" + mail_body + 
           "\">user support</a> to get information and instructions " +
           "about the access to this application." +
           "</p></div>";
  }
  return html;
}

// Report an error message to the interface
function report_error(message, support_url) {
  mail_subject = "User support for application: " + application_name;
  mail_body = "Reported error: '" + message + "'";
  $('.error').append(
    "<div class=\"alert alert-danger\" role=\"alert\">" +
    "<p><strong>Error:</strong> " + message + "</br>" +
    "You can notify this problem, by clicking <a href=\"" +
    support_url + "?subject=" + mail_subject + "&body=" + mail_body +
    "\">here</a>." + 
    "</p></div>"
  );
}

// Remove any element in the given div area
function reset_area(area) {
    $("." + area).empty();
}

// Reset submission form
//function reset_form() {
//    $("#model").val(default_model_url);
//    $("#parameters").val(default_parameters_url);
//}

// Success case for do_task 
var do_task_done = function(data) {
    // Notify success action
    alert("New " + application_name + " task has been successfully created");
    // Rebuild task table after successful submission
    check_tasks(application_name);
}

// Error case for do_task 
var do_task_error = function(jqXHR, exception) {
    alert("Error creating new task");
}

// Generic task submission call DELETE/SUBMIT
function do_task(model, parameters) {
    // Execute Submit POST command
    url = fg_api_settings.base_url + '/' +
          fg_api_settings.version  +'/tasks';
    taskData = {
        "application": application_id,
        "description": application_name + " fgsg",
        "arguments": [model, parameters ],
        //"output_files": [{"name": "repast.json"}],
        "output_files": [],
    };
    doPost(url, taskData, do_task_done, do_task_error);
}

// Perform application submission
function do_submit() {
    $("#submit_button").prop('disabled','true');
    model = $("#model").val()
    parameters = $("#parameters").val()
    do_task(model, parameters);
    $("#submit_button").removeAttr("disabled");
}
 
// Confirm submission action
function confirm_dialog(message, action) {
    if(confirm(message)) {
        action();
    } else {
        console.log("Execution cancelled");
    }
}

function exec_application() {
   confirm_dialog("Are you sure to submit " + application_name + "?", do_submit); 
}

// Create the application submission form
// function build_submission_form() {
//     reset_area("submission_form");
//     $(".submission_form").append(
//       "<div><table>" +
//       "<tr><td><label for=\"model\">Model:</label></td><td></td>" +
//       "<td><input id=\"model\" type=\"text\" id=\"model\" name=\"model\" size=\"100%\"></td><td></td></tr>" +
//       "<tr><td><label for=\"parameters\">Parameters:</label></td><td></td>" +
//       "<td><input id=\"parameters\" type=\"text\" id=\"parameters\" name=\"parameters\" size=\"100%\"></td><td></td></tr>" +
//       "<tr><td><button type=\"submit\" " +
//       "        class=\"btn btn-success\" " +
//       "        id=\"submit_button\" " +
//       ">Execute</button></td><td></td>" +
//       "<td><button class=\"btn btn-danger\" " +
//       "        id=\"reset_button\" " +
//       ">Reset</button></td><td></td></tr>" +
//       "</table>" +
//       "</div>"
//     );
//     reset_form();
//     $("#submit_button").on("click",exec_application);
//     $("#reset_button").on("click",reset_form);
// }

// Extract value from runtime-data vector 
// function get_runtime_value(runtime_data, data_field) {
//     var runtime_value = "<unknown>";
//     for(var i=0; i<runtime_data.length; i++) {
//         if(runtime_data[i].name == data_field) {
//             runtime_value = runtime_data[i].value;
//       break;
//   }
//     }
//     return runtime_value;
// }

// Success trash_task
// var trash_task_done = function() {
//     alert("Task successfully removed");
//     check_tasks(application_name);
// }

// Error trash_task
// var trash_task_error = function() {
//     alert("Sorry, unable to delete task");
// }

// // Trash the selected task
// var trash_task = function() {
//     task_id = this.trash_task_id;
//     table_row = this.trash_task_row;
//     url = fg_api_settings.base_url + '/' +
//           fg_api_settings.version  +'/tasks/' + task_id;
//     doDelete(url, trash_task_done, trash_task_error);
//}

// Task record action
// var do_action_button = function() {
//     //alert("ID: '" + this.id + "' Action: '" + this.name + "'");
//     trash_table_row = this.id.split('_')[1]; // i-th element of task table
//     trash_task_id = this.id.split('_')[2]; // FG task_id
//     if(this.name == 'trash') {
//       confirm_dialog("Are you sure to remove the task?", trash_task);
//     } else if(this.name == 'refresh') {
//       check_tasks(application_name);
//     } else {
//       alert("Unhespected task action: '" + this.name + "'");
//     }
//}

// Refresh whole task list
// var refresh_tasks = function() {
//     check_tasks(application_name);
// }

// Build the tasks table from passed task_info values
// function build_tasks_table(task_data) {
//     var table_rows="";
//     for(var i=0; i<task_data.length; i++) {
//         var status = task_data[i].status;
//         var task_id = task_data[i].id;
//         var creation = task_data[i].creation;
//         var model = task_data[i].arguments[0];
//         var parameters = task_data[i].arguments[1];
//         var action_button = "";
//   if(status == "DONE") {
//             status = "<span class=\"badge badge-pill badge-success\">DONE</span>";
//             action_button =
//                 "<button name=\"trash\" id=\"task_" + i + "_" + task_id + "\">" +
//                 "<span class=\"glyphicon glyphicon glyphicon glyphicon-trash\" aria-hidden=\"true\"></span>" +
//                 "</button>";
//   } else if(status == "ABORTED") {
//             status = "<span class=\"badge badge-pill badge-danger\">ABORT</span>";
//              action_button =
//                 "<button name=\"trash\" id=\"task_" + i + "_" + task_id + "\">" +
//                 "<span class=\"glyphicon glyphicon glyphicon glyphicon-trash\" aria-hidden=\"true\"></span>" +
//                 "</button>";
//   } else if(status == "RUNNING") {
//             status = "<span class=\"badge badge-pill badge-primary\">RUNNING</span>";
//             action_button = 
//                 "<button name=\"refresh\" id=\"task_" + i + "_" + task_id + "\">" +
//     "<span class=\"glyphicon glyphicon glyphicon-refresh\" aria-hidden=\"true\"></span>" +
//     "</button>";
//   } else {
//             status = "<span class=\"badge badge-pill badge-warning\">" + status  + "</span>";
//             action_button = 
//                 "<button name=\"refresh\" id=\"task_" + i + "_" + task_id + "\">" +
//                 "<span class=\"glyphicon glyphicon glyphicon-refresh\" aria-hidden=\"true\"></span>" +
//                 "</button>";
//   }
//         table_rows += 
//             "<tr>" +
//             "<td>" + action_button + "</td>" +
//             "<td>" + creation + "</td>" + 
//             "<td>" + status + "</td>" +
//             "<td>" + model + "</td>" +
//             "<td>" + parameters + "</td>" +
//             "</tr>";
//     }
//     // Fill table if task records exist
//     if(table_rows.length > 0) {
//       $(".task_info").append(
//         "    <table id=\"task_table_title\">" +
//         "    <tr><td>" +
//         "        <button id=\"refresh_tasks\">" +
//  "        <span class=\"glyphicon glyphicon glyphicon-refresh\" aria-hidden=\"true\"></span>" +
//  "        </button></td>" +
//  "        <td><h4>Executions</h4></td></tr>" +
//         "    </table>" +
//         "    <table id=\"task_table\" class=\"table\"></table>");
//       $("#refresh_tasks").on("click",refresh_tasks);
//       $('#task_table').append(
//         "<tr>" + 
//  "<th>Action</th>" + 
//  "<th>Date</th>" +
//  "<th>Status</th>" +
//  "<th>Model</th>" +
//  "<th>Parameters</th>" +
//  "</tr>");
//       $('#task_table').append(table_rows);
//       // Assign right function call to generated refresh buttons
//       for(var i=0; i<task_data.length; i++) {
//           var task_id = task_data[i].id;
//           $("#task_" + i + "_" + task_id).on("click",do_action_button);
//       }
//     } else {
//       // Report no records are available yet
//       $('.task_info').append(
//           "<div class=\"alert alert-info\" role=\"alert\">No tasks avaiable yet for this application</div>"
//       );
//     }
// }

// Set spinning button if argument is true otherwise set the normal button
// This function also enable/disable the submit button
var set_spin_button = function(spinning) {
  var normal_solve_btn = "<button id=\"btn_solve_doi\" class=\"btn btn-primary\" type=\"button\">Prepare</button>";
  var spinning_solve_btn = "<button id=\"btn_solve_doi\" class=\"btn btn-primary\" type=\"button\" disabled>" +
                           "<span class=\"spinner-border spinner-border-sm\" role=\"status\" aria-hidden=\"true\"></span>" +
                           "Solving ...</button>";
  $('.doi_spin_button').empty();
  if(spinning) {
    $('.doi_spin_button').append(spinning_solve_btn);
    $('#btn_execute').prop('disabled', true);
  } else {
    $('.doi_spin_button').append(normal_solve_btn);
    $('#btn_execute').prop('disabled', false);
  }
}


// Resolve an output DOI registered in OAR extracting model and parameter file DOIs
var solve_output_doi = function() {
  set_spin_button(true);
  var output_doi = $('#output_doi_input').val();
  DOI_Output.reset();
  DOI_Output.model_input = 'palms_model';
  DOI_Output.params_input = 'palms_parameters';
  DOI_Output.doi_extract(output_doi);
}



// Function that builds the GUI accordingly to the application
// logic status
var build_gui = function() {
  var output_doi_gui =
    "<h4>Reproducibility</h4>" +
    "<p>This section gives the opportunity to reproduce PALMS results as they are registered in " +
    "<a href=\"https://www.openaccessrepository.it/search?q=palms%20Output\">OpenAccessRepository</a> " +
    "by placing its DOI reference in the OUTPUT DOI input field.</p>" +
    "<p>Once pressing the <strong>Prepare</strong> button, the related model and experiment files " +
    "will be automatically extracted and place in the submitssion form.</p>" +
    "<form>" +
    "  <div class=\"form-group\">" +
    "    <label for=\"palms_exec_doi\">Output DOI</label>" +
    "    <input type=\"text\"" +
    "           class=\"form-control\"" +
    "           name=\"output_doi_input\"" +
    "           id=\"output_doi_input\"" +
    "           aria-describedby=\"help_doi\"" +
    "           placeholder=\"PALMS output DOI\">" +
    "    <small id=\"help_mod\" class=\"form-text text-muted\">Place Ouptut DOI reference (10.15161/oar.it/23504)</small>" +
    "  </div>" +
    "</form>" +
    "<div class=\"doi_spin_button\" id=\"doi_spin_button\">" +
    "</div>";
  var exec_palms_gui =
    "<h4>PALMS Execution</h4>" +
    "<form>" +
    "  <div class=\"form-group\">" +
    "    <label for=\"palms_exec_model\">Model</label>" +
    "    <input type=\"text\"" +
    "           class=\"form-control\"" +
    "           name=\"palms_model\"" +
    "           id=\"palms_model\"" +
    "           aria-describedby=\"help_model\"" +
    "           placeholder=\"PALMS model\">" +
    "    <small id=\"help_mod\" class=\"form-text text-muted\">PALMS model archive file as OAR' DOI or http URL format</small>" +
    "  </div>" +
    "  <div class=\"form-group\">" +
    "    <label for=\"palms_exec_params\">Parameters</label>" +
    "    <input type=\"text\"" +
    "           class=\"form-control\"" +
    "           name=\"palms_parameters\"" +
    "           id=\"palms_parameters\"" +
    "           placeholder=\"PALMS parameters file as OAR' DOI or http URL format\">" +
    "    <small id=\"help_mod\" class=\"form-text text-muted\">Place Ouptut DOI reference</small>" +
    "  </div>" +
    "</form>" +
    "<button id=\"btn_execute\" class=\"btn btn-primary\">Execute</button>";
  var ftp_gui = "<h4>PALMS files</h4>";

  if(palms_info.is_ready()) {
    $('.gui').append(
      "<div id=\"output_doi\">" + output_doi_gui + "</div>" +
      "<div id=\"exec_palms\">" + exec_palms_gui + "</div>");
    set_spin_button(false);
    $("#btn_solve_doi").on("click", solve_output_doi);
    $("#btn_execute").on("click", refresh_page);
  }
  if(ftp_server.is_ftp_running()) {
    $('.ftp').append(
      "<div id=\"ftp_gui\">" + ftp_gui + "</div>");
  } else {
    $('.ftp').append(
      "<br/><div class=\"alert alert-warning alert-dismissible show\" role=\"alert\">" +
      "<strong>Information</strong> PALMS output files are not yet available." +
      "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
      "<span aria-hidden=\"true\">&times;</span>" +
      "</button>" +
      "</div>");
  }
}

// Success case for proc_task_output
var proc_task_output = function() {
  if(data['error'] != null) {
        $('.task_info').append(
            "<p>The resource reservation process was not successful. " +
            "The error message is: '" + data['error'] + "'. " +
            "Pressing the following button, you can retry the submission" +
            "<div class=\"submit\"><button type=\"button\"" +
            "        id=\"submit_button\"" +
            "        class=\"btn btn-danger\"" +
            ">RETRY</button>" +
            "</div></p>");
        //$("#submit_button").on("click", submitTask);
    return;
  } 

  // Example of output.txt file:
  // {
  //  "user": "brunor",
  //  "model": "https://www.openaccessrepository.it/record/23467/files/model.tar",
  //  "params": "https://www.openaccessrepository.it/record/23473/files/batch_params.xml",
  //  "container": {
  //    "port": "40001",
  //    "name": "brunor_40001_oarpalms",
  //    "id": "1dc5e6c985a5"},
  //  "output": {
  //    "ftp_user": "brunor",
  //    "ftp_pass": "SNKI8vvD",
  //    "file_name": "out_batch_params.xml.tar",
  //    "url": "http://fgsg.ct.infn.it:40001/brunor/out_batch_params.xml.tar"},
  //   "doi": {
  //     "model": "10.15161/oar.it/23467",
  //     "parameters": "10.15161/oar.it/23469"
  //.  }
  // }

  // Extract information about HTTPD/FTP server
  ftp_server.reset();
  ftp_server.user = data[0]['output']['ftp_user'];
  ftp_server.password = data[0]['output']['ftp_pass'];
  ftp_server.file = data[0]['output']['file_name'];
  ftp_server.url = data[0]['output']['url'];
  ftp_server.httpd_port = data[0]['container']['port'];
  ftp_server.httpd_name = data[0]['container']['name'];
  ftp_server.httpd_id = data[0]['container']['id'];

  // Extract information related to the last PALMS execution
  // DOI section could be not present
  palms_info.reset();
  palms_info.model_url = data[0]['model'];
  palms_info.params_url = data[0]['params'];
  if(data[0]['doi'] != null) {
    palms_info.model_doi = data[0]['doi']['model'];
    palms_info.params_doi = data[0]['doi']['parameters'];
  }
  palms_info.set_state('ready');
}

// Error case for proc_task_output
var proc_task_output_error = function(jqXHR, exception) {
    reset_area("task_info");
    report_error("Error retrieving task output information for '" +
                 application_name + "' application. ",
                 user_support);
}

// Retrieve PALMS information from task output stream
var proc_task_output = function(resource_url) {
  url = fg_api_settings.base_url + '/' +
        fg_api_settings.version + '/' +
        resource_url;
  doGet(url, proc_task_output, proc_task_output_error);
}

// Refresh button
var refresh_page = function() {
    resetAreas("task_info"); 
    check_tasks(application_name);
}

// Success case for get_task_info
var proc_task_info = function(data) {
  // Task may be one of:
  //.  doi-submit
  //   submit
  //   upload
  //   release
  // Action can be determined by the task arguments
  // arg[0] ./pilot_script
  // arg[1] <action>
  // ... etc
  task_action = data['arguments'][0];

  // A different behavior happens in case the last task is done or not
  if(data['status'] == "DONE") {
    // In DONE case, the GUI is ready to submit new user requests
    // It is only necessary to understand if the FTP resource is
    // still existing or not by checking release action
    switch(task_action) {
      case 'release':
        ftp_server.reset();
        palms_info.reset();
        palms_info.set_state('ready');
      break;
      case 'upload':
        // This case should not be considered, since only submit and
        // relase actions are processed
      default:
        // Prepare the list of task files
        task_files = {};
        for(var i=0; i<data['output_files'].length; i++) {
            var output_file = data.output_files[i];
            task_files[output_file.name] = output_file.url;
        }
        $('.task_info').data('task_files', task_files);
        // Retrieve FTP information from the standard output
        proc_task_output(task_files['output.txt']);
        palms_info.set_state('ready');
    }
  } else {
    // Notify a pending operation
    reset_area("task_info");
    var action_desc = "";
    switch(task_action) {
      case 'release':
        action_desc = "FTP reource relasing is executing, please wait";
      break;
      case 'doi-submit':
        action_desc = "A DOI submission of PALMS is executing, please wait";
      break;
      case 'submit':
        action_desc = "A submission of PALMS is executing, pleas wait";
      break;
      case 'upload':
        action_desc = "An upload opreation is executing, please wait";
      break;
      default:
        action_desc =
         "<strong>Warning:</strong> An unkown action named: '" +
         task_action +
         "' is executing";
    }
    $('.task_info').append(
        "<div class=\"refresh\">" +
        "<p>" + action_desc + "</p>" +
        "<p>Pressing the following button you can refresh the task status.</p>" +
        "<button type=\"button\"" +
        "        id=\"refresh_button\"" +
        "        class=\"btn btn-success\"" +
        ">REFRESH</button>" +
        "</div>");
    $("#refresh_button").on("click", refresh_page);
    palms_info.set_state('waiting');
  }
} 

// Error case for get_task_info
var proc_task_info_error = function(jqXHR, exception) {
    resetAreas(".task_files");
    reportError("Error retrieving output files of task: '" + data.id + "'",
                user_support);
}

// Get task information
function get_task_info(task_id) {
   url = fg_api_settings.base_url + '/' +
         fg_api_settings.version  + '/users/' +
         fg_user_info.name + '/tasks/' +
         task_id;
    doGet(url, proc_task_info, proc_task_info_error);
}

// Success case for check task 
var proc_check_tasks = function(data) {
    reset_area("task_info");
    ftp_server.reset();
    palms_info.reset();
    // Process and create the task list
    task_info = data['tasks'];
    $('.task_info').data('task_info',data['tasks']);
    // Process task information if necessary
    ftp_resource = false;
    if(task_info.length > 0) {
        // Seek for last submission task or a pending operation
        for(i=0; i<data['tasks'].length; i++) {
          last_submit_task = data['tasks'][i];
          console.log('Task #: ' + i +
                      ', task_id: ' + last_submit_task['id'] +
                      ', description: ' + last_submit_task['description'] +
                      ', status: ' + last_submit_task['status']);
          // Exit in case of submit or not DONE task
          // DONE 'release' tasks should not be present, since this operation
          // includes all previous tasks deletion
          if(last_submit_task['description'].conatins('submit')  ||
             last_submit_task['status'] != 'DONE') {
            break;
          }
        }
        get_task_info(last_submit_task.id);
    } else {
      // When no tasks are available the application is ready to operate
      palms_info.set_state('ready');
    }
    // Build the GUI accordingly to the current task situation
    build_gui();
}

// Error case for check task
var proc_check_tasks_error = function(jqXHR, exception) {
    reset_area("task_info");
    report_error("Error retrieving task information for '" +
                 application_name + "' application. ",
                 user_support);
}

// Check task
function check_tasks(application) {
   url = fg_api_settings.base_url + '/' +
         fg_api_settings.version  + '/users/' +
         fg_user_info.name + '/tasks?application=' +
         application;
    doGet(url, proc_check_tasks, proc_check_tasks_error);
}

// Success case for check_app
var proc_check_app_tasks = function(data) {
    if(data.id != null) {
        // Application hidden data
        app_info = {
            'id': data.id,
            'name': data.name,
        };
        $('.app_info').data('app_info',app_info)
        // Now check the application tasks
        check_tasks(application_name);
    } else {
        reset_area("app_info");
        report_error("It seems the application '" + application_name +
                     "' is not registered in FutureGateway. ",
                      user_support);
    }
}

//Error case for check_app
var proc_check_app_tasks_error = function(jqXHR, exception) {
    reset_area("app_info");
    report_error("Error retriving '" + application_name + "' application " +
                 "information from FutureGateway. Please ensure your " +
                 "membership has the necessary rights to access '" +
                 application_name + "' application.",
                 user_support);
}

// Check application
function check_app_tasks(application) { 
   url = fg_api_settings.base_url + '/' +
         fg_api_settings.version + '/applications/' +
         application;
    doGet(url, proc_check_app_tasks, proc_check_app_tasks_error);
}

// Success case for check_user_app_tasks
var proc_user_app_tasks = function(data) {
    if(data.id != null &&
       data.mail != 'default@liferay.com') {
        // User hidden data
        user_info = {
            'id': data.id,
            'first_name': data.first_name,
            'last_name': data.last_name,
            'email': data.mail,
            'creation': data.creation,
            'modified': data.modified,
        };
        $('.user_info').data('user_info',user_info);
        // User information recovered, it is possible to check the app.
        check_app_tasks(application_name);
    } else {
        reset_area("user_info");
        report_error("It seems you are not yet registered as " +
                     "FutureGateway user.",
                     user_support);
    }
}

// Error case for check_user_app_task
var proc_user_app_tasks_error = function(jqXHR, exception) {
    reset_area("user_info");
    report_error("Error retrieving portal user information.",
                 user_support);
}

// Check user application and task
function check_user_app_tasks() {
    url = fg_api_settings.base_url + '/' +
          fg_api_settings.version  +'/users/' +
          fg_user_info.name;
    doGet(url, proc_user_app_tasks, proc_user_app_tasks_error);
}

//
// OpenAccessRepository
//

DOI_Output = {
  // CORS Proxy project at: https://github.com/messier31/cors-proxy-server
  doi_pxcors: 'https://secret-ocean-49799.herokuapp.com/',

  // Ouptut DOI values
  doi_server: 'https://doi.org/',
  doi_number: '',
  doi_url: '',
  doi_model: '',
  doi_parameters: '',
  model_input: '',
  params_input: '',

  reset: function() {
    this.doi_pxcors = 'https://secret-ocean-49799.herokuapp.com/',
    this.doi_server = 'https://doi.org/';
    this.doi_number = '';
    this.doi_url = '';
    this.doi_model = '';
    this.doi_parameters = '';
    this.model_input = '';
    this.params_input = '';
  },
  doi_extract: function(doi_number) {
    this.doi_number = doi_number;
    this.doi_url = this.doi_pxcors + this.doi_server + this.doi_number;
    console.log('Output DOI URL: \'' + this.doi_url + '\'');
    $.ajax({
        timeout: 30000,
        url: this.doi_url,
        type: 'GET',
        dataType: 'text',
        success: function(data){
          DOI_Output.parse_output_doi(data);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          DOI_Output.report_error(
            "Unable to load output content from page: '" + this.doi_url + "'' " +
            "referred by DOI: '" + this.doi_number + "'"
          )
        }
    });
  },
  parse_output_doi: function(data) {
    console.log('data: ' + data);
    var doi_page_doc =(new DOMParser).parseFromString('' + data, "text/html").documentElement;
    doi_list = $(doi_page_doc).find('a[href^="' + this.doi_server + '"]');
    console.log('len: ' + doi_list.length);
    for(var i=0; i<doi_list.length-1; i++) {
      var doi_link = doi_list[i].href;
      console.log('Referenced DOI: ' + doi_link);
      // Skip the reproducibility DOI
      if(doi_link.includes('23494')) {
        console.log('DOI: ' + doi_link + ' refers to the reproducibility code');
        continue;
      }
      var doi_url = this.doi_pxcors + doi_link;
      console.log('doi_url: ' + doi_url);
      $.ajax({
        timeout: 30000,
        url: doi_url,
        type: 'GET',
        dataType: 'text',
        success: function(data){
          DOI_Output.parse_doi_content(data);
        },
        error: function (jqXHR, textStatus, errorThrown) {
          DOI_Output.report_error(
            "Unable to get page content from: '" + doi_url + "' "+
            "referred by DOI: '" + this.doi_number + "'");
        }
      });
    }
  },
  parse_doi_content: function(data) {
    var doi_page_doc =(new DOMParser).parseFromString('' + data, "text/html").documentElement;
    if($(doi_page_doc).find('title')[0].text.includes('model')) {
      this.doi_model = $(doi_page_doc).find('img[data-toggle]')[0].alt;
      if(this.model_input != '') {
        $('#' + this.model_input).val(this.doi_model);
      }
      console.log('Model DOI: ' + this.doi_model);
    } else {
      this.doi_parameters = $(doi_page_doc).find('img[data-toggle]')[0].alt;
      if(this.params_input != '') {
        $('#' + this.params_input).val(this.doi_parameters);
      }
      console.log('Parameters DOI: ' + this.doi_parameters);
    }
    // When both model and parameters are solved, restore spinnig button
    if($('#' + this.model_input).val() == this.doi_model &&
       $('#' + this.params_input).val() == this.doi_parameters) {
      set_spin_button(false);
    }
  },
  report_error: function(message) {
    // Restore spinning button on error
    set_spin_button(false);
    alert(message);
    console.log('ERROR: ' + message);
  }
}

//
// FutureGateway helper functions
//

function doGet(url, successFunction, failureFunction) {
    $.ajax({
        type: "GET",
        url: url,
        dataType: "json",
        headers: {
            'Authorization': fg_user_info.access_token,
        },
        crossDomain: true,
        success: successFunction,
        error: failureFunction
   });
}

function doPost(url, reqData, successFunction, failureFunction) {
    $.ajax({
        type: "POST",
        url: url,
        dataType: "json",
        data: JSON.stringify(reqData),
        headers: {
            'Authorization': fg_user_info.access_token,
        },
        contentType: 'application/json',
        crossDomain: true,
        success: successFunction,
        error: failureFunction
   });
}

function doDelete(url, successFunction, failureFunction) {
    $.ajax({
        type: "DELETE",
        url: url,
        dataType: "json",
        headers: {
            'Authorization': fg_user_info.access_token,
        },
        contentType: 'application/json',
        crossDomain: true,
        success: successFunction,
        error: failureFunction
   });
}

export default function(rootElementId) {
  $(`#${rootElementId}`).html(build_page());
}

