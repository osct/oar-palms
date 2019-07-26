/**************************************************************************
Copyright (c) 2011:
Istituto Nazionale di Fisica Nucleare (INFN), Italy

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
@author <a href="mailto:riccardo.bruno@ct.infn.it">Riccardo Bruno</a>(INFN)
****************************************************************************/
package it.infn.ct;

import java.io.*;
import java.net.*;
import java.util.Base64;
import com.liferay.portal.kernel.json.*;
import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;

/*
 * FutureGatewayAPI class that manages FutureGateway APIs
 */
public class FutureGatewayAPIs {

    private String fgBaseUrl;
    private String fgAPIVersion;
    private String fgUser;
    private String fgPassword;
    private String fgB64Password;
    private String ptvToken;
    private String baselineToken;
    private boolean errFlag;
    private String errMessage;
    private String errRequest;

    /*
     * Possible FutureGateway APIs authentication methods
     */
    public static enum AuthModes {
        NONE,           // No authentication it all
        PTV,            // Heder: 'Authorization: Bearer <token>'
        BASELINE_TOKEN, // Header: 'Authorization: <token>'
        BASELINE_PARAMS // Parameters: username=<user>&password=<password>
    };
    private AuthModes currentAuth = AuthModes.NONE;

    /*
     * Class to manage authorization parameters or authorization headers
     */
    private class AuthParams {
        private String authHeader = "";
        private String authParams = "";

        public AuthParams(AuthModes authMode, FutureGatewayAPIs fgAPIs) {
            switch(authMode) {
                case NONE:
                    break;
                case PTV:
                    this.authHeader = "Bearer " + fgAPIs.ptvToken; 
                    break;
                case BASELINE_TOKEN:
                    this.authHeader = fgAPIs.baselineToken;
                    break;
                case BASELINE_PARAMS:
                    this.authParams = "username=" + fgAPIs.fgUser +
                                      "&password=" + fgAPIs.fgB64Password;
                    break;
            }
        }

        public boolean isAuthParams() { return this.authParams.length() > 0; }
        public boolean isAuthHeader() { return this.authHeader.length() > 0; }
        public String getAuthParams() { return this.authParams; }
        public String getAuthHeader() { return this.authHeader; }
    }; 

    private static Log _log = LogFactoryUtil.getLog(FutureGatewayAPIs.class);

    private static String LS = System.getProperty("line.separator");

    /**
     * Class constructor
     */
    public FutureGatewayAPIs(
        String fgBaseUrl,
        String fgAPIVersion,
        String fgUser,
        String fgPassword) {
        this.fgBaseUrl = fgBaseUrl;
        this.fgAPIVersion = fgAPIVersion;
        this.fgUser = fgUser;
        this.fgPassword = fgPassword;
        this.fgB64Password = new 
            String(Base64.getEncoder().encode(fgPassword.getBytes()));
        this.ptvToken = "";
        this.baselineToken = "";
        this.errFlag = false;
        _log.debug("Created FutureGatewayAPIs: '" + this + "'");
    }

    /**
     * Represent this class and its status
     */
    public String toString() {
        return "Base URL: " + this.fgBaseUrl + LS +
               "API Version: " + this.fgAPIVersion + LS +
               "User: " + this.fgUser + LS +
               "Password: " + this.fgPassword + LS +
               "PasswordB64Encoded: " + this.fgB64Password + LS +
               "PTV Token: " + this.ptvToken + LS +
               "Baseline Token: " + this.baselineToken + LS +
               "Authentication mode: " + this.currentAuth + LS +
               "Error" + LS +
               "  Flag: " + this.errFlag + LS +
               "  Request: " + this.errRequest + LS +
               "  Message: " + this.errMessage + LS +
               "";  
    }

    /**
     * Set the current auth mode
     */
    public void setAuthMode(AuthModes mode) {
        _log.debug("setAuthMode");
        this.currentAuth = mode;
    }

    /**
     * Verify if the server responds and check APIs version match
     *
     */
    public boolean checkServer() {
        _log.debug("checkServer");
        JSONObject json = doGet("");
        return !this.errFlag;
    }

    /**
     * Set a new baselineToken with the given accessToken
     * this method is useful to switch between user and
     * delegated tokens
     */
    public void setBaselineToken(String accessToken) {
        _log.debug("setBaselineToken");
        this.baselineToken = accessToken;
    }

