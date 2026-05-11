const pointFile = "data/crop_precip_points.csv";
const summaryFile = "data/crop_zone_summary.csv";

const measureLabels = {
  precip_intensity: "Overall Precipitation Proxy",
  rain_proxy: "Rain Proxy",
  snow_proxy: "Snow Proxy"
};

const summaryColumns = {
  precip_intensity: "avg_precip",
  rain_proxy: "avg_rain",
  snow_proxy: "avg_snow"
};

const colorScale = d3.scaleOrdinal()
  .domain(["Non-Agricultural", "Sparse Crops", "Intense Cropland"])
  .range(["#bdbdbd", "#f2a65a", "#7a3e12"]);

const tooltip = d3.select("#tooltip");

let pointsData;
let summaryData;

let currentMetric = "precip_intensity";

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
  }))
])
.then(([points, summary]) => {

  console.log(points);
  console.log(summary);

  pointsData = points;
  summaryData = summary;

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

function updateMapTitle() {
  const measure = getCurrentMeasure();

  const titleMap = {
    precip_intensity: "Overall Precipitation Across the United States",
    rain_proxy: "Rain Intensity Across the United States",
    snow_proxy: "Snow Intensity Across the United States"
  };

  const descriptionMap = {
    precip_intensity: "This map shows the spatial distribution of data points colored by overall precipitation intensity. Darker shades indicate higher intensity values. Use the precipitation measure dropdown above to change the visualization.",
    rain_proxy: "This map shows the spatial distribution of data points colored by rain intensity. Darker shades indicate higher rain intensity values. Use the precipitation measure dropdown above to change the visualization.",
    snow_proxy: "This map shows the spatial distribution of data points colored by snow intensity. Darker shades indicate higher snow intensity values. Use the precipitation measure dropdown above to change the visualization."
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
    const selectedMetric = currentMetric;

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
    .filter(v => !isNaN(v));

    const y = d3.scaleLinear()
    .domain(d3.extent(values))
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
}

function drawMap() {
  const measure = getCurrentMeasure();
  const data = getFilteredPoints();

  if (!data.length) return;

  d3.select("#map").selectAll("*").remove();

  const mapWidth = 900;
  const mapHeight = 550;

  console.log("drawMap() called with metric:", measure);

  // Load US states TopoJSON
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
    console.log("TopoJSON loaded:", us);

    // Create SVG with proper dimensions
    const svg = d3.select("#map")
      .append("svg")
      .attr("width", mapWidth)
      .attr("height", mapHeight)
      .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
      .attr("class", "map-svg");

    // Get US states feature and fit projection
    const usStates = topojson.feature(us, us.objects.states);
    console.log("US States feature:", usStates);

    // Create projection fitted to US states
    const projection = d3.geoAlbersUsa()
      .fitSize([mapWidth, mapHeight], usStates);

    const path = d3.geoPath().projection(projection);

    // Draw state boundaries
    svg.append("g")
      .attr("class", "states")
      .selectAll("path")
      .data(usStates.features)
      .join("path")
      .attr("d", path)
      .attr("class", "state");

    console.log("States drawn. Total states:", usStates.features.length);

    // Get value range for color scale
    const values = data
      .map(d => +d[measure])
      .filter(v => !isNaN(v));

    const minVal = d3.min(values);
    const maxVal = d3.max(values);

    console.log("Color scale domain:", minVal, "to", maxVal);

    // Color scale for precipitation metrics
    const colorScale = d3.scaleSequential()
      .domain([minVal, maxVal])
      .interpolator(d3.interpolateYlOrRd);

    // Filter points to reasonable US geographic ranges before drawing
    const filteredPoints = data.filter(d => {
      const lon = +d.lon;
      const lat = +d.lat;
      const continental = lon >= -125 && lon <= -66 && lat >= 24 && lat <= 50;
      const alaska = lon >= -170 && lon <= -130 && lat >= 50 && lat <= 72;
      const hawaii = lon >= -161 && lon <= -154 && lat >= 18 && lat <= 23;
      return continental || alaska || hawaii;
    });

    // Draw data points
    const pointsGroup = svg.append("g")
      .attr("class", "data-points");

    pointsGroup.selectAll("circle")
      .data(filteredPoints)
      .join("circle")
      .attr("cx", d => {
        const coords = projection([d.lon, d.lat]);
        return coords ? coords[0] : 0;
      })
      .attr("cy", d => {
        const coords = projection([d.lon, d.lat]);
        return coords ? coords[1] : 0;
      })
      .attr("r", 2)
      .attr("fill", d => colorScale(d[measure]))
      .attr("opacity", 0.65)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("r", 5)
          .attr("opacity", 1);

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>${measureLabels[measure]}: ${d[measure].toFixed(2)}</strong><br>
            Crop Zone: ${d.crop_zone}<br>
            Lon: ${d.lon.toFixed(2)}, Lat: ${d.lat.toFixed(2)}<br>
            Crop Density: ${d.crop_density.toFixed(0)}
          `);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", `${event.pageX + 14}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("r", 2)
          .attr("opacity", 0.65);

        tooltip.style("opacity", 0);
      });

    // Add gradient legend
    const legendWidth = 280;
    const legendHeight = 20;
    const legendX = mapWidth - legendWidth - 30;
    const legendY = 60;

    // Create defs for gradient
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%");

    // Add color stops from YlOrRd
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", d3.interpolateYlOrRd(t));
    }

    // Legend title
    svg.append("text")
      .attr("class", "legend-title")
      .attr("x", legendX + legendWidth / 2)
      .attr("y", legendY - 12)
      .text("Precipitation Intensity Scale");

    // Legend background rect
    svg.append("rect")
      .attr("class", "legend-bar")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", "url(#legend-gradient)")
      .attr("stroke", "#999")
      .attr("stroke-width", 1);

    // Legend scale
    const legendScale = d3.scaleLinear()
      .domain([minVal, maxVal])
      .range([legendX, legendX + legendWidth]);

    // Min value text
    svg.append("text")
      .attr("class", "legend-label")
      .attr("x", legendX)
      .attr("y", legendY + legendHeight + 18)
      .attr("text-anchor", "start")
      .text(minVal.toFixed(1));

    // Max value text
    svg.append("text")
      .attr("class", "legend-label")
      .attr("x", legendX + legendWidth)
      .attr("y", legendY + legendHeight + 18)
      .attr("text-anchor", "end")
      .text(maxVal.toFixed(1));

    console.log("Map rendered successfully with", data.length, "data points");

  }).catch(error => {
    console.error("Error loading TopoJSON:", error);
  });
}