const pointFile = "data/crop_precip_points.csv";
const summaryFile = "data/crop_zone_summary.csv";

const measureLabels = {
  precip_intensity: "Overall Precipitation Proxy",
  rain_proxy: "Rain Proxy",
  snow_proxy: "Snow Proxy",
  crop_density: "Cropland Density"
};

const summaryColumns = {
  precip_intensity: "avg_precip",
  rain_proxy: "avg_rain",
  snow_proxy: "avg_snow",
  crop_density: "avg_crop_density"
};

const colorScale = d3.scaleOrdinal()
  .domain(["Non-Agricultural", "Sparse Crops", "Intense Cropland"])
  .range(["#bdbdbd", "#f2a65a", "#7a3e12"]);

const tooltip = d3.select("#tooltip");

let pointsData;
let summaryData;

let currentMetric = "precip_intensity";

const mapLayerInterpolators = {
  precip_intensity: d3.interpolateYlOrRd,
  rain_proxy: d3.interpolateBlues,
  snow_proxy: d3.interpolatePuBu,
  crop_density: d3.interpolateGreens
};

let usTopoCached = null;
let usTopoPromise = null;
let conusStatesCached = null;

const conusExcludedFips = new Set([2, 15, 72]);

function buildConusFromTopo(us) {
  const allStates = topojson.feature(us, us.objects.states);
  return {
    type: "FeatureCollection",
    features: allStates.features.filter(f => !conusExcludedFips.has(+f.id))
  };
}

function inConusBbox(d) {
  return d.lon >= -125 && d.lon <= -66 && d.lat >= 24 && d.lat <= 50;
}

function loadUsTopo() {
  if (usTopoCached) return Promise.resolve(usTopoCached);
  if (usTopoPromise) return usTopoPromise;
  usTopoPromise = d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
    .then(us => { usTopoCached = us; return us; });
  return usTopoPromise;
}

function showChartSkeleton(containerId, label = "Loading…") {
  const container = d3.select(`#${containerId}`);
  if (container.select(".chart-skeleton").empty()) {
    const skel = container.append("div").attr("class", "chart-skeleton");
    skel.append("div").attr("class", "chart-skeleton__spinner");
    skel.append("div").attr("class", "chart-skeleton__label").text(label);
  }
}

function hideChartSkeleton(containerId) {
  const skel = d3.select(`#${containerId}`).select(".chart-skeleton");
  if (!skel.empty()) {
    skel.classed("is-hidden", true);
    setTimeout(() => skel.remove(), 400);
  }
}

function showMapSkeleton() {
  showChartSkeleton("map", "Loading map…");
}

function hideMapSkeleton() {
  hideChartSkeleton("map");
}

showMapSkeleton();
showChartSkeleton("violinplot", "Loading chart…");
showChartSkeleton("barchart", "Loading chart…");

Promise.all([
  d3.csv(pointFile, d => ({
    lon: +d.lon,
    lat: +d.lat,
    crop_density: +d.crop_density,
    precip_intensity: +d.precip_intensity,
    rain_proxy: +d.rain_proxy,
    snow_proxy: +d.snow_proxy,
    crop_zone: d.crop_zone
  })),
  d3.csv(summaryFile, d => ({
    crop_zone: d.crop_zone,
    avg_crop_density: +d.avg_crop_density,
    avg_precip: +d.avg_precip,
    avg_rain: +d.avg_rain,
    avg_snow: +d.avg_snow,
    count: +d.count
  })),
  loadUsTopo()
])
.then(([points, summary, us]) => {

  conusStatesCached = buildConusFromTopo(us);

  pointsData = points.filter(d =>
    inConusBbox(d) && d3.geoContains(conusStatesCached, [d.lon, d.lat])
  );
  summaryData = summary;

  console.log("Loaded points (CONUS-filtered):", pointsData.length, "of", points.length);

  updateMapTitle();
  drawViolinPlot();
  drawBarChart();
  drawMap();

  d3.select("#measure-select")
    .on("change", function() {
      currentMetric = this.value;
      updateCharts();
    });

  d3.select("#zone-select")
    .on("change", updateCharts);
});

function updateCharts() {
  updateMapTitle();
  drawViolinPlot();
  drawBarChart();
  drawMap();
}

function getCurrentMeasure() {
  return d3.select("#measure-select").property("value");
}

function getCurrentZone() {
  return d3.select("#zone-select").property("value");
}

