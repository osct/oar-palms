<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c" %>
<%@ taglib uri="http://java.sun.com/portlet_2_0" prefix="portlet" %>
<%@ taglib uri="http://liferay.com/tld/aui" prefix="aui" %>
<%@ taglib uri="http://liferay.com/tld/portlet" prefix="liferay-portlet" %>
<%@ taglib uri="http://liferay.com/tld/theme" prefix="liferay-theme" %>
<%@ taglib uri="http://liferay.com/tld/ui" prefix="liferay-ui" %>
<%@page import="java.io.*" %>
<%@page import="java.net.*" %>
<%@page import="java.util.Base64" %>
<%@page import="com.liferay.portal.kernel.json.*" %>
<%@page import="it.infn.ct.FutureGatewayAPIs" %>
<portlet:defineObjects />
<liferay-theme:defineObjects />

<%
    // FG settings
    String fgUser = "futuregateway";
    String fgPassword = "futuregateway";
    String fgBaseUrl = "http://fgapiserver";
    String fgAPIVer = "v1.0";
    boolean fgStatus = false;
    String errMessage = "";

    // Application settings
    String appName = "oar-palms";
    int appId = 8;
    String appGroup = appName;

    // Initialize FutureGatewayAPIs object
    FutureGatewayAPIs fgAPIs = new FutureGatewayAPIs(
        fgBaseUrl,
        fgAPIVer,
        fgUser,
        fgPassword);

    // Check FG service
    fgStatus = fgAPIs.checkServer();

    // Retrieve user account information
    String screenName = user.getScreenName();
    String firstName = user.getFirstName();
    String lastName = user.getLastName();
    String emailAddress = user.getEmailAddress();
    String openId = user.getOpenId();

    // Extract OIDC 'sub' value
    String oidcSub = null;
    try {
        JSONObject jsonOpenId = JSONFactoryUtil.createJSONObject(openId);
        oidcSub = jsonOpenId.getString("sub");
    } catch(JSONException e) {
        oidcSub = "<unknown>";
    }

    // User settings
    int userId = 0;
    boolean userExists = false;
    boolean userGroup = false;
    String portletAccessToken = "";
    String delegatedAccessToken = "";

    // Use FGAPIs to check user and retieve tokens
    if(fgStatus) {
        // 1st Get the portlet token
        portletAccessToken = fgAPIs.getAccessToken(fgUser, null);
   
        // 2nd Check if the user exists
        fgAPIs.setAuthMode(FutureGatewayAPIs.AuthModes.BASELINE_TOKEN);
        userExists = fgAPIs.userExists(screenName);
        if(!userExists) {
            // User does not exists, create it
            fgAPIs.createUser(screenName,
	                      firstName,
                              lastName,
                              emailAddress,
                              "");
            // Check if the inserted user now exists
            userExists = fgAPIs.userExists(screenName);
        }
        // 3rd Retrieve the delegated access token (user token)
        if(userExists) {
            delegatedAccessToken = fgAPIs.getAccessToken(fgUser, screenName);
            // 4th Does the user belong to the application group?
            userGroup = fgAPIs.userHasGroup(screenName, appGroup);
	    // Manually allowing the  access to this application is preferable
            // Add user to the application group automatically if allowed
            if(!userGroup) {
                // Automatically add the user to the Application group
                fgAPIs.setBaselineToken(portletAccessToken);
                String[] userGroups = { appGroup };
                userGroup = fgAPIs.addUserGroups(screenName, userGroups);
                fgAPIs.setBaselineToken(delegatedAccessToken);
            }
        }
    }
    // The GUI interface has now enough information to perform next activitis
    // using the FutureGateway APIs with the delegatedAccessToken
%>

<script type="text/javascript">

  // Collect user account info into FG user info
  var fg_user_info = {
    id: null,
    name: '<%= screenName %>',
    first_name: '<%= firstName %>',
    last_name: '<%= lastName %>',
    email: '<%= emailAddress %>',
    insitute: 'unknown',
    err_message: '<%= errMessage %>',
    access_token: '<%= delegatedAccessToken %>',
    user_exists: '<%= userExists %>',
    user_group: '<%= userGroup %>',
    open_id: '<%= openId %>',
    oidc_sub: '<%= oidcSub %>',
    portlet_token: '<%= portletAccessToken %>', // To be removed!!!
  };

  // FG API server settings
  var fg_api_settings = {
    base_url: 'https://fgsg.ct.infn.it/fgapiserver',
    version: 'v1.0',
    enabled: '<%= fgStatus %>',
  };

  // Application settigns
  var fg_app_settings = {
    name: '<%= appName %>',
    id: '<%= appId %>',
    group_name: '<%= appGroup %>',
  };

  // Contact email for user support
  var user_support = 'mailto:riccardo.bruno@ct.infn.it';
</script>
