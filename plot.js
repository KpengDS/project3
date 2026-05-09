const width = 960, height = 500;
const svg = d3.select("body").append("svg").attr("width", width).attr("height", height);

// 1. Define the projection (equivalent to ccrs.PlateCarree)
const projection = d3.geoEquirectangular()
    .scale(150)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// 2. Load and draw the "Coastlines" (GeoJSON)
d3.json("us-states.json").then(geoData => {
    svg.append("path")
       .datum(geoData)
       .attr("d", path)
       .attr("fill", "none")
       .attr("stroke", "black");
});

// 3. Add the NASA Images (Equivalent to ax.imshow)
// Note: You can use the same URLs as your Python code!
svg.append("image")
    .attr("xlink:href", "YOUR_NASA_WMS_URL_HERE")
    .attr("width", width)
    .attr("height", height)
    .attr("opacity", 0.5); 