    /**
     * Set PTV token
     */
    public void setPTVToken(String ptvToken) {
        _log.debug("setPTVToken");
        this.ptvToken = ptvToken;
    }

    /**
     * Get user baseline access token, if a delegated user is specified
     * the method returns the delegated token and class member baselineToken 
     * will be updated accordingly
     */
    public String getAccessToken(String username, String userdel) {
        _log.debug("getAccessToken");
        // Endpoint auth/ is the only one requiring BASELINE_PARAMS credentials
        // Current Auth value will be switched to this mode during this method
        // Previous authentication mode will be restored to its original value
        // after method execution
        AuthModes prevAuth = this.currentAuth;
        this.currentAuth = AuthModes.BASELINE_PARAMS;
        this.baselineToken = "";
        String delegatedUserParam = "";
        if(userdel != null && userdel.length() > 0) {
            delegatedUserParam = "?user=" + userdel;
        }
        JSONObject json = doGet("auth" + delegatedUserParam);
        if(!this.errFlag) {
            if(userdel != null && userdel.length() > 0) {
                this.baselineToken = json.getString("delegated_token");
            } else {
                this.baselineToken = json.getString("token");
            }
            if(this.baselineToken.length() == 0) {
                this.errFlag = true;
                this.errMessage = "Empty token retrieved for user: '" + username + "'";
            }
        }
        this.currentAuth = prevAuth;
        _log.debug("baselineToken: '" + this.baselineToken + "'");
        return this.baselineToken;
    }

    /**
     * Verify if the specified user exists
     */
    public boolean userExists(String username) {
        _log.debug("userExists");
        JSONObject jsonResult = doGet("users/" + username);
    return !this.errFlag && jsonResult.getString("name").equals(username);
    }

    /**
     * Create a FutureGateway user
     */
    public boolean createUser(String name,
                              String firstName,
                              String lastName,
                              String mail,
                              String institute) {
        _log.debug("createUser");
	String jsonData = "{ \"name\": \"" + name + "\"," +
		          "  \"first_name\": \"" + firstName + "\"," +
			  "  \"last_name\": \"" + lastName + "\"," +
			  "  \"mail\": \"" + mail + "\"," +
			  "  \"institute\": \"" + institute + "\" }";
        _log.debug("jsonData: '" + jsonData + "'");
	try {
            JSONObject jsonResult = doPost(
                "users",
                JSONFactoryUtil.createJSONObject(jsonData));
	} catch(JSONException e) {
            errFlag = true;
	    errMessage = "Unable to create json object from json data: '" + jsonData + "'";
	    _log.error(errMessage + LS + e.toString());
	}
        return !this.errFlag;
    }

    /**
     * Add a given list of groups to a given user
     */
    public boolean addUserGroups(String userName, String[] userGroups) {
        _log.debug("addUserGroups");
        String jsonData = "{ \"groups\": [";
        String groupList = "";
        for(int i=0; i<userGroups.length; i++) {
            groupList += "\"" + userGroups[i] + "\", ";
        }
        if(groupList.length() > 0) {
           groupList = groupList.substring(0, groupList.length() - 2);
        }
        jsonData += groupList + "]}";
        _log.debug("jsonData: '" + jsonData + "'");
        try {
            JSONObject jsonResult = doPost(
                "users/" + userName + "/groups",
                JSONFactoryUtil.createJSONObject(jsonData));
        } catch(JSONException e) {
            errFlag = true;
            errMessage = "Unable to add groups: '" + 
		         groupList.substring(0, groupList.length()-1) + 
                         "' to user: '" + userName + "'";
            _log.error(errMessage + LS + e.toString());
        }
        return !this.errFlag;
    }

    /**
     * Delete a given list of groups to a given user
     */
    public boolean deleteUserGroups(String userName, String[] userGroups) {
        _log.debug("removeUserGroups");
        String jsonData = "{ \"groups\": [";
        String groupList = "";
        for(int i=0; i<userGroups.length; i++) {
            groupList += "\"" + userGroups[i] + "\", ";
        }
        if(groupList.length() > 0) {
           groupList = groupList.substring(0, groupList.length() - 2);
        }
        jsonData += groupList + "]}";
        _log.debug("jsonData: '" + jsonData + "'");
        try {
            JSONObject jsonResult = doDelete(
                "users/" + userName + "/groups",
                JSONFactoryUtil.createJSONObject(jsonData));
        } catch(JSONException e) {
            errFlag = true;
            errMessage = "Unable to remove groups: '" +
		         groupList.substring(0, groupList.length()-1) +
                         "' to user: '" + userName + "'";
            _log.error(errMessage + LS + e.toString());
        }
        return !this.errFlag;
    }

