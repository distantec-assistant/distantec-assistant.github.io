const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../src/model.cjs');

const unique = xs => [...new Set(xs)];
const distances = (map, from, skip = []) => {
  // Independent graph oracle, not the model's edge/neighbours or nextHop.
  const d = new Map([[from,0]]), queue = [from];
  for (const here of queue) for (const [a,b] of map.trails) {
    const there = here === a ? b : here === b ? a : null;
    if (there && !skip.includes(there) && !d.has(there)) {
      d.set(there, d.get(here)+1); queue.push(there);
    }
  }
  return d;
};

test('four chapters of six, with distinct locations, stories and graph shapes', () => {
  const maps = M.MAPS;
  assert.equal(maps.length,24);
  for (const key of ['id','title','land','briefing']) assert.equal(unique(maps.map(m=>m[key])).length,24,key);
  assert.deepEqual(unique(maps.map(m=>m.theme)).sort(),['coast','meadow','orchard','snow','stream','village']);
  assert.deepEqual(unique(maps.map(m=>m.recipient)).sort(),['beaver','fox','hedgehog','lighthouse','otter','owl','penguin','squirrel']);
  assert.deepEqual(unique(maps.flatMap(m=>m.objectives.map(o=>o.icon))).sort(),['apple','key','light','parcel','stamp','star']);
  const shapes = new Map();
  for (const [i,m] of maps.entries()) {
    assert.equal(m.number,i+1); assert.equal(m.chapter,1+Math.floor(i/6));
    assert.ok(/^[a-z][a-z0-9-]*$/.test(m.id)); assert.match(m.briefing,/[а-яё]/i);
    assert.ok(Object.isFrozen(m.places) && Object.isFrozen(m.objectives));
    const ids = Object.keys(m.places), names = Object.values(m.places).map(p=>p.name);
    assert.equal(unique(names).length,ids.length,m.id);
    assert.equal(unique([m.start,...m.objectives.map(o=>o.at),m.goal]).length,2+m.objectives.length);
    assert.ok(m.objectives.length <= 2);
    assert.equal(m.objectives.length === 0,i===0 || i===2);
    for (const o of m.objectives) { assert.ok(ids.includes(o.at)); assert.match(o.label,/^[А-ЯЁа-яё -]+$/); }
    for (const p of Object.values(m.places)) {
      const [x,y] = p.at; assert.ok(x>=45 && x<=555 && y<=322 && (y>=75 || (m.id==='coast' && p===m.places.windmill)),m.id);
    }
    assert.ok(m.places[m.goal].at[1]>=120,m.id);
    // Isomorphic graphs have identical multisets of vertex distance profiles.
    // Distinct fingerprints thus rule out even renamed/rotated/reflected copies.
    const shape = ids.map(id=>[...distances(m,id).values()].sort((a,b)=>a-b).join(',')).sort().join(';');
    assert.ok(!shapes.has(shape),`same graph profile: ${m.id} / ${shapes.get(shape)}`); shapes.set(shape,m.id);
  }
  assert.equal(maps[1].stamp,'lilies'); assert.deepEqual(maps[1].objectives.map(o=>[o.at,o.icon]),[['lilies','stamp']]);
});

test('the second stop and early recipient are genuine choices, not unavoidable stepping stones', () => {
  assert.ok(M.MAPS.some(m=>m.objectives?.length===2),'ordered deliveries exist');
  for (const m of M.MAPS) {
    for (const o of m.objectives) {
      assert.ok(distances(m,m.start,[o.at]).has(m.goal),`${m.id}: can try delivering without ${o.at}`);
      assert.ok(distances(m,m.start,[m.goal,...m.objectives.filter(p=>p!==o).map(p=>p.at)]).has(o.at),`${m.id}: independent ${o.at}`);
    }
  }
});

test('delivery length increases by chapter; two-item routes offer loops, not just longer corridors', () => {
  let previousTotal=0;
  for (const chapter of [1,2,3,4]) {
    let total=0;
    for (const m of M.MAPS.filter(m=>m.chapter===chapter)) {
      const stops=[m.start,...m.objectives.map(o=>o.at),m.goal];
      const moves=stops.slice(1).reduce((n,target,i)=>n+distances(m,stops[i]).get(target),0);
      assert.ok(moves>=3 && moves<=12,m.id);
      if (chapter>2) {
        assert.equal(m.objectives.length,2,m.id);
        assert.notEqual(m.objectives[0].icon,m.objectives[1].icon,m.id);
        assert.ok(m.trails.length>=Object.keys(m.places).length,m.id);
      } else assert.ok(m.objectives.length<=1,m.id);
      total+=moves;
    }
    assert.ok(total>previousTotal,`chapter ${chapter}`); previousTotal=total;
  }
});

test('planning through a pickup changes the projected target, never the actual delivery', () => {
  const m=M.MAPS.find(m=>m.id==='apple-box'), start=Object.freeze(M.start(m));
  const plan=M.preview(m,start,['bench','bough']);
  assert.ok(M.ready(plan)); assert.deepEqual(plan.moves.map(move=>move.state.collected),[0,1]);
  const next=M.nextHop(m,plan.state), target=m.objectives[1].at, d=distances(m,target);
  assert.equal(d.get(next),d.get(plan.state.at)-1);
  assert.equal(start.collected,0); assert.equal(start.at,m.start);
  assert.equal(M.preview(m,start,[]).state,start);
});

