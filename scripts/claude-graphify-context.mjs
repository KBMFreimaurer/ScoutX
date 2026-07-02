#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_GRAPH_PATH = "graphify-out/graph.json";
const DEFAULT_MAX_NODES = 40;
const DEFAULT_MAX_EDGES = 80;

function readArgs(argv) {
  const options = {
    graphPath: process.env.GRAPHIFY_GRAPH || DEFAULT_GRAPH_PATH,
    format: "markdown",
    query: "",
    file: "",
    list: false,
    maxNodes: DEFAULT_MAX_NODES,
    maxEdges: DEFAULT_MAX_EDGES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--list") {
      options.list = true;
    } else if (arg === "--graph" && next) {
      options.graphPath = next;
      index += 1;
    } else if (arg === "--query" && next) {
      options.query = next;
      index += 1;
    } else if (arg === "--file" && next) {
      options.file = next;
      index += 1;
    } else if (arg === "--format" && next) {
      options.format = next;
      index += 1;
    } else if (arg === "--max-nodes" && next) {
      options.maxNodes = Math.max(1, Number.parseInt(next, 10) || DEFAULT_MAX_NODES);
      index += 1;
    } else if (arg === "--max-edges" && next) {
      options.maxEdges = Math.max(1, Number.parseInt(next, 10) || DEFAULT_MAX_EDGES);
      index += 1;
    }
  }

  return options;
}

function usage() {
  return `Claude Graphify Context

Usage:
  npm run claude:graphify
  npm run claude:graphify -- --query SetupContext
  npm run claude:graphify -- --file src/services/dataProvider.js

Options:
  --query <text>       Find matching graph nodes by label, id, or source file.
  --file <path>        Focus on one source file and its direct graph neighbors.
  --graph <path>       Graphify JSON path. Default: ${DEFAULT_GRAPH_PATH}
  --max-nodes <n>      Maximum nodes in focused output. Default: ${DEFAULT_MAX_NODES}
  --max-edges <n>      Maximum edges in focused output. Default: ${DEFAULT_MAX_EDGES}
  --list              Print compact file/module index only.
  --format <md|json>  Output format. Default: markdown
`;
}