    /**
     * Return the list groups assigned to a specified user
     */
    public JSONArray getUserGroups(String userName) {
        _log.debug("getUserGroups");
        JSONArray groups = null;

        JSONObject jsonResult = doGet("users/" + userName + "/groups");
        if(jsonResult != null) {
            groups = jsonResult.getJSONArray("groups");
        }
        return groups;
    }       

    /**
     * Return true if the specified user has the specified group
     */
    public boolean userHasGroup(String userName, String groupName) {
        _log.debug("userHasGroup");
        boolean hasGroup = false;

        JSONArray groups = getUserGroups(userName);
	if(groups != null) {
	    for (int i = 0 ; i < groups.length(); i++) {
                JSONObject group = groups.getJSONObject(i);
		String name = group.getString("name");
		if(name.equals(groupName)) {
                    hasGroup = true;
                    break;
		}
            }
	}
        return hasGroup;
    }

    /**
     * Handle error situation
     */
    public void setError(String request, String errorDetail) {
        this.errFlag = true;
        this.errMessage = errorDetail;
        this.errRequest = request;
    }
    
    /**
     * Perform a GET request to a given endpoint to the futuregateway
     *
     */
    public JSONObject doGet(String endpoint) {
        String jsonResult = "";
        String fgTextRequest = "";
        URL fgRequest = null;
        AuthParams authParams = new AuthParams(this.currentAuth, this);

	_log.debug("GET");
        // Prepare and execute the GET request
        try {
            // Reset err variables
            this.errFlag = false;
            this.errMessage = "";
            this.errRequest = fgTextRequest = fgBaseUrl + "/" +
                                              fgAPIVersion + "/" + endpoint;
            if(authParams.isAuthParams()) {
                if(fgTextRequest.indexOf("?") > 0) {
                    fgTextRequest += "&" + authParams.getAuthParams();
                } else {
                    fgTextRequest += "?" + authParams.getAuthParams();
                }
            }
            _log.debug("Request: '" + fgTextRequest + "'");
            fgRequest = new URL(fgTextRequest);
            HttpURLConnection urlConnection = (HttpURLConnection)fgRequest.openConnection();
            if(authParams.isAuthHeader()) {
                urlConnection.setRequestProperty("Authorization",
                                                 authParams.getAuthHeader());
                _log.debug("Authorization: " + authParams.getAuthHeader());
            }
            urlConnection.setUseCaches(false);
	    urlConnection.setRequestMethod("GET");
            // Get response
            BufferedReader buffread = 
                new BufferedReader(
                    new InputStreamReader(urlConnection.getInputStream()));
            String jsonLine = "";
            while((jsonLine = buffread.readLine()) != null) {
                jsonResult += jsonLine;
            }
            buffread.close();
        } catch(MalformedURLException e) {
            setError(fgTextRequest, e.toString());
        } catch(IOException e) {
            setError(fgTextRequest, e.toString());
        } 
        // Create JSON object form result
        JSONObject jsonObj = null;
        try {
            jsonObj = JSONFactoryUtil.createJSONObject(jsonResult);
        } catch(JSONException e) {
            setError(fgTextRequest, e.toString());
        }
        _log.debug("json: '" + jsonObj + "'");
        return jsonObj;
    }
    
