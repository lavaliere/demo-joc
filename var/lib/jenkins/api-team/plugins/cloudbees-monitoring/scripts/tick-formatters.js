var tickFormatters = {
    percent: function(v, axis) {
        return (v*100.0).toFixed(axis.tickDecimals>2?axis.tickDecimals-2:0) + "%";
    },
    inversePercent: function(v, axis) {
        return ((1-v)*100.0).toFixed(axis.tickDecimals>2?axis.tickDecimals-2:0) + "%";
    },
    seconds: function(v, axis) {
        return v.toFixed(axis.tickDecimals)+"s";
    },
    smartTimeSeconds: function(v, axis) {
        var aV = v < 0 ? -v : v;
        if (aV < 1e-7) return (0.0).toFixed(axis.tickDecimals);
        if (aV < 0.1e-3) return (v/1e-6).toFixed(axis.tickDecimals)+"ns";
        if (aV < 0.1) return (v/1e-3).toFixed(axis.tickDecimals)+"ms";
        if (aV < 90) return (v).toFixed(axis.tickDecimals)+"s";
        if (aV < 90*60) return (v/60.0).toFixed(axis.tickDecimals)+"min";
        if (aV < 36*60*60) return (v/60.0).toFixed(axis.tickDecimals)+"h";
        return (v/24/60/60).toFixed(axis.tickDecimals)+"d";
    },
    minutesFromSeconds: function(v, axis) {
        return (v/60.0).toFixed(axis.tickDecimals)+"min";
    }
}