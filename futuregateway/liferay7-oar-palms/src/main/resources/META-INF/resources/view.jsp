<%@ include file="/init.jsp" %>
<link rel="stylesheet" href="<%=request.getContextPath()%>/css/all.css"/>

<div id="<portlet:namespace />"></div>

<aui:script require="liferay7-oar-palms@1.0.0">
	liferay7OarPalms100.default('<portlet:namespace />');
</aui:script>
