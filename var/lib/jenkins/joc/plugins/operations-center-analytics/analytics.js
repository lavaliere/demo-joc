// Copyright 2014 CloudBees, Inc.
// This is proprietary code. All rights reserved.
(function() {
  "use strict";
  
  var production = true;
  var fullscreen = false;
  var lastMasterId = undefined;

  var filterCallback = function(event) {
    console.log(event);

    // Manage other filter panel
    var btn = document.getElementById('btnClearNonMasterFilters');
    if (event.filterCount === 0) {
      btn.disabled = true;
      btn.textContent = "no other filters";
    } else {
      btn.disabled = false;
      if (event.filterCount === 1) {
        btn.textContent = "clear 1 other filter";
      } else {
        btn.textContent = "clear " + event.filterCount + " other filters";
      }
    }

    // Manage masters filter panel
    btn = document.getElementById('btnClearMasterFilter');
    btn.disabled = (event.masterFilter === undefined || event.masterFilter === "");

    if (lastMasterId !== event.masterFilter) {
      //The conditional works around the initial state where someone typing has their entry wiped out
      document.getElementById('txtMasterFilter').value = event.masterFilter;
      lastMasterId = event.masterFilter;
    }

    // If a tab switch occurs, we need to reapply CSS - so this is required (although a blunt hammer)
    setupCSS();
  };

  window.toggleEditor = function(event) {
    production = !production;
    setupCSS();
    iframe.contentDocument.runApply();
  };

  window.toggleFullscreen = function(event) {
    fullscreen = !fullscreen;
    var btn = document.getElementById('btnToggleFullscreen');

    if (fullscreen) {
      Element.addClassName(document.body, 'kibana-fullscreen');
      Element.setStyle(document.getElementById('kibana-box'), { 
          'min-height': (window.innerHeight - 50) + 'px',
          'height': (window.innerHeight - 50) + 'px',
        });
    } else {
      Element.removeClassName(document.body, 'kibana-fullscreen');
    }
    setupFullscreenCSS();
  };

  var findKibanaIframe = function() {
    return document.getElementById('kibana-iframe');
  };
  
  // Attach a stylesheet inside the iframe. If the stylesheet is
  // already attached, then just adjust the content of the stylesheet.
  var setupCSS = function() {
    var btn = document.getElementById('btnToggleEditor');
    btn.textContent = production ? 'enable' : 'disable';

    var iframe = findKibanaIframe();
    var style = iframe.contentDocument.getElementById('kibana-css-override');
    if (style === undefined || style === null) {
      style = document.createElement("style");
      style.id = 'kibana-css-override';
      iframe.contentDocument.body.appendChild(style);
      iframe.setAttribute('scrolling', 'yes');
    }

    // this is common CSS - we should move it to a static file - cloudbees.css
    var css = "";
      

    if (production) {
      css = css + "\
        body { background: white; } \
        .bgNav { display: none; } \
        .top-row-close { display: none; } \
        .row-open { display: none; } \
        [@ng-show=pulldown.enable] { display: none; } \
        .panel-extra-container .row-button { display: none } \
        .filtering-container { display: none } \
        .alert-error { display: none !important} \
        ";
    } else {
      style.textContent = "\
        ";
    }

    if (style.textContent !== css) {
      console.log("Kibana augmented CSS: changed");
      style.textContent = css;
    } else {
      console.log("Kibana augmented CSS: not changed");
    }

    // another race condition
    if (iframe.contentDocument.setDeveloperMode) {
      iframe.contentDocument.setDeveloperMode(!production);
    } else {
      iframe.contentDocument.developerMode = !production;
    }

    iframe.contentDocument.filterCallback = filterCallback;
  };


  var clearNonMasterFilters  = function() {
    var iframe = findKibanaIframe();
    iframe.contentDocument.clearNonMasterFilters();
    iframe.contentDocument.runApply();
  };

  var setupFullscreenCSS = function() {
    var style = document.getElementById('fullscreen-css-override');
    if (style === undefined || style === null) {
      style = document.createElement("style");
      style.id = 'fullscreen-css-override';
      document.body.appendChild(style);
    }

    var css = "";

    if (fullscreen) {
      css = css + "\
        #side-panel, #header, #breadcrumbBar, #view-message, #footer, #footer-container, .tabBarFrame  { display: none; } \
        #main-panel-content { margin: 0; } \
        #main-panel { width: 100%; } \
      ";
    } else {
      //Nothing to do?
    }

    style.textContent = css;
  };

  var applyMasterFilter = function() {
    var iframe = findKibanaIframe();
    // Ultimately we will read back the value, but there are too many sharp edges at present
    var masterFilterValue = ''; // iframe.contentDocument.findMasterFilterValue();
    var input = document.getElementById('txtMasterFilter');
    iframe.contentDocument.applyMasterFilter(input.value);
    iframe.contentDocument.runApply();
  };

  var clearMasterFilter = function() {
    var iframe = findKibanaIframe();
    document.getElementById('txtMasterFilter').value = '';
    lastMasterId = '';
    iframe.contentDocument.clearMasterFilter();
    iframe.contentDocument.runApply();
  };

  document.
    getElementById('btnApplyMasterFilter').
    addEventListener('click', applyMasterFilter, false);

  document.
    getElementById('btnClearMasterFilter').
    addEventListener('click', clearMasterFilter, false);

  document.
    getElementById('btnClearNonMasterFilters').
    addEventListener('click', clearNonMasterFilters, false);

  document.
    getElementById('btnToggleEditor').
    addEventListener('click', toggleEditor, false);

  document.
    getElementById('btnToggleFullscreen').
    addEventListener('click', toggleFullscreen, false);


  window.addEventListener('load', setupCSS, false);
}());