function loadGraph(graphPath) {
  const absolutePath = resolve(graphPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Graphify graph not found: ${graphPath}`);
  }

  const graph = JSON.parse(readFileSync(absolutePath, "utf8"));
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  return { graph, nodes, edges, absolutePath };
}

function textOf(value) {
  return String(value || "").trim();
}

function includesNeedle(value, needle) {
  return textOf(value).toLowerCase().includes(needle);
}

function nodeName(node) {
  const location = node.source_location ? `:${node.source_location}` : "";
  const source = node.source_file ? ` (${node.source_file}${location})` : "";
  return `${node.label || node.id}${source}`;
}

function edgeName(edge, nodeById) {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  return `${source?.label || edge.source} -[${edge.relation || "related"}]-> ${target?.label || edge.target}`;
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function degreeIndex(edges) {
  const degree = new Map();

  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }

  return degree;
}

function selectSeeds(nodes, options) {
  const query = textOf(options.query).toLowerCase();
  const file = textOf(options.file).replaceAll("\\", "/");

  if (!query && !file) {
    return [];
  }

  return nodes.filter((node) => {
    if (file && textOf(node.source_file).replaceAll("\\", "/").includes(file)) {
      return true;
    }

    if (!query) {
      return false;
    }

    return (
      includesNeedle(node.id, query) ||
      includesNeedle(node.label, query) ||
      includesNeedle(node.source_file, query) ||
      includesNeedle(node.type, query)
    );
  });
}

function focusedGraph(nodes, edges, seeds, options) {
  const seedIds = new Set(seeds.map((node) => node.id));
  const relatedEdges = [];
  const relatedIds = new Set(seedIds);

  for (const edge of edges) {
    if (seedIds.has(edge.source) || seedIds.has(edge.target)) {
      relatedEdges.push(edge);
      relatedIds.add(edge.source);
      relatedIds.add(edge.target);
    }
  }

  const degree = degreeIndex(edges);
  const selectedNodes = nodes
    .filter((node) => relatedIds.has(node.id))
    .sort((a, b) => {
      const seedDelta = Number(seedIds.has(b.id)) - Number(seedIds.has(a.id));
      return seedDelta || (degree.get(b.id) || 0) - (degree.get(a.id) || 0) || nodeName(a).localeCompare(nodeName(b));
    })
    .slice(0, options.maxNodes);

  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  const selectedEdges = relatedEdges
    .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .slice(0, options.maxEdges);

  return { selectedNodes, selectedEdges };
}

function summarize({ nodes, edges, absolutePath }, options) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const relationCounts = countBy(edges, (edge) => edge.relation).slice(0, 12);
  const fileCounts = countBy(nodes, (node) => node.source_file).slice(0, 30);
  const degree = degreeIndex(edges);
  const hubs = [...degree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, count]) => ({ node: nodeById.get(id), count }))
    .filter(({ node }) => node);
  const seeds = selectSeeds(nodes, options);
  const focus = focusedGraph(nodes, edges, seeds, options);

  return {
    graphPath: absolutePath,
    totals: { nodes: nodes.length, edges: edges.length },
    relationCounts,
    fileCounts,
    hubs,
    seeds,
    focus,
  };
}

function renderMarkdown(summary, options) {
  const lines = [];
  lines.push("# ScoutX Graphify Context");
  lines.push("");
  lines.push(`Graph: ${summary.graphPath}`);
  lines.push(`Nodes: ${summary.totals.nodes}`);
  lines.push(`Edges: ${summary.totals.edges}`);
  lines.push("");

  if (options.list) {
    lines.push("## File Index");
    for (const [file, count] of summary.fileCounts) {
      lines.push(`- ${file}: ${count} graph nodes`);
    }
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Working Rule For Claude Fable 5");
  lines.push("- Use this graph summary before broad repository reads.");
  lines.push("- Open raw files only for nodes that are directly relevant to the requested change.");
  lines.push("- Prefer file-local neighbors and dependency edges over scanning whole folders.");
  lines.push("");

  lines.push("## Relations");
  for (const [relation, count] of summary.relationCounts) {
    lines.push(`- ${relation}: ${count}`);
  }
  lines.push("");

  lines.push("## High-Degree Nodes");
  for (const { node, count } of summary.hubs) {
    lines.push(`- ${nodeName(node)}: degree ${count}`);
  }

  if (summary.seeds.length > 0) {
    lines.push("");
    lines.push("## Focus");
    lines.push(`Seeds: ${summary.seeds.length}`);
    lines.push("");
    lines.push("### Nodes");
    for (const node of summary.focus.selectedNodes) {
      lines.push(`- ${node.id}: ${nodeName(node)}`);
    }
    lines.push("");
    lines.push("### Edges");
    const nodeById = new Map(summary.focus.selectedNodes.map((node) => [node.id, node]));
    for (const edge of summary.focus.selectedEdges) {
      lines.push(`- ${edgeName(edge, nodeById)}`);
    }
  } else if (options.query || options.file) {
    lines.push("");
    lines.push("## Focus");
    lines.push("No graph nodes matched the requested query/file.");
  } else {
    lines.push("");
    lines.push("## File Index");
    for (const [file, count] of summary.fileCounts.slice(0, 15)) {
      lines.push(`- ${file}: ${count} graph nodes`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderJson(summary) {
  return `${JSON.stringify(
    {
      graphPath: summary.graphPath,
      totals: summary.totals,
      relations: Object.fromEntries(summary.relationCounts),
      files: Object.fromEntries(summary.fileCounts),
      hubs: summary.hubs.map(({ node, count }) => ({ id: node.id, label: node.label, source_file: node.source_file, count })),
      focus: {
        seeds: summary.seeds.map((node) => ({ id: node.id, label: node.label, source_file: node.source_file })),
        nodes: summary.focus.selectedNodes,
        edges: summary.focus.selectedEdges,
      },
    },
    null,
    2,
  )}\n`;
}

function main() {
  const options = readArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const graphData = loadGraph(options.graphPath);
  const summary = summarize(graphData, options);
  const format = options.format.toLowerCase();

  if (format === "json") {
    process.stdout.write(renderJson(summary));
    return;
  }

  process.stdout.write(renderMarkdown(summary, options));
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
