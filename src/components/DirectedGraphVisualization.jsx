import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

const DirectedGraphVisualization = ({ graph, startNode, endNode, getStationName, destinationNode }) => {
  const d3Container = useRef(null);
  const [path, setPath] = useState([]);
  const [tooltipContent, setTooltipContent] = useState('');

  const findPaths = useCallback((start, end, graph) => {
    const paths = [];
    const visited = new Set();

    const dfs = (current, path) => {
      if (current === end) {
        paths.push([...path, current]);
        return;
      }

      visited.add(current);

      if (graph[current]) {
        for (const neighbor of graph[current]) {
          if (!visited.has(neighbor.to)) {
            dfs(neighbor.to, [...path, current]);
          }
        }
      }

      visited.delete(current);
    };

    dfs(start, []);
    return paths;
  }, []);

  useEffect(() => {
    if (graph && Object.keys(graph).length > 0 && d3Container.current) {
      const svg = d3.select(d3Container.current);
      svg.selectAll("*").remove(); // Clear previous content

      const width = 1000;
      const height = 600;

      // Create a force simulation with adjusted parameters
      const simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.id).distance(50))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(30));

      // Process the graph data
      const nodes = [...new Set(Object.keys(graph).concat(Object.values(graph).flatMap(edges => edges.map(e => e.to))))]
        .map(node => ({ id: node }));
      const links = Object.entries(graph).flatMap(([source, targets]) =>
        targets.map(target => ({ source, target: target.to }))
      );

      // Create the link lines
      const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)");

      // Create the node circles
      const node = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

      node.append("circle")
        .attr("r", 15)
        .attr("fill", "#69b3a2")
        .on("mouseover", function(event, d) {
          setTooltipContent(`Station: ${getStationName(d.id)}`);
        })
        // .on("mouseout", function() {
        //   setTooltipContent('');
        // })
        .on("click", function(event, d) {
          if (destinationNode) {
            const paths = findPaths(d.id, destinationNode, graph);
            highlightClickedPaths(paths);
          }
        });

      node.append("text")
        .text(d => d.id)
        .attr('x', 0)
        .attr('y', 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', 'white');

      // Add arrowhead marker
      svg.append("defs").selectAll("marker")
        .data(["end"])
        .enter().append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 22)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999");

      // Update positions on each tick of the simulation
      simulation.nodes(nodes).on("tick", ticked);
      simulation.force("link").links(links);

      function ticked() {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        node
          .attr("transform", d => `translate(${d.x},${d.y})`);
      }

      function highlightClickedPaths(paths) {
        // Reset all links and nodes
        link.attr("stroke", "#999").attr("stroke-width", 2);
        node.select("circle").attr("fill", "#69b3a2");

        // Highlight all paths
        paths.forEach((path, index) => {
          const color = d3.schemeCategory10[index % 10]; // Use different colors for each path
          for (let i = 0; i < path.length - 1; i++) {
            const source = path[i];
            const target = path[i + 1];
            link.filter(l => 
              (l.source.id === source && l.target.id === target) || 
              (l.source.id === target && l.target.id === source)
            )
              .attr("stroke", color)
              .attr("stroke-width", 4);
          }
        });

        // Highlight start and end nodes
        if (paths.length > 0) {
          const startNode = paths[0][0];
          const endNode = paths[0][paths[0].length - 1];
          node.filter(n => n.id === startNode || n.id === endNode)
            .select("circle")
            .attr("fill", "red");
        }
      }

      // Drag functions
      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }

      // Zoom functionality
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          svg.selectAll("g").attr("transform", event.transform);
        });

      svg.call(zoom);
    }
  }, [graph, startNode, endNode, getStationName, destinationNode, findPaths]);

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="d3-component"
        width={1000}
        height={600}
        ref={d3Container}
      />
      {tooltipContent && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'white',
            padding: '5px',
            border: '1px solid black',
            borderRadius: '5px',
          }}
        >
          {tooltipContent}
        </div>
      )}
    </div>
  );
};

export default DirectedGraphVisualization;