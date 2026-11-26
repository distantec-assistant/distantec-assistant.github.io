const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/model.cjs');

const [meadow, stream, coast] = M.MAPS;
const run = (map,...steps) => steps.reduce((state,to)=>M.step(map,state,to),M.start(map));

test('three authored maps have unique places and two-way trails in the board', () => {
  assert.deepEqual(M.MAPS.map(map=>map.id),['meadow','stream','coast']);
  for(const map of M.MAPS) {
    const seen=new Set();
    assert.ok(map.places[map.start] && map.places[map.goal]);
    for (const edge of map.trails) {
      const [a,b,...bends] = edge;
      assert.notEqual(a,b);
      assert.ok(map.places[a] && map.places[b]);
      const key=[a,b].sort().join('/');
      assert.ok(!seen.has(key)); seen.add(key);
      assert.equal(M.edge(map,a,b), edge);
      assert.equal(M.edge(map,b,a),edge);
      const points=M.points(map,edge,a);
      assert.deepEqual(points.at(0),map.places[a].at);
      assert.deepEqual(points.at(-1),map.places[b].at);
      assert.deepEqual(M.points(map,edge,b),[...points].reverse());
      for (const [x,y] of points) assert.ok(x>20&&x<580&&y>20&&y<350,`${map.id} ${a}/${b}: ${x}/${y}`);
      assert.equal(points.length,bends.length+2);
    }
  }
});

test('all places can be explored and all deliveries can be completed',()=>{
  for(const map of M.MAPS) {
    const queue=[M.start(map)], seen=new Set(), places=new Set();
    let delivered=0;
    for(const state of queue) {
      const key=`${state.at}/${state.stamped}`;
      if(seen.has(key)) continue;
      seen.add(key); places.add(state.at);
      if(state.won) { delivered++; continue; }
      for(const to of M.neighbours(map,state.at)) queue.push(M.step(map,state,to));
    }
    assert.deepEqual([...places].sort(),Object.keys(map.places).sort());
    assert.equal(delivered,1);
  }
});

test('cannot jump across the meadow; can return from a dead end',()=>{
  const initial=M.start(meadow);
  assert.equal(M.step(meadow,initial,'finish'),initial);
  assert.equal(M.step(meadow,initial,'bad-place'),initial);
  const dead=run(meadow,'fork','grove','nest');
  assert.equal(dead.at,'nest'); assert.equal(dead.won,false);
  assert.deepEqual(M.neighbours(meadow,'nest'),['grove']);
  assert.equal(M.step(meadow,dead,'grove').at,'grove');
  const win=run(meadow,'fork','hill','finish');
  assert.equal(win.won,true);
  assert.equal(M.step(meadow,win,'hill'),win,'winning position cannot trigger a second delivery');
});

test('bridge mission requires a stamp, not merely reaching the recipient',()=>{
  const early=run(stream,'fork','bridge','finish');
  assert.equal(early.at,'finish'); assert.equal(early.won,false); assert.equal(early.stamped,false);
  const back=M.step(stream,M.step(stream,early,'bridge'),'fork');
  const stamped=M.step(stream,back,'lilies');
  assert.equal(stamped.stamped,true);
  const win=['fork','bridge','finish'].reduce((s,to)=>M.step(stream,s,to),stamped);
  assert.equal(win.won,true); assert.equal(win.stamped,true);
  assert.equal(M.start(stream).stamped,false,'replay starts without a stamp');
});

test('a plan inspects two neighbours in order without changing initial position',()=>{
  const start=M.start(coast);
  const short=M.preview(coast,start,['birches']);
  assert.equal(short.state.at,'birches'); assert.equal(M.ready(short),false);
  const plan=M.preview(coast,start,['birches','arch']);
  assert.deepEqual(plan.moves.map(m=>[m.from,m.to]),[['start','birches'],['birches','arch']]);
  assert.deepEqual(plan.moves.map(m=>m.state.at),['birches','arch']);
  assert.equal(M.ready(plan),true); assert.deepEqual(start,{at:'start',stamped:false,won:false});
  assert.equal(M.preview(coast,start,['birches','finish']),null);
  assert.equal(M.preview(coast,start,['birches',,'arch']),null);
  assert.equal(M.preview(coast,start,['birches','arch','windmill']),null);
  assert.equal(M.preview(coast,start,[,]),null);
  const reset=M.preview(coast,start,[]);
  assert.equal(reset.state,start); assert.equal(M.ready(reset),false);
  assert.equal(M.preview(coast,start,['birches','bench']).state.at,'bench');
});

test('a plan beside a recipient can end at the goal without an extra move',()=>{
  const close=run(coast,'birches','arch','dock');
  const direct=M.preview(coast,close,['finish']);
  assert.equal(direct.state.won,true); assert.equal(M.ready(direct),true);
  assert.equal(M.preview(coast,close,['finish','dock']),null);
});

test('read save only allows completion of known stories; replay does not increment',()=>{
  const fresh={v:1,done:{}};
  for(const raw of [null,'{}','{','null','[]','{"v":2}','a'.repeat(3000)]) assert.deepEqual(M.readSave(raw),fresh);
  assert.equal(M.KEY,'maze-mail-2-v1');
  const saved=M.readSave('{"v":1,"done":{"meadow":true,"coast":1,"bad":true,"__proto__":true}}');
  assert.deepEqual(saved,{v:1,done:{meadow:true}});
  assert.equal(M.complete(saved,meadow.id),saved);
  assert.equal(M.complete(saved,'bad'),saved);
  assert.deepEqual(M.complete(saved,stream.id),{v:1,done:{meadow:true,stream:true}});
  assert.deepEqual(saved,{v:1,done:{meadow:true}});
});