test('every reachable state: order, stamp compatibility, shortest hint, pure preview, gated delivery', () => {
  assert.equal(typeof M.nextHop,'function');
  for (const m of M.MAPS) {
    const queue=[M.start(m)], seen=new Set(), stages=new Set();
    for (const state of queue) {
      const key=`${state.at}/${state.collected}`; if (seen.has(key)) continue; seen.add(key);
      Object.freeze(state);
      const target=m.objectives[state.collected]?.at ?? m.goal;
      const hop=M.nextHop(m,state);
      assert.equal(state.won,state.at===m.goal && state.collected===m.objectives.length);
      if (state.won) { assert.equal(hop,null); continue; }
      const d=distances(m,target);
      assert.equal(d.get(hop),d.get(state.at)-1,`${m.id}: shortest hint from ${key}`);
      assert.ok(M.edge(m,state.at,hop)); assert.equal(M.nextHop(m,state),hop);
      for (const to of M.neighbours(m,state.at)) {
        const step=M.step(m,state,to), expected=state.collected + Number(to===m.objectives[state.collected]?.at);
        assert.equal(step.collected,expected); assert.equal(step.stamped,state.stamped || to===m.stamp);
        assert.deepEqual(M.preview(m,state,[to]).state,step);
        assert.equal(M.ready(M.preview(m,state,[to])),step.won);
        if (to===m.goal) stages.add(expected);
        queue.push(step);
      }
    }
    assert.deepEqual([...stages].sort(),Array.from({length:m.objectives.length+1},(_,i)=>i),m.id);
  }
});

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const same=(a,b)=>a[0]===b[0] && a[1]===b[1];
function clearance(p,a,b) {
  const x=b[0]-a[0],y=b[1]-a[1], t=Math.min(1,Math.max(0,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y)));
  return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);
}

test('every trail segment clears unrelated places and roads; no crosses, touches or overlapping exits', () => {
  for (const m of M.MAPS) {
    const segments=[];
    for (const trail of m.trails) {
      const points=M.points(m,trail);
      for (let i=1;i<points.length;i++) {
        const a=points[i-1], b=points[i]; assert.ok(!same(a,b));
        for (const [id,p] of Object.entries(m.places)) if (id!==trail[0] && id!==trail[1]) {
          assert.ok(clearance(p.at,a,b)>=38,`${m.id}: ${id} on/too close to ${trail[0]}–${trail[1]}`);
        }
        for (const [c,d,other] of segments) {
          const msg=`${m.id}: ${trail.slice(0,2)} / ${other.slice(0,2)}`;
          const shared=[a,b].find(p=>same(p,c)||same(p,d));
          if (shared) {
            // Can meet only at *the same place* (or the bend of a single road).
            assert.ok(other===trail || trail.slice(0,2).some(id=>other.slice(0,2).includes(id) && same(m.places[id].at,shared)),msg);
            const p=same(a,shared)?b:a, q=same(c,shared)?d:c;
            assert.ok(clearance(p,c,d)>0.01 && clearance(q,a,b)>0.01,msg);
          } else {
            assert.ok(!(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0),msg);
            assert.ok(Math.min(clearance(a,c,d),clearance(b,c,d),clearance(c,a,b),clearance(d,a,b))>0.01,msg);
          }
        }
        segments.push([a,b,trail]);
      }
    }
  }
});

test('new layouts fit 44px walk buttons with a 3px gap on the actual roads at board width 280', () => {
  // Check layout feasibility, not DOM sizing. Stay clear of the courier's body
  // (20 units to each side, 4–53 units above the place). No fallback strip needed here.
  const unit=600/280, half=22*unit, gap=3*unit;
  for (const m of M.MAPS.slice(3)) for (const [here,p] of Object.entries(m.places)) {
    const [cx,cy]=p.at;
    const arrows=M.neighbours(m,here).map(to=>{
      const end=m.places[to].at;
      return [.52,.62,.43,.72,.36,.79].map(t=>p.at.map((n,k)=>n+t*(end[k]-n)))
        .filter(([x,y])=>Math.min(x,600-x,y,370-y)>=half+gap &&
          (x-half>=cx+20 || x+half<=cx-20 || y-half>=cy-4 || y+half<=cy-53));
    });
    function fits(chosen) {
      if (chosen.length===arrows.length) return true;
      return arrows[chosen.length].some(p=>chosen.every(q=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]))>=2*half+gap) && fits([...chosen,p]));
    }
    assert.ok(fits([]),`${m.id}:${here}`);
  }
});

test('classic scripts without require and full campaign saves round-trip', () => {
  assert.equal(M.MAPS.length,24);
  const context=vm.createContext({});
  for (const name of ['campaign','model']) vm.runInContext(fs.readFileSync(require.resolve(`../src/${name}.cjs`),'utf8'),context);
  assert.equal(vm.runInContext('JSON.stringify(TrailMail.MAPS)',context),JSON.stringify(M.MAPS));
  const original=M.readSave('{"v":1,"done":{"coast":true,"meadow":true,"stream":true}}');
  const full=M.MAPS.reduce((s,m)=>M.complete(s,m.id),original);
  assert.equal(Object.keys(full.done).length,24); assert.deepEqual(M.readSave(JSON.stringify(full)),full);
});