function getFilteredPoints() {
  const selectedZone = getCurrentZone();

  if (selectedZone === "All") {
    return pointsData;
  }

  return pointsData.filter(d => d.crop_zone === selectedZone);
}

function getNiceExtent(values, fallback = [0, 1]) {
  const numericValues = values.filter(Number.isFinite);
  if (!numericValues.length) return fallback;

  const extent = d3.extent(numericValues);
  if (extent[0] === extent[1]) {
    const pad = Math.max(1, Math.abs(extent[0]) * 0.05);
    return [extent[0] - pad, extent[1] + pad];
  }

  return extent;
}

function updateMapTitle() {
  const measure = getCurrentMeasure();

  const titleMap = {
    precip_intensity: "Overall Precipitation Across the Contiguous United States",
    rain_proxy: "Rain Intensity Across the Contiguous United States",
    snow_proxy: "Snow Intensity Across the Contiguous United States",
    crop_density: "Cropland Density Across the Contiguous United States"
  };

  const descriptionMap = {
    precip_intensity: "This map shows the spatial distribution of data points colored by overall precipitation intensity. Darker shades indicate higher precipitation values on a yellow-to-red scale.",
    rain_proxy: "This map shows the spatial distribution of data points colored by rain intensity. Darker shades indicate higher rain values on a blue scale.",
    snow_proxy: "This map shows the spatial distribution of data points colored by snow intensity. Darker shades indicate higher snow values on a blue-purple scale.",
    crop_density: "This map shows the spatial distribution of data points colored by cropland density. Darker shades indicate higher crop density values on a green scale."
  };

  d3.select("#map-title").text(titleMap[measure]);
  d3.select("#map-description").text(descriptionMap[measure]);
}

// function drawScatterplot() {
//   const measure = getCurrentMeasure();
//   const filtered = getFilteredPoints();

//   d3.select("#scatterplot").selectAll("*").remove();

//   const margin = { top: 40, right: 30, bottom: 70, left: 75 };
//   const outerWidth = 720;
//   const outerHeight = 500;
//   const width = outerWidth - margin.left - margin.right;
//   const height = outerHeight - margin.top - margin.bottom;

//   const svg = d3.select("#scatterplot")
//     .append("svg")
//     .attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

//   const g = svg.append("g")
//     .attr("transform", `translate(${margin.left},${margin.top})`);

//   const xMax = d3.max(pointsData, d => d[measure]) || 1;

//   const x = d3.scaleLinear()
//     .domain([0, xMax])
//     .nice()
//     .range([0, width]);

//   const y = d3.scaleLinear()
//     .domain([0, 255])
//     .nice()
//     .range([height, 0]);

//   g.append("g")
//     .attr("transform", `translate(0,${height})`)
//     .call(d3.axisBottom(x));

//   g.append("g")
//     .call(d3.axisLeft(y));

//   g.append("text")
//     .attr("class", "axis-label")
//     .attr("x", width / 2)
//     .attr("y", height + 48)
//     .attr("text-anchor", "middle")
//     .text(measureLabels[measure]);

//   g.append("text")
//     .attr("class", "axis-label")
//     .attr("transform", "rotate(-90)")
//     .attr("x", -height / 2)
//     .attr("y", -52)
//     .attr("text-anchor", "middle")
//     .text("Cropland Density Proxy");

//   g.selectAll("circle")
//     .data(filtered)
//     .join("circle")
//     .attr("cx", d => x(d[measure]))
//     .attr("cy", d => y(d.crop_density))
//     .attr("r", 3)
//     .attr("fill", d => colorScale(d.crop_zone))
//     .attr("opacity", 0.45)
//     .on("mouseover", function(event, d) {
//       d3.select(this)
//         .attr("r", 6)
//         .attr("opacity", 0.9);

//       tooltip
//         .style("opacity", 1)
//         .html(`
//           <strong>${d.crop_zone}</strong><br>
//           ${measureLabels[measure]}: ${d[measure].toFixed(2)}<br>
//           Crop Density Proxy: ${d.crop_density.toFixed(2)}<br>
//           Lon: ${d.lon.toFixed(2)}, Lat: ${d.lat.toFixed(2)}
//         `);
//     })
//     .on("mousemove", function(event) {
//       tooltip
//         .style("left", `${event.pageX + 14}px`)
//         .style("top", `${event.pageY - 28}px`);
//     })
//     .on("mouseout", function() {
//       d3.select(this)
//         .attr("r", 3)
//         .attr("opacity", 0.45);

