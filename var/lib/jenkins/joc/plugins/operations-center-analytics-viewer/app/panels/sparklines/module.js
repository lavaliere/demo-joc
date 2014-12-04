define('panels/sparklines/interval',[
  'kbn'
],
function (kbn) {
  

  /**
   * manages the interval logic
   * @param {[type]} interval_string  An interval string in the format '1m', '1y', etc
   */
  function Interval(interval_string) {
    this.string = interval_string;

    var info = kbn.describe_interval(interval_string);
    this.type = info.type;
    this.ms = Math.ceil(info.sec * 1000 * info.count);

    // does the length of the interval change based on the current time?
    if (this.type === 'y' || this.type === 'M') {
      // we will just modify this time object rather that create a new one constantly
      this.get = this.get_complex;
      this.date = new Date(0);
    } else {
      this.get = this.get_simple;
    }
  }

  Interval.prototype = {
    toString: function () {
      return this.string;
    },
    after: function(current_ms) {
      return this.get(current_ms, 1);
    },
    before: function (current_ms) {
      return this.get(current_ms, -1);
    },
    get_complex: function (current, delta) {
      this.date.setTime(current);
      switch(this.type) {
      case 'M':
        this.date.setUTCMonth(this.date.getUTCMonth() + delta);
        break;
      case 'y':
        this.date.setUTCFullYear(this.date.getUTCFullYear() + delta);
        break;
      }
      return this.date.getTime();
    },
    get_simple: function (current, delta) {
      return current + (delta * this.ms);
    }
  };

  return Interval;

});
define('panels/sparklines/timeSeries',[
  './interval',
  'lodash'
],
function (Interval, _) {
  

  var ts = {};

  // map compatable parseInt
  function base10Int(val) {
    return parseInt(val, 10);
  }

  // trim the ms off of a time, but return it with empty ms.
  function getDatesTime(date) {
    return Math.floor(date.getTime() / 1000)*1000;
  }

  /**
   * Certain graphs require 0 entries to be specified for them to render
   * properly (like the line graph). So with this we will caluclate all of
   * the expected time measurements, and fill the missing ones in with 0
   * @param {object} opts  An object specifying some/all of the options
   *
   * OPTIONS:
   * @opt   {string}   interval    The interval notion describing the expected spacing between
   *                                each data point.
   * @opt   {date}     start_date  (optional) The start point for the time series, setting this and the
   *                                end_date will ensure that the series streches to resemble the entire
   *                                expected result
   * @opt   {date}     end_date    (optional) The end point for the time series, see start_date
   * @opt   {string}   fill_style  Either "minimal", or "all" describing the strategy used to zero-fill
   *                                the series.
   */
  ts.ZeroFilled = function (opts) {
    opts = _.defaults(opts, {
      interval: '10m',
      start_date: null,
      end_date: null,
      fill_style: 'minimal'
    });

    // the expected differenece between readings.
    this.interval = new Interval(opts.interval);

    // will keep all values here, keyed by their time
    this._data = {};
    this.start_time = opts.start_date && getDatesTime(opts.start_date);
    this.end_time = opts.end_date && getDatesTime(opts.end_date);
    this.opts = opts;
  };

  /**
   * Add a row
   * @param {int}  time  The time for the value, in
   * @param {any}  value The value at this time
   */
  ts.ZeroFilled.prototype.addValue = function (time, value) {
    if (time instanceof Date) {
      time = getDatesTime(time);
    } else {
      time = base10Int(time);
    }
    if (!isNaN(time)) {
      this._data[time] = (_.isUndefined(value) ? 0 : value);
    }
    this._cached_times = null;
  };

  /**
   * Get an array of the times that have been explicitly set in the series
   * @param  {array} include (optional) list of timestamps to include in the response
   * @return {array} An array of integer times.
   */
  ts.ZeroFilled.prototype.getOrderedTimes = function (include) {
    var times = _.map(_.keys(this._data), base10Int);
    if (_.isArray(include)) {
      times = times.concat(include);
    }
    return _.uniq(times.sort(function (a, b) {
      // decending numeric sort
      return a - b;
    }), true);
  };

  /**
   * return the rows in the format:
   * [ [time, value], [time, value], ... ]
   *
   * Heavy lifting is done by _get(Min|Default|All)FlotPairs()
   * @param  {array} required_times  An array of timestamps that must be in the resulting pairs
   * @return {array}
   */
  ts.ZeroFilled.prototype.getFlotPairs = function (required_times) {
    var times = this.getOrderedTimes(required_times),
      strategy,
      pairs;

    if(this.opts.fill_style === 'all') {
      strategy = this._getAllFlotPairs;
    } else if(this.opts.fill_style === 'null') {
      strategy = this._getNullFlotPairs;
    } else {
      strategy = this._getMinFlotPairs;
    }

    pairs = _.reduce(
      times,    // what
      strategy, // how
      [],       // where
      this      // context
    );

    // if the first or last pair is inside either the start or end time,
    // add those times to the series with null values so the graph will stretch to contain them.
    // Removing, flot 0.8.1's max/min params satisfy this
    /*
    if (this.start_time && (pairs.length === 0 || pairs[0][0] > this.start_time)) {
      pairs.unshift([this.start_time, null]);
    }
    if (this.end_time && (pairs.length === 0 || pairs[pairs.length - 1][0] < this.end_time)) {
      pairs.push([this.end_time, null]);
    }
    */

    return pairs;
  };

  /**
   * ** called as a reduce stragegy in getFlotPairs() **
   * Fill zero's on either side of the current time, unless there is already a measurement there or
   * we are looking at an edge.
   * @return {array} An array of points to plot with flot
   */
  ts.ZeroFilled.prototype._getMinFlotPairs = function (result, time, i, times) {
    var next, expected_next, prev, expected_prev;

    // check for previous measurement
    if (i > 0) {
      prev = times[i - 1];
      expected_prev = this.interval.before(time);
      if (prev < expected_prev) {
        result.push([expected_prev, 0]);
      }
    }

    // add the current time
    result.push([ time, this._data[time] || 0]);

    // check for next measurement
    if (times.length > i) {
      next = times[i + 1];
      expected_next = this.interval.after(time);
      if (next > expected_next) {
        result.push([expected_next, 0]);
      }
    }

    return result;
  };

  /**
   * ** called as a reduce stragegy in getFlotPairs() **
   * Fill zero's to the right of each time, until the next measurement is reached or we are at the
   * last measurement
   * @return {array}  An array of points to plot with flot
   */
  ts.ZeroFilled.prototype._getAllFlotPairs = function (result, time, i, times) {
    var next, expected_next;

    result.push([ times[i], this._data[times[i]] || 0 ]);
    next = times[i + 1];
    expected_next = this.interval.after(time);
    for(; times.length > i && next > expected_next; expected_next = this.interval.after(expected_next)) {
      result.push([expected_next, 0]);
    }

    return result;
  };

  /**
   * ** called as a reduce stragegy in getFlotPairs() **
   * Same as min, but fills with nulls
   * @return {array}  An array of points to plot with flot
   */
  ts.ZeroFilled.prototype._getNullFlotPairs = function (result, time, i, times) {
    var next, expected_next, prev, expected_prev;

    // check for previous measurement
    if (i > 0) {
      prev = times[i - 1];
      expected_prev = this.interval.before(time);
      if (prev < expected_prev) {
        result.push([expected_prev, null]);
      }
    }

    // add the current time
    result.push([ time, this._data[time] || null]);

    // check for next measurement
    if (times.length > i) {
      next = times[i + 1];
      expected_next = this.interval.after(time);
      if (next > expected_next) {
        result.push([expected_next, null]);
      }
    }

    return result;
  };


  return ts;
});
/* Pretty handling of time axes.

Copyright (c) 2007-2013 IOLA and Ole Laursen.
Licensed under the MIT license.

Set axis.mode to "time" to enable. See the section "Time series data" in
API.txt for details.

*/

