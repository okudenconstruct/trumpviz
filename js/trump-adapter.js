/* TrumpViz adapter: draws a circular arc diagram from claims data.
   It accepts either:
   - cfg.data  (already-parsed JSON object), or
   - cfg.claimsUrl (a URL to a JSON file)
*/
(function(global){
  const TrumpAdapter = {};

  function positionOnCircle({t, total, cx, cy, radius}) {
    const theta = (t / total) * Math.PI * 2; // 0..2π
    const x = cx + radius * Math.cos(theta - Math.PI/2);
    const y = cy + radius * Math.sin(theta - Math.PI/2);
    return {x,y,theta};
  }

  TrumpAdapter.init = async function(selector, opts){
    const cfg = Object.assign({
      width: 1200,
      height: 900,
      radius: 420,
      claimsUrl: null,
      data: null,
      filter: {}
    }, opts||{});

    const svg = d3.select(selector)
      .attr('width', cfg.width)
      .attr('height', cfg.height);

    const cx = cfg.width/2, cy = cfg.height/2 + 40;

    // ---- Load data (either from cfg.data or from URL) ----
    let data;
    if (cfg.data) {
      data = cfg.data;
    } else if (cfg.claimsUrl) {
      data = await d3.json(cfg.claimsUrl);
    } else {
      throw new Error('Provide either cfg.data or cfg.claimsUrl');
    }

    const nodesAll = data.nodes || [];
    const edgesAll = data.edges || [];
    const total = nodesAll.length;

    // Precompute positions on circle
    nodesAll.forEach(d => {
      const p = positionOnCircle({t: d.t, total, cx, cy, radius: cfg.radius});
      d.x = p.x; d.y = p.y; d.theta = p.theta;
    });

    // Simple filters
    function keep(d){
      const f = cfg.filter || {};
      if (f.category && d.category !== f.category) return false;
      if (typeof f.pinocchios === 'number' && d.pinocchios !== f.pinocchios) return false;
      if (f.start && d.date && d.date < f.start) return false;
      if (f.end && d.date && d.date > f.end) return false;
      return true;
    }

    const keepIds = new Set(nodesAll.filter(keep).map(d=>d.id));
    const nodes = keepIds.size ? nodesAll.filter(d => keepIds.has(d.id)) : nodesAll;
    const edges = keepIds.size ? edgesAll.filter(e => keepIds.has(e.source) && keepIds.has(e.target)) : edgesAll;

    // Baseline circle
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', cfg.radius)
      .attr('fill','none').attr('stroke','#eee');

    const gLinks = svg.append('g');
    const gNodes = svg.append('g');

    // Links (quadratic arcs)
    const links = gLinks.selectAll('path.link')
      .data(edges)
      .join('path')
      .attr('class','link')
      .attr('fill','none')
      .attr('stroke','rgba(0,0,0,0.18)')
      .attr('stroke-width',1)
      .attr('d', d => {
        const a = nodesAll.find(n => n.id === d.source);
        const b = nodesAll.find(n => n.id === d.target);
        if(!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.12; // arc lift
        return `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
      });

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class','tt')
      .style('display','none');

    // Nodes
    const nodesSel = gNodes.selectAll('circle.node')
      .data(nodes, d=>d.id)
      .join('circle')
      .attr('class','node')
      .attr('r', 2)
      .attr('cx', d=>d.x)
      .attr('cy', d=>d.y)
      .on('mouseenter', (ev, d) => {
        const connected = new Set();
        edges.forEach(e=>{
          if(e.source === d.id) connected.add(e.target);
          if(e.target === d.id) connected.add(e.source);
        });
        nodesSel.classed('dim', nd => nd.id !== d.id && !connected.has(nd.id));
        links.classed('dim', e => !(e.source === d.id || e.target === d.id))
             .classed('highlight', e => (e.source === d.id || e.target === d.id));
        tooltip.style('display','block')
          .style('left', (ev.clientX+12)+'px')
          .style('top', (ev.clientY+12)+'px')
          .html(`
            <div class="claim">${d.claim || '(no text)'}</div>
            <div class="meta">
              <div><strong>Date:</strong> ${d.date||'—'} <span class="badge">${d.category||'Misc'}</span></div>
              <div><strong>Pinocchios:</strong> ${d.pinocchios ?? '—'} | <strong>Location:</strong> ${d.location||'—'}</div>
            </div>
            <div style="margin-top:6px">${(d.analysis||'').slice(0,400)}${(d.analysis||'').length>400?'…':''}</div>
          `);
      })
      .on('mouseleave', () => {
        nodesSel.classed('dim', false);
        links.classed('dim', false).classed('highlight', false);
        tooltip.style('display','none');
      });
  };

  global.TrumpAdapter = TrumpAdapter;
})(window);