//       tooltip.style("opacity", 0);
//     });

//   drawLegend(svg, outerWidth - 205, 28);
// }

function kernelDensityEstimator(kernel, X) {
    return function(V) {
        return X.map(function(x) {
            return [x, d3.mean(V, function(v) {
                return kernel(x - v);
            })];
        });
    };
}

function kernelEpanechnikov(k) {
    return function(v) {
        return Math.abs(v /= k) <= 1
            ? 0.75 * (1 - v * v) / k
            : 0;
    };
}

function drawViolinPlot() {
    const data = getFilteredPoints();
    if (!data.length) {
      return;
    }
    const selectedMetric = getCurrentMeasure();
    currentMetric = selectedMetric;

    const cropZoneOrder = [
      "Non-Agricultural",
      "Sparse Crops",
      "Intense Cropland"
    ];

    const groups = cropZoneOrder.filter(zone =>
      data.some(d => d.crop_zone === zone)
    );

    d3.select("#violinplot")
        .selectAll("*")
        .remove();

    const margin = { top: 40, right: 30, bottom: 80, left: 60 };

    const width = 620 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    const svg = d3.select("#violinplot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            `translate(${margin.left},${margin.top})`);
    
    const x = d3.scaleBand()
    .range([0, width])
    .domain(groups)
    .padding(0.05);

    svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-30)")
    .style("text-anchor", "end");

    const values = data
    .map(d => +d[selectedMetric])
    .filter(Number.isFinite);

    const y = d3.scaleLinear()
    .domain(getNiceExtent(values))
    .nice()
    .range([height, 0]);

    svg.append("g")
    .call(d3.axisLeft(y));

    svg.append("text")
    .attr("class", "y-axis-title")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .text(`${measureLabels[selectedMetric]}`);

    const kde = kernelDensityEstimator(
    kernelEpanechnikov(12),
    y.ticks(50)
    );

    const groupedData = groups.map(group => [
      group,
      data.filter(d => d.crop_zone === group)
    ]);

    const densityData = groupedData.map(([key, values]) => {

        const input = values
        .map(d => +d[selectedMetric])
        .filter(v => !isNaN(v));

        const density = kde(input);

        const sorted = input.sort(d3.ascending);

        const q1 = d3.quantile(sorted, 0.25);
        const median = d3.quantile(sorted, 0.5);
        const q3 = d3.quantile(sorted, 0.75);

        return {
            key: key,
            density: density,
            raw: values,

            min: d3.min(sorted),
            max: d3.max(sorted),

            q1: q1,
            median: median,
            q3: q3,

            iqr: q3 - q1
        };
    });

    const maxDensity = d3.max(densityData, d =>
    d3.max(d.density, v => v[1])
    );

    const xNum = d3.scaleLinear()
    .range([0, x.bandwidth() / 2])
    .domain([0, maxDensity]);

    svg.selectAll(".violin")
    .data(densityData)
    .join("path")
    .attr("class", "violin")
    .attr("transform", d =>
        `translate(${x(d.key) + x.bandwidth()/2},0)`
    )
    .style("fill", d => colorScale(d.key))
    .style("stroke", "black")
    .style("opacity", 0.8)
    .attr("d", d =>
        d3.area()
          .x0(v => -xNum(v[1]))
          .x1(v => xNum(v[1]))
          .y(v => y(v[0]))
          .curve(d3.curveCatmullRom)
          (d.density)
    )
    .on("mouseover", function(event, d) {

    d3.select(this)
      .style("opacity", 1)
      .style("stroke-width", 2);

    tooltip
      .style("opacity", 1)
      .html(`
        <strong>${d.key}</strong><br>

        <strong>${measureLabels[selectedMetric]}</strong><br><br>

        Median: ${d.median.toFixed(2)}<br>
        IQR: ${d.iqr.toFixed(2)}<br>
        Minimum: ${d.min.toFixed(2)}<br>
        Maximum: ${d.max.toFixed(2)}
      `);
    })

    .on("mousemove", function(event) {

        tooltip
          .style("left", `${event.pageX + 14}px`)
          .style("top", `${event.pageY - 28}px`);
    })

    .on("mouseout", function() {

        d3.select(this)
          .style("opacity", 0.8)
          .style("stroke-width", 1);

        tooltip.style("opacity", 0);
    });

    // svg.selectAll(".points")
    // .data(data)
    // .join("circle")
    // .attr("cx", d =>
    //     x(d.crop_zone)
    //     + x.bandwidth()/2
    //     + (Math.random() - 0.5) * 20
    // )
    // .attr("cy", d => y(+d[selectedMetric]))
    // .attr("r", 2)
    // .style("fill", "black")
    // .style("opacity", 0.3)

    // .on("mouseover", function(event, d) {
    //   d3.select(this)
    //     .style("fill", "orange");

    //   tooltip
    //     .style("opacity", 1)
    //     .html(`
    //       <strong>${d.crop_zone}</strong><br>
    //       ${measureLabels[selectedMetric]}: ${d[selectedMetric].toFixed(2)}<br>
    //       Crop Density Proxy: ${d.crop_density.toFixed(2)}<br>
    //       Lon: ${d.lon.toFixed(2)}, Lat: ${d.lat.toFixed(2)}
    //     `);
    // })
    // .on("mousemove", function(event) {
    //   tooltip
    //     .style("left", `${event.pageX + 14}px`)
    //     .style("top", `${event.pageY - 28}px`);
    // })
    // .on("mouseout", function(event, d) {

    // d3.select(this)
    //     .style("fill", "black");

    // });

  drawLegend(svg, width - 30, -10);

  hideChartSkeleton("violinplot");
}