(function($) {

	var options = {
		xaxis: {
			timezone: null,		// "browser" for local to the client or timezone for timezone-js
			timeformat: null,	// format string to use
			twelveHourClock: false,	// 12 or 24 time in time mode
			monthNames: null	// list of names of months
		}
	};

	// round to nearby lower multiple of base

	function floorInBase(n, base) {
		return base * Math.floor(n / base);
	}

	// Returns a string with the date d formatted according to fmt.
	// A subset of the Open Group's strftime format is supported.

	function formatDate(d, fmt, monthNames, dayNames) {

		if (typeof d.strftime == "function") {
			return d.strftime(fmt);
		}

		var leftPad = function(n, pad) {
			n = "" + n;
			pad = "" + (pad == null ? "0" : pad);
			return n.length == 1 ? pad + n : n;
		};

		var r = [];
		var escape = false;
		var hours = d.getHours();
		var isAM = hours < 12;

		if (monthNames == null) {
			monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		}

		if (dayNames == null) {
			dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		}

		var hours12;

		if (hours > 12) {
			hours12 = hours - 12;
		} else if (hours == 0) {
			hours12 = 12;
		} else {
			hours12 = hours;
		}

		for (var i = 0; i < fmt.length; ++i) {

			var c = fmt.charAt(i);

			if (escape) {
				switch (c) {
					case 'a': c = "" + dayNames[d.getDay()]; break;
					case 'b': c = "" + monthNames[d.getMonth()]; break;
					case 'd': c = leftPad(d.getDate()); break;
					case 'e': c = leftPad(d.getDate(), " "); break;
					case 'h':	// For back-compat with 0.7; remove in 1.0
					case 'H': c = leftPad(hours); break;
					case 'I': c = leftPad(hours12); break;
					case 'l': c = leftPad(hours12, " "); break;
					case 'm': c = leftPad(d.getMonth() + 1); break;
					case 'M': c = leftPad(d.getMinutes()); break;
					// quarters not in Open Group's strftime specification
					case 'q':
						c = "" + (Math.floor(d.getMonth() / 3) + 1); break;
					case 'S': c = leftPad(d.getSeconds()); break;
					case 'y': c = leftPad(d.getFullYear() % 100); break;
					case 'Y': c = "" + d.getFullYear(); break;
					case 'p': c = (isAM) ? ("" + "am") : ("" + "pm"); break;
					case 'P': c = (isAM) ? ("" + "AM") : ("" + "PM"); break;
					case 'w': c = "" + d.getDay(); break;
				}
				r.push(c);
				escape = false;
			} else {
				if (c == "%") {
					escape = true;
				} else {
					r.push(c);
				}
			}
		}

		return r.join("");
	}

	// To have a consistent view of time-based data independent of which time
	// zone the client happens to be in we need a date-like object independent
	// of time zones.  This is done through a wrapper that only calls the UTC
	// versions of the accessor methods.

	function makeUtcWrapper(d) {

		function addProxyMethod(sourceObj, sourceMethod, targetObj, targetMethod) {
			sourceObj[sourceMethod] = function() {
				return targetObj[targetMethod].apply(targetObj, arguments);
			};
		};

		var utc = {
			date: d
		};

		// support strftime, if found

		if (d.strftime != undefined) {
			addProxyMethod(utc, "strftime", d, "strftime");
		}

		addProxyMethod(utc, "getTime", d, "getTime");
		addProxyMethod(utc, "setTime", d, "setTime");

		var props = ["Date", "Day", "FullYear", "Hours", "Milliseconds", "Minutes", "Month", "Seconds"];

		for (var p = 0; p < props.length; p++) {
			addProxyMethod(utc, "get" + props[p], d, "getUTC" + props[p]);
			addProxyMethod(utc, "set" + props[p], d, "setUTC" + props[p]);
		}

		return utc;
	};

	// select time zone strategy.  This returns a date-like object tied to the
	// desired timezone

	function dateGenerator(ts, opts) {
		if (opts.timezone == "browser") {
			return new Date(ts);
		} else if (!opts.timezone || opts.timezone == "utc") {
			return makeUtcWrapper(new Date(ts));
		} else if (typeof timezoneJS != "undefined" && typeof timezoneJS.Date != "undefined") {
			var d = new timezoneJS.Date();
			// timezone-js is fickle, so be sure to set the time zone before
			// setting the time.
			d.setTimezone(opts.timezone);
			d.setTime(ts);
			return d;
		} else {
			return makeUtcWrapper(new Date(ts));
		}
	}
	
	// map of app. size of time units in milliseconds

	var timeUnitSize = {
		"second": 1000,
		"minute": 60 * 1000,
		"hour": 60 * 60 * 1000,
		"day": 24 * 60 * 60 * 1000,
		"month": 30 * 24 * 60 * 60 * 1000,
		"quarter": 3 * 30 * 24 * 60 * 60 * 1000,
		"year": 365.2425 * 24 * 60 * 60 * 1000
	};

	// the allowed tick sizes, after 1 year we use
	// an integer algorithm

	var baseSpec = [
		[1, "second"], [2, "second"], [5, "second"], [10, "second"],
		[30, "second"], 
		[1, "minute"], [2, "minute"], [5, "minute"], [10, "minute"],
		[30, "minute"], 
		[1, "hour"], [2, "hour"], [4, "hour"],
		[8, "hour"], [12, "hour"],
		[1, "day"], [2, "day"], [3, "day"],
		[0.25, "month"], [0.5, "month"], [1, "month"],
		[2, "month"]
	];

	// we don't know which variant(s) we'll need yet, but generating both is
	// cheap

	var specMonths = baseSpec.concat([[3, "month"], [6, "month"],
		[1, "year"]]);
	var specQuarters = baseSpec.concat([[1, "quarter"], [2, "quarter"],
		[1, "year"]]);

	function init(plot) {
		plot.hooks.processOptions.push(function (plot, options) {
			$.each(plot.getAxes(), function(axisName, axis) {

				var opts = axis.options;

				if (opts.mode == "time") {
					axis.tickGenerator = function(axis) {

						var ticks = [];
						var d = dateGenerator(axis.min, opts);
						var minSize = 0;

						// make quarter use a possibility if quarters are
						// mentioned in either of these options

						var spec = (opts.tickSize && opts.tickSize[1] ===
							"quarter") ||
							(opts.minTickSize && opts.minTickSize[1] ===
							"quarter") ? specQuarters : specMonths;

						if (opts.minTickSize != null) {
							if (typeof opts.tickSize == "number") {
								minSize = opts.tickSize;
							} else {
								minSize = opts.minTickSize[0] * timeUnitSize[opts.minTickSize[1]];
							}
						}

						for (var i = 0; i < spec.length - 1; ++i) {
							if (axis.delta < (spec[i][0] * timeUnitSize[spec[i][1]]
											  + spec[i + 1][0] * timeUnitSize[spec[i + 1][1]]) / 2
								&& spec[i][0] * timeUnitSize[spec[i][1]] >= minSize) {
								break;
							}
						}

						var size = spec[i][0];
						var unit = spec[i][1];

						// special-case the possibility of several years

						if (unit == "year") {

							// if given a minTickSize in years, just use it,
							// ensuring that it's an integer

							if (opts.minTickSize != null && opts.minTickSize[1] == "year") {
								size = Math.floor(opts.minTickSize[0]);
							} else {

								var magn = Math.pow(10, Math.floor(Math.log(axis.delta / timeUnitSize.year) / Math.LN10));
								var norm = (axis.delta / timeUnitSize.year) / magn;

								if (norm < 1.5) {
									size = 1;
								} else if (norm < 3) {
									size = 2;
								} else if (norm < 7.5) {
									size = 5;
								} else {
									size = 10;
								}

								size *= magn;
							}

							// minimum size for years is 1

							if (size < 1) {
								size = 1;
							}
						}

						axis.tickSize = opts.tickSize || [size, unit];
						var tickSize = axis.tickSize[0];
						unit = axis.tickSize[1];

						var step = tickSize * timeUnitSize[unit];

						if (unit == "second") {
							d.setSeconds(floorInBase(d.getSeconds(), tickSize));
						} else if (unit == "minute") {
							d.setMinutes(floorInBase(d.getMinutes(), tickSize));
						} else if (unit == "hour") {
							d.setHours(floorInBase(d.getHours(), tickSize));
						} else if (unit == "month") {
							d.setMonth(floorInBase(d.getMonth(), tickSize));
						} else if (unit == "quarter") {
							d.setMonth(3 * floorInBase(d.getMonth() / 3,
								tickSize));
						} else if (unit == "year") {
							d.setFullYear(floorInBase(d.getFullYear(), tickSize));
						}

						// reset smaller components

						d.setMilliseconds(0);

						if (step >= timeUnitSize.minute) {
							d.setSeconds(0);
						}
						if (step >= timeUnitSize.hour) {
							d.setMinutes(0);
						}
						if (step >= timeUnitSize.day) {
							d.setHours(0);
						}
						if (step >= timeUnitSize.day * 4) {
							d.setDate(1);
						}
						if (step >= timeUnitSize.month * 2) {
							d.setMonth(floorInBase(d.getMonth(), 3));
						}
						if (step >= timeUnitSize.quarter * 2) {
							d.setMonth(floorInBase(d.getMonth(), 6));
						}
						if (step >= timeUnitSize.year) {
							d.setMonth(0);
						}

						var carry = 0;
						var v = Number.NaN;
						var prev;

						do {

							prev = v;
							v = d.getTime();
							ticks.push(v);

							if (unit == "month" || unit == "quarter") {
								if (tickSize < 1) {

									// a bit complicated - we'll divide the
									// month/quarter up but we need to take
									// care of fractions so we don't end up in
									// the middle of a day

									d.setDate(1);
									var start = d.getTime();
									d.setMonth(d.getMonth() +
										(unit == "quarter" ? 3 : 1));
									var end = d.getTime();
									d.setTime(v + carry * timeUnitSize.hour + (end - start) * tickSize);
									carry = d.getHours();
									d.setHours(0);
								} else {
									d.setMonth(d.getMonth() +
										tickSize * (unit == "quarter" ? 3 : 1));
								}
							} else if (unit == "year") {
								d.setFullYear(d.getFullYear() + tickSize);
							} else {
								d.setTime(v + step);
							}
						} while (v < axis.max && v != prev);

						return ticks;
					};

					axis.tickFormatter = function (v, axis) {

						var d = dateGenerator(v, axis.options);

						// first check global format

						if (opts.timeformat != null) {
							return formatDate(d, opts.timeformat, opts.monthNames, opts.dayNames);
						}

						// possibly use quarters if quarters are mentioned in
						// any of these places

						var useQuarters = (axis.options.tickSize &&
								axis.options.tickSize[1] == "quarter") ||
							(axis.options.minTickSize &&
								axis.options.minTickSize[1] == "quarter");

						var t = axis.tickSize[0] * timeUnitSize[axis.tickSize[1]];
						var span = axis.max - axis.min;
						var suffix = (opts.twelveHourClock) ? " %p" : "";
						var hourCode = (opts.twelveHourClock) ? "%I" : "%H";
						var fmt;

						if (t < timeUnitSize.minute) {
							fmt = hourCode + ":%M:%S" + suffix;
						} else if (t < timeUnitSize.day) {
							if (span < 2 * timeUnitSize.day) {
								fmt = hourCode + ":%M" + suffix;
							} else {
								fmt = "%b %d " + hourCode + ":%M" + suffix;
							}
						} else if (t < timeUnitSize.month) {
							fmt = "%b %d";
						} else if ((useQuarters && t < timeUnitSize.quarter) ||
							(!useQuarters && t < timeUnitSize.year)) {
							if (span < timeUnitSize.year) {
								fmt = "%b";
							} else {
								fmt = "%b %Y";
							}
						} else if (useQuarters && t < timeUnitSize.year) {
							if (span < timeUnitSize.year) {
								fmt = "Q%q";
							} else {
								fmt = "Q%q %Y";
							}
						} else {
							fmt = "%Y";
						}

						var rt = formatDate(d, fmt, opts.monthNames, opts.dayNames);

						return rt;
					};
				}
			});
		});
	}

	$.plot.plugins.push({
		init: init,
		options: options,
		name: 'time',
		version: '1.0'
	});

	// Time-axis support used to be in Flot core, which exposed the
	// formatDate function on the plot object.  Various plugins depend
	// on the function, so we need to re-expose it here.

	$.plot.formatDate = formatDate;

})(jQuery);

