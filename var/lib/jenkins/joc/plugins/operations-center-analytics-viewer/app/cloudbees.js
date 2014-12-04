(function() {

  define('directives/cloudbees',[
    'angular',
    'lodash',
    'config',
    'kbn'
  ], function (angular, _, config, kbn) {
    

    var module = angular.module('kibana.directives');

    module.controller('filterResetCtrl', 
      function($scope, $rootScope, dashboard, filterSrv, $timeout) {
      $scope.dashboard = dashboard;
      $scope.masterFilter = "";

      // Helps detect when the user changes between panels without reloading the controllers etc
      $rootScope.$on('$routeChangeSuccess',function() {
        console.log('noticed a route change!!!');
        $scope.configureMasterFilter();
      });

      var _setDeveloperMode = function(devMode) {
        console.log('_setDeveloperMode(' + devMode + ')');

        if (!dashboard.current.loader) return;

        dashboard.current.loader.show_home = false; // No need ever
        dashboard.current.editable = devMode;
        dashboard.current.loader.load_elasticsearch = devMode;
        dashboard.current.loader.load_gist          = false; // No need ever
        dashboard.current.loader.load_local         = false; // No need ever

        dashboard.current.loader.save_elasticsearch = devMode;
        dashboard.current.loader.save_gist          = false;  // No need ever
        dashboard.current.loader.save_local         = false;  // No need ever
        dashboard.current.loader.save_default       = false;  // No need ever

        dashboard.current.loader.save_temp          = devMode; // No need ever
      };

      // Called from outside, performs a digest when it is done.
      document.setDeveloperMode = function(devMode) {
        _setDeveloperMode(devMode || document.developerMode);
      };

      document.runApply = function() {
        $scope.$apply();
      };

      var getNonMasterFilters = function() {
        var filters = [];
        _.each(filterSrv.list(), function(filter) {
          if (filter.type === 'master') {
            return;
          };

          if (filter.preserve) {
            return;
          }

          if (filter.type === 'time') {
            return;
          }

          filters.push(filter);
        });
        return filters;
      }

      // Clears everything that didn't exist when the first configuration was done
      // Does not clear a master filter either
      document.clearNonMasterFilters = function() {
        if (!filterSrvReady()) return;

        _.each(getNonMasterFilters(), function(filter) {
          filterSrv.remove(filter.id);
        });
      };

      document.clearMasterFilter = function() {
        if (!filterSrvReady()) return;

        var ids;
        try {
          ids = filterSrv.ids();
        } catch (e) {
          return;
        }

        $scope.masterFilter = '';

        _.each(filterSrv.list(), function(filter) {
          if (filter.type == 'master') {
            filterSrv.remove(filter.id, false);
          };
        });

      };

      document.applyMasterFilter = function(masterFilter) {
        if (masterFilter) {
          $scope.masterFilter = masterFilter;
        } 

        console.log('Applying master filter "' + $scope.masterFilter + '"');
        $scope.configureMasterFilter();
      };

      var filterSrvReady = function() {
        return (dashboard.current.services !== undefined);
      }

      $scope.configureMasterFilter = function() {
        if (!filterSrvReady()) {
          $timeout(document.applyMasterFilter, 500);
          return;
        }

        var mf = $scope.masterFilter;
        document.clearMasterFilter();
        $scope.masterFilter = mf;
  
        if ($scope.masterFilter !== undefined && $scope.masterFilter !== '') {
          // The incoming filter is split (ideally with the same rules as ES uses to analyze)
          // and those constituent parts must ALL show up in the target document analyzed term
          // It's not perfect, but nothing ever is
          filterSrv.set({
            "type"    : "master",
            "field"   : "masterName_analyzed",
            "value"   : $scope.masterFilter.split(/[-\/*]/),
            "mandate" : "must"
          }, undefined, false);
        }
      };

      $scope.$watch('masterFilter', $scope.configureMasterFilter);
      $rootScope.$on('refresh', function() {
        if (document.filterCallback) document.filterCallback({ filterCount: getNonMasterFilters().length, masterFilter: $scope.masterFilter });
      })

      if (document.developerMode !== undefined) {
        // The Jenkins page hosting this iframe was able to set the variable before
        // this code ran. So we take value and initialise the controller on the next cycle through
        // Has to be done in next digest as the dashboard may not be quite configured at this point.
        setTimeout(document.setDeveloperMode, 500);
      } else {
        // The Jenkins page hosting this iframe was slower than the iframe getting setup
        // So it will just call the setDeveloperMode function directly when it is ready.
      }
    });

    module.directive('filterReset', function(dashboard, ejsResource, $rootScope, $timeout) {

      return {
        restrict: 'CE',
        controller: 'filterResetCtrl',
        template: ""
      }
    });
  });


}());