function drawLegend(svg, x, y) {
  const zones = ["Non-Agricultural", "Sparse Crops", "Intense Cropland"];

  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${x},${y})`);

  legend.append("rect")
    .attr("x", -10)
    .attr("y", -18)
    .attr("width", 170)
    .attr("height", 84)
    .attr("rx", 8)
    .attr("fill", "white")
    .attr("opacity", 0.85);

  zones.forEach((zone, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0,${i * 22})`);

    row.append("circle")
      .attr("r", 6)
      .attr("fill", colorScale(zone));

    row.append("text")
      .attr("x", 12)
      .attr("y", 4)
      .text(zone);
  });
}

function drawBarChart() {
  const measure = getCurrentMeasure();
  const selectedZone = getCurrentZone();
  const summaryCol = summaryColumns[measure];

  let data = summaryData;

  if (selectedZone !== "All") {
    data = summaryData.filter(d => d.crop_zone === selectedZone);
  }

  d3.select("#barchart").selectAll("*").remove();

  const margin = { top: 35, right: 25, bottom: 90, left: 70 };
  const outerWidth = 480;
  const outerHeight = 500;
  const width = outerWidth - margin.left - margin.right;
  const height = outerHeight - margin.top - margin.bottom;

  const svg = d3.select("#barchart")
    .append("svg")
    .attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(data.map(d => d.crop_zone))
    .range([0, width])
    .padding(0.25);

  const yMax = d3.max(summaryData, d => d[summaryCol]) || 1;

  const y = d3.scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([height, 0]);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-25)")
    .attr("text-anchor", "end");

  g.append("g")
    .call(d3.axisLeft(y));

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .text(`Average ${measureLabels[measure]}`);

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", d => x(d.crop_zone))
    .attr("y", d => y(d[summaryCol]))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d[summaryCol]))
    .attr("fill", d => colorScale(d.crop_zone))
    .on("mouseover", function(event, d) {
      d3.select(this).attr("opacity", 0.75);

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.crop_zone}</strong><br>
          Average ${measureLabels[measure]}: ${d[summaryCol].toFixed(2)}<br>
          Average Crop Density: ${d.avg_crop_density.toFixed(2)}<br>
          Pixels: ${d.count}
        `);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", `${event.pageX + 14}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      d3.select(this).attr("opacity", 1);
      tooltip.style("opacity", 0);
    });

  g.selectAll(".bar-label")
    .data(data)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.crop_zone) + x.bandwidth() / 2)
    .attr("y", d => y(d[summaryCol]) - 8)
    .attr("text-anchor", "middle")
    .text(d => d[summaryCol].toFixed(1));

  hideChartSkeleton("barchart");
}