define("jquery.flot.time", function(){});

/** @scratch /panels/5
 *
 * include::panels/sparklines.asciidoc[]
 */

/** @scratch /panels/sparklines/0
 *
 * == Sparklines
 * Status: *Experimental*
 *
 * The sparklines panel shows tiny time charts. The purpose of these is not to give an exact value,
 * but rather to show the shape of the time series in a compact manner
 *
 */
define('panels/sparklines/module',[
  'angular',
  'app',
  'jquery',
  'lodash',
  'kbn',
  'moment',
  './timeSeries',

  'jquery.flot',
  'jquery.flot.time'
],
function (angular, app, $, _, kbn, moment, timeSeries) {

  

  var module = angular.module('kibana.panels.sparklines', []);
  app.useModule(module);

  module.controller('sparklines', function($scope, querySrv, dashboard, filterSrv) {
    $scope.panelMeta = {
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      editorTabs : [
        {
          title:'Queries',
          src:'app/partials/querySelect.html'
        }
      ],
      status  : "Experimental",
      description : "Sparklines are tiny, simple, time series charts, shown separately. Because "+
        "sparklines are uncluttered by grids, axis markers and colors, they are perfect for spotting"+
        " change in a series"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/sparklines/3
       *
       * === Parameters
       * mode:: Value to use for the y-axis. For all modes other than count, +value_field+ must be
       * defined. Possible values: count, mean, max, min, total.
       */
      mode          : 'count',
      /** @scratch /panels/sparklines/3
       * time_field:: x-axis field. This must be defined as a date type in Elasticsearch.
       */
      time_field    : '@timestamp',
      /** @scratch /panels/sparklines/3
       * value_field:: y-axis field if +mode+ is set to mean, max, min or total. Must be numeric.
       */
      value_field   : null,
      /** @scratch /panels/sparklines/3
       * interval:: Sparkline intervals are computed automatically as long as there is a time filter
       * present. In the absence of a time filter, use this interval.
       */
      interval      : '5m',
      /** @scratch /panels/sparklines/3
       * spyable:: Show inspect icon
       */
      spyable       : true,
      /** @scratch /panels/sparklines/5
       *
       * ==== Queries
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
    };

    _.defaults($scope.panel,_d);

    $scope.init = function() {

      $scope.$on('refresh',function(){
        $scope.get_data();
      });

      $scope.get_data();

    };

    $scope.interval_label = function(interval) {
      return $scope.panel.auto_int && interval === $scope.panel.interval ? interval+" (auto)" : interval;
    };

    /**
     * The time range effecting the panel
     * @return {[type]} [description]
     */
    $scope.get_time_range = function () {
      var range = $scope.range = filterSrv.timeRange('last');
      return range;
    };

    $scope.get_interval = function () {
      var interval = $scope.panel.interval,
                      range;
      range = $scope.get_time_range();
      if (range) {
        interval = kbn.secondsToHms(
          kbn.calculate_interval(range.from, range.to, 10, 0) / 1000
        );
      }
      $scope.panel.interval = interval || '10m';
      return $scope.panel.interval;
    };

    /**
     * Fetch the data for a chunk of a queries results. Multiple segments occur when several indicies
     * need to be consulted (like timestamped logstash indicies)
     *
     * The results of this function are stored on the scope's data property. This property will be an
     * array of objects with the properties info, time_series, and hits. These objects are used in the
     * render_panel function to create the historgram.
     *
     * @param {number} segment   The segment count, (0 based)
     * @param {number} query_id  The id of the query, generated on the first run and passed back when
     *                            this call is made recursively for more segments
     */
    $scope.get_data = function(segment, query_id) {
      var
        _range,
        _interval,
        request,
        queries,
        results;

      if (_.isUndefined(segment)) {
        segment = 0;
      }
      delete $scope.panel.error;

      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }
      _range = $scope.get_time_range();
      _interval = $scope.get_interval(_range);

      $scope.panelMeta.loading = true;
      request = $scope.ejs.Request().indices(dashboard.indices[segment]);

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);

      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // Build the query
      _.each(queries, function(q) {
        var query = $scope.ejs.FilteredQuery(
          querySrv.toEjsObj(q),
          filterSrv.getBoolFilter(filterSrv.ids())
        );

        var facet = $scope.ejs.DateHistogramFacet(q.id);

        if($scope.panel.mode === 'count') {
          facet = facet.field($scope.panel.time_field).global(true);
        } else {
          if(_.isNull($scope.panel.value_field)) {
            $scope.panel.error = "In " + $scope.panel.mode + " mode a field must be specified";
            return;
          }
          facet = facet.keyField($scope.panel.time_field).valueField($scope.panel.value_field);
        }
        facet = facet.interval(_interval).facetFilter($scope.ejs.QueryFilter(query));
        request = request.facet(facet)
          .size(0);
      });

      // Populate the inspector panel
      $scope.populate_modal(request);

      // Then run it
      results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {

        $scope.panelMeta.loading = false;
        if(segment === 0) {
          $scope.hits = 0;
          $scope.data = [];
          query_id = $scope.query_id = new Date().getTime();
        }

        // Check for error and abort if found
        if(!(_.isUndefined(results.error))) {
          $scope.panel.error = $scope.parse_error(results.error);
          return;
        }

        // Make sure we're still on the same query/queries
        if($scope.query_id === query_id) {

          var i = 0,
            time_series,
            hits;

          _.each(queries, function(q) {
            var query_results = results.facets[q.id];
            // we need to initialize the data variable on the first run,
            // and when we are working on the first segment of the data.
            if(_.isUndefined($scope.data[i]) || segment === 0) {
              var tsOpts = {
                interval: _interval,
                start_date: _range && _range.from,
                end_date: _range && _range.to,
                fill_style: 'minimal'
              };
              time_series = new timeSeries.ZeroFilled(tsOpts);
              hits = 0;
            } else {
              time_series = $scope.data[i].time_series;
              hits = $scope.data[i].hits;
            }

            // push each entry into the time series, while incrementing counters
            _.each(query_results.entries, function(entry) {
              time_series.addValue(entry.time, entry[$scope.panel.mode]);
              hits += entry.count; // The series level hits counter
              $scope.hits += entry.count; // Entire dataset level hits counter
            });
            $scope.data[i] = {
              info: q,
              range: $scope.range,
              time_series: time_series,
              hits: hits
            };

            i++;
          });

          // If we still have segments left, get them
          if(segment < dashboard.indices.length-1) {
            $scope.get_data(segment+1,query_id);
          }
        }
      });
    };

    // I really don't like this function, too much dom manip. Break out into directive?
    $scope.populate_modal = function(request) {
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
    };

  });

  module.directive('sparklinesChart', function() {
    return {
      restrict: 'A',
      scope: {
        series: '=',
        panel: '='
      },
      template: '<div></div>',
      link: function(scope, elem) {

        // Receive render events
        scope.$watch('series',function(){
          render_panel();
        });

        var derivative = function(series) {
          return _.map(series, function(p,i) {
            var _v;
            if(i === 0 || p[1] === null) {
              _v = [p[0],null];
            } else {
              _v = series[i-1][1] === null ? [p[0],null] : [p[0],p[1]-(series[i-1][1])];
            }
            return _v;
          });
        };

        // Function for rendering panel
        function render_panel() {
          // IE doesn't work without this
          elem.css({height:"30px",width:"100px"});

          // Populate element
          //try {
          var options = {
            legend: { show: false },
            series: {
              lines:  {
                show: true,
                // Silly, but fixes bug in stacked percentages
                fill: 0,
                lineWidth: 2,
                steps: false
              },
              points: { radius:2 },
              shadowSize: 1
            },
            yaxis: {
              show: false
            },
            xaxis: {
              show: false,
              mode: "time",
              min: _.isUndefined(scope.series.range.from) ? null : scope.series.range.from.getTime(),
              max: _.isUndefined(scope.series.range.to) ? null : scope.series.range.to.getTime()
            },
            grid: {
              hoverable: false,
              show: false
            }
          };
          // when rendering stacked bars, we need to ensure each point that has data is zero-filled
          // so that the stacking happens in the proper order
          var required_times = [];
          required_times = scope.series.time_series.getOrderedTimes();
          required_times = _.uniq(required_times.sort(function (a, b) {
            // decending numeric sort
            return a-b;
          }), true);

          var _d = {
            data  : scope.panel.derivative ?
             derivative(scope.series.time_series.getFlotPairs(required_times)) :
             scope.series.time_series.getFlotPairs(required_times),
            label : scope.series.info.alias,
            color : elem.css('color'),
          };

          $.plot(elem, [_d], options);

          //} catch(e) {
          //  console.log(e);
          //}
        }

        var $tooltip = $('<div>');
        elem.bind("plothover", function (event, pos, item) {
          if (item) {
            $tooltip
              .html(
                item.datapoint[1] + " @ " + moment(item.datapoint[0]).format('YYYY-MM-DD HH:mm:ss')
              )
              .place_tt(pos.pageX, pos.pageY);
          } else {
            $tooltip.detach();
          }
        });
      }
    };
  });

});