    /**
     * Perform a POST request to a given endpoint to the futuregateway
     *
     */
    public JSONObject doPost(String endpoint,
                             JSONObject jsonData) {
        String jsonResult = "";
        String fgTextRequest = "";
        URL fgRequest = null;
        AuthParams authParams = new AuthParams(this.currentAuth, this);

	_log.debug("POST");
        // Prepare and execute the POST request
        try {
            // Reset err variables
            this.errFlag = false;
            this.errMessage = "";
            this.errRequest = fgTextRequest = fgBaseUrl + "/" +
                                              fgAPIVersion + "/" + endpoint;
            if(authParams.isAuthParams()) {
                if(fgTextRequest.indexOf("?") > 0) {
                    fgTextRequest += "&" + authParams.getAuthParams();
                } else {
                    fgTextRequest += "?" + authParams.getAuthParams();
                }
            }
            _log.debug("Request: '" + fgTextRequest + "'");
            fgRequest = new URL(fgTextRequest);
            HttpURLConnection urlConnection = (HttpURLConnection)fgRequest.openConnection();
            if(authParams.isAuthHeader()) {
                urlConnection.setRequestProperty("Authorization",
                                                 authParams.getAuthHeader());
                _log.debug("Authorization: " + authParams.getAuthHeader());
            }
            urlConnection.setUseCaches(false);
            urlConnection.setRequestMethod("POST");
            urlConnection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            urlConnection.setDoOutput(true);
            urlConnection.setDoInput(true);

            OutputStreamWriter writer = new OutputStreamWriter(urlConnection.getOutputStream());
            writer.write("" + jsonData);
            writer.flush();

            // Get response
            BufferedReader buffread = 
                new BufferedReader(
                    new InputStreamReader(urlConnection.getInputStream()));
            String jsonLine = "";
            while((jsonLine = buffread.readLine()) != null) {
                jsonResult += jsonLine;
            }
            buffread.close();
        } catch(MalformedURLException e) {
            setError(fgTextRequest, e.toString());
        } catch(IOException e) {
            setError(fgTextRequest, e.toString());
        } 
        // Create JSON object form result
        JSONObject jsonObj = null;
        try {
            jsonObj = JSONFactoryUtil.createJSONObject(jsonResult);
        } catch(JSONException e) {
            setError(fgTextRequest, e.toString());
        }
        _log.debug("json: '" + jsonObj + "'");
        return jsonObj;
    }

    /**
     * Perform a DELETE request to a given endpoint to the futuregateway
     *
     */
    public JSONObject doDelete(String endpoint,
                               JSONObject jsonData) {
        String jsonResult = "";
        String fgTextRequest = "";
        URL fgRequest = null;
        AuthParams authParams = new AuthParams(this.currentAuth, this);

	_log.debug("DELETE");
        // Prepare and execute the POST request
        try {
            // Reset err variables
            this.errFlag = false;
            this.errMessage = "";
            this.errRequest = fgTextRequest = fgBaseUrl + "/" +
                                              fgAPIVersion + "/" + endpoint;
            if(authParams.isAuthParams()) {
                if(fgTextRequest.indexOf("?") > 0) {
                    fgTextRequest += "&" + authParams.getAuthParams();
                } else {
                    fgTextRequest += "?" + authParams.getAuthParams();
                }
            }
            _log.debug("Request: '" + fgTextRequest + "'");
            fgRequest = new URL(fgTextRequest);
            HttpURLConnection urlConnection = (HttpURLConnection)fgRequest.openConnection();
            if(authParams.isAuthHeader()) {
                urlConnection.setRequestProperty("Authorization",
                                                 authParams.getAuthHeader());
                _log.debug("Authorization: " + authParams.getAuthHeader());
            }
            urlConnection.setUseCaches(false);
            urlConnection.setRequestMethod("DELETE");
            urlConnection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            urlConnection.setDoOutput(true);
            urlConnection.setDoInput(true);

            OutputStreamWriter writer = new OutputStreamWriter(urlConnection.getOutputStream());
            writer.write("" + jsonData);
            writer.flush();

            // Get response
            BufferedReader buffread = 
                new BufferedReader(
                    new InputStreamReader(urlConnection.getInputStream()));
            String jsonLine = "";
            while((jsonLine = buffread.readLine()) != null) {
                jsonResult += jsonLine;
            }
            buffread.close();
        } catch(MalformedURLException e) {
            setError(fgTextRequest, e.toString());
        } catch(IOException e) {
            setError(fgTextRequest, e.toString());
        } 
        // Create JSON object form result
        JSONObject jsonObj = null;
        try {
            jsonObj = JSONFactoryUtil.createJSONObject(jsonResult);
        } catch(JSONException e) {
            setError(fgTextRequest, e.toString());
        }
        _log.debug("json: '" + jsonObj + "'");
        return jsonObj;
    }
};