function drawMap() {
  const measure = getCurrentMeasure();
  const data = getFilteredPoints();

  const mapWidth = 900;
  const mapHeight = 550;

  d3.select("#map").selectAll("svg").remove();
  showMapSkeleton();

  if (!data.length) {
    hideMapSkeleton();
    return;
  }

  console.log("drawMap() called with measure:", measure);

  loadUsTopo().then(us => {
    if (!conusStatesCached) {
      conusStatesCached = buildConusFromTopo(us);
    }

    const svg = d3.select("#map")
      .append("svg")
      .attr("width", mapWidth)
      .attr("height", mapHeight)
      .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
      .attr("class", "map-svg");

    const projection = d3.geoAlbers()
      .fitSize([mapWidth, mapHeight], conusStatesCached);

    const path = d3.geoPath().projection(projection);

    const mapLayer = svg.append("g")
      .attr("class", "map-layer");

    svg.call(
      d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [mapWidth, mapHeight]])
        .extent([[0, 0], [mapWidth, mapHeight]])
        .on("zoom", event => {
          mapLayer.attr("transform", event.transform);
        })
    );

    mapLayer.append("g")
      .attr("class", "states")
      .selectAll("path")
      .data(conusStatesCached.features)
      .join("path")
      .attr("d", path)
      .attr("class", "state");

    const values = data
      .map(d => +d[measure])
      .filter(Number.isFinite);

    const [minVal, maxVal] = getNiceExtent(values);

    console.log("Color scale domain:", minVal, "to", maxVal);

    const colorScale = d3.scaleSequential()
      .domain([minVal, maxVal])
      .interpolator(mapLayerInterpolators[measure] || d3.interpolateYlOrRd);

    const projectedPoints = data
      .map(d => {
        const coords = projection([d.lon, d.lat]);
        return coords && Array.isArray(coords) ? { ...d, proj: coords, mapValue: +d[measure] } : null;
      })
      .filter(d => {
        if (!d || !Array.isArray(d.proj)) return false;
        const x = d.proj[0];
        const y = d.proj[1];
        return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= mapWidth && y >= 0 && y <= mapHeight;
      });

    const pointsGroup = mapLayer.append("g")
      .attr("class", "data-points");

    pointsGroup.selectAll("circle")
      .data(projectedPoints)
      .join("circle")
      .attr("cx", d => d.proj[0])
      .attr("cy", d => d.proj[1])
      .attr("r", 1.5)
      .attr("fill", d => colorScale(d.mapValue))
      .attr("opacity", 0.55)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("r", 5)
          .attr("opacity", 1);

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>${measureLabels[measure]}: ${d.mapValue.toFixed(2)}</strong><br>
            Crop Zone: ${d.crop_zone}<br>
            Lon: ${d.lon.toFixed(2)}, Lat: ${d.lat.toFixed(2)}<br>
            Crop Density: ${d.crop_density.toFixed(0)}
          `);
      })      .on("mousemove", function(event) {
        tooltip
          .style("left", `${event.pageX + 14}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("r", 1.5)
          .attr("opacity", 0.55);

        tooltip.style("opacity", 0);
      });

    const legendWidth = 280;
    const legendHeight = 20;
    const legendX = mapWidth / 2 - legendWidth / 2 + 55;
    const legendY = 20;

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%");

    const interp = mapLayerInterpolators[measure] || d3.interpolateYlOrRd;
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", interp(t));
    }

    svg.append("text")
      .attr("class", "legend-title")
      .attr("x", legendX + legendWidth / 2)
      .attr("y", legendY - 8)
      .text(`${measureLabels[measure]} Scale`);

    svg.append("rect")
      .attr("class", "legend-bar")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", "url(#legend-gradient)")
      .attr("stroke", "#999")
      .attr("stroke-width", 1);

    const legendScale = d3.scaleLinear()
      .domain([minVal, maxVal])
      .range([legendX, legendX + legendWidth]);

    svg.append("text")
      .attr("class", "legend-label")
      .attr("x", legendX)
      .attr("y", legendY + legendHeight + 25)
      .attr("text-anchor", "start")
      .text(minVal.toFixed(1));

    svg.append("text")
      .attr("class", "legend-label")
      .attr("x", legendX + legendWidth)
      .attr("y", legendY + legendHeight + 25)
      .attr("text-anchor", "end")
      .text(maxVal.toFixed(1));

    console.log("Map rendered successfully with", data.length, "data points");

    requestAnimationFrame(() => svg.classed("is-ready", true));
    hideMapSkeleton();

  }).catch(error => {
    console.error("Error loading TopoJSON:", error);
    hideMapSkeleton();
  });
}
