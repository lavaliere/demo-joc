
define('css-embed', function()
{
	function embed_css(content)
	{
		var head = document.getElementsByTagName('head')[0],
		style = document.createElement('style'),
		rules = document.createTextNode(content);
		style.type = 'text/css';
		if(style.styleSheet)
			style.styleSheet.cssText = rules.nodeValue;
		else style.appendChild(rules);
			head.appendChild(style);
	}
	return embed_css;
});

define('css!panels/query/query.css', ['css-embed'], 
function(embed)
{
	embed(
	'.short-query {   display:inline-block;   margin-right: 10px; } .short-query input.search-query {     width: 280px; } .begin-query {   position:absolute;   left:10px;   top:5px; } .end-query {   position:absolute;   right:10px;   top:5px; } .end-query i, .begin-query i {   margin: 0px; } .panel-query {   padding-left: 25px !important;   height: 31px !important;   -webkit-box-sizing: border-box; /* Safari/Chrome, other WebKit */   -moz-box-sizing: border-box;    /* Firefox, other Gecko */   box-sizing: border-box;         /* Opera/IE 8+ */ } .query-disabled {   opacity: 0.3; } .form-search:hover .has-remove {   padding-left: 40px !important; } .remove-query {   opacity: 0; } .last-query {   padding-right: 45px !important; } .form-search:hover .remove-query {   opacity: 1; } .query-panel .pinned {   margin-right: 5px; }'
	);
	return true;
});

/*

  ## query

  ### Parameters
  * query ::  A string or an array of querys. String if multi is off, array if it is on
              This should be fixed, it should always be an array even if its only
              one element
*/
define('panels/query/module',[
  'angular',
  'app',
  'lodash',

  'css!./query.css'
], function (angular, app, _) {
  

  var module = angular.module('kibana.panels.query', []);
  app.useModule(module);

  module.controller('query', function($scope, querySrv, $rootScope, dashboard, $q, $modal) {
    $scope.panelMeta = {
      status  : "Stable",
      description : "Manage all of the queries on the dashboard. You almost certainly need one of "+
        "these somewhere. This panel allows you to add, remove, label, pin and color queries"
    };

    // Set and populate defaults
    var _d = {
      query   : "*",
      pinned  : true,
      history : [],
      remember: 10 // max: 100, angular strap can't take a variable for items param
    };
    _.defaults($scope.panel,_d);

    $scope.querySrv = querySrv;
    $scope.dashboard = dashboard;

    // A list of query types for the query config popover
    $scope.queryTypes = querySrv.types;

    var queryHelpModal = $modal({
      template: './app/panels/query/helpModal.html',
      persist: true,
      show: false,
      scope: $scope,
    });

    $scope.init = function() {
    };

    $scope.refresh = function() {
      update_history(_.pluck($scope.dashboard.current.services.query.list,'query'));
      dashboard.refresh();
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

    $scope.toggle_pin = function(id) {
      dashboard.current.services.query.list[id].pin = dashboard.current.services.query.list[id].pin ? false : true;
    };

    $scope.queryIcon = function(type) {
      return querySrv.queryTypes[type].icon;
    };

    $scope.queryConfig = function(type) {
      return "./app/panels/query/editors/"+(type||'lucene')+".html";
    };

    $scope.queryHelpPath = function(type) {
      return "./app/panels/query/help/"+(type||'lucene')+".html";
    };

    $scope.queryHelp = function(type) {
      $scope.help = {
        type: type
      };
      $q.when(queryHelpModal).then(function(modalEl) {
        modalEl.modal('show');
      });
    };

    $scope.typeChange = function(q) {
      var _nq = {
        id   : q.id,
        type : q.type,
        query: q.query,
        alias: q.alias,
        color: q.color
      };
      dashboard.current.services.query.list[_nq.id] = querySrv.defaults(_nq);
    };

    var update_history = function(query) {
      if($scope.panel.remember > 0) {
        $scope.panel.history = _.union(query.reverse(),$scope.panel.history);
        var _length = $scope.panel.history.length;
        if(_length > $scope.panel.remember) {
          $scope.panel.history = $scope.panel.history.slice(0,$scope.panel.remember);
        }
      }
    };

    $scope.init();

  });

});
