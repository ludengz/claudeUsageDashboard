const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#4ade80', '#ef4444', '#ec4899', '#06b6d4'];

export function renderProjectDistribution(container, data) {
  const el = d3.select(container);
  el.selectAll('*').remove();

  if (!data.projects || data.projects.length === 0) {
    el.append('p').style('color', '#64748b').text('No data');
    return;
  }

  const margin = { top: 10, right: 80, bottom: 10, left: 120 };
  const barHeight = 24;
  const gap = 8;
  const height = data.projects.length * (barHeight + gap) + margin.top + margin.bottom;
  const width = container.clientWidth - margin.left - margin.right;

  const svg = el.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(data.projects, d => d.total_tokens)]).range([0, width]);
  const y = d3.scaleBand().domain(data.projects.map(d => d.name)).range([0, height - margin.top - margin.bottom]).padding(0.25);

  svg.selectAll('.project-label').data(data.projects).enter().append('text')
    .attr('x', -8).attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
    .style('fill', '#e2e8f0').style('font-size', '12px').text(d => d.name);

  svg.selectAll('.bar').data(data.projects).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.name))
    .attr('width', d => x(d.total_tokens)).attr('height', y.bandwidth())
    .attr('fill', (_, i) => COLORS[i % COLORS.length]).attr('rx', 3);

  svg.selectAll('.token-label').data(data.projects).enter().append('text')
    .attr('x', d => x(d.total_tokens) + 8).attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('dominant-baseline', 'middle')
    .style('fill', '#94a3b8').style('font-size', '11px')
    .text(d => d3.format('.2s')(d.total_tokens) + ' tokens');
